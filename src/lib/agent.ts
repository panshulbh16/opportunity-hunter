// Opportunity Hunter Agent: profile → queries → sources → normalize → dedupe → score → explain → save → notify.
import { db, now } from "./db";
import { track } from "./analytics";
import { email } from "./email";
import { PLANS, remainingDiscoveries, type Plan } from "./plans";
import { activeSources } from "./sources";
import {
  calculateMatchScore, deduplicateOpportunities, generateDailyDigest, generateMatchExplanation, generateSearchQueries,
  normalizeOpportunity, type NormalizedOpportunity,
} from "./ai";
import { getProfile, parseOpp } from "./queries";

const MIN_RELEVANT_SCORE = 40;
const FREQUENCY_HOURS: Record<string, number> = { daily: 24, twice_daily: 12, weekly: 168 };

export type HuntResult = { retrieved: number; newOpportunities: number; newMatches: number; notified: number; limited: boolean };

/** Fetch from every configured source and upsert into the opportunities table. Returns count of brand-new rows. */
async function collect(queries: ReturnType<typeof generateSearchQueries>) {
  const all: NormalizedOpportunity[] = [];
  for (const src of activeSources()) {
    const run = db.prepare("INSERT INTO source_runs (source) VALUES (?)").run(src.name).lastInsertRowid;
    try {
      const raws = await src.fetch(queries);
      all.push(...raws.map(normalizeOpportunity));
      db.prepare("UPDATE source_runs SET finished_at = ?, retrieved = ?, status = 'ok' WHERE id = ?").run(now(), raws.length, run);
    } catch (e) {
      db.prepare("UPDATE source_runs SET finished_at = ?, status = 'error', error = ? WHERE id = ?").run(now(), String(e), run);
    }
  }
  const unique = deduplicateOpportunities(all);
  const insert = db.prepare(`INSERT OR IGNORE INTO opportunities (category, title, company, location, country, remote_type, salary_min,
      salary_max, currency, salary_period, description, skills, nice_to_have, min_years, seniority, employment_type, company_type,
      industry, visa_sponsorship, source, source_url, application_url, posted_date, canonical_url, dedupe_key, is_demo)
    VALUES (@category, @title, @company, @location, @country, @remote_type, @salary_min, @salary_max, @currency, @salary_period,
      @description, @skills, @nice_to_have, @min_years, @seniority, @employment_type, @company_type, @industry, @visa_sponsorship,
      @source, @source_url, @application_url, @posted_date, @canonical_url, @dedupe_key, @is_demo)`);
  let fresh = 0;
  db.transaction(() => {
    for (const o of unique) {
      const r = insert.run({ ...o, skills: JSON.stringify(o.skills), nice_to_have: JSON.stringify(o.nice_to_have), is_demo: /^Demo/.test(o.source) ? 1 : 0 });
      fresh += r.changes;
    }
  })();
  return { retrieved: all.length, fresh };
}

export async function runHunt(userId: number): Promise<HuntResult> {
  const profile = getProfile(userId);
  const user = db.prepare("SELECT name, email, subscription_plan FROM users WHERE id = ?").get(userId) as { name: string; email: string; subscription_plan: Plan } | undefined;
  if (!profile || !user) return { retrieved: 0, newOpportunities: 0, newMatches: 0, notified: 0, limited: false };

  const { retrieved, fresh } = await collect(generateSearchQueries(profile));

  // Candidates: everything not yet evaluated for this user (rejected/hidden matches persist, so they never resurface).
  const candidates = (db.prepare(`SELECT o.* FROM opportunities o WHERE o.category = ? AND NOT EXISTS
      (SELECT 1 FROM matches m WHERE m.user_id = ? AND m.opportunity_id = o.id) ORDER BY o.posted_date DESC`)
    .all(profile.category ?? "job", userId) as Record<string, unknown>[]).map(parseOpp);

  const scored = candidates
    .map((opp) => ({ opp, b: calculateMatchScore(profile, opp) }))
    .filter(({ b }) => !b.excluded && b.score >= MIN_RELEVANT_SCORE)
    .sort((a, b) => b.b.score - a.b.score);

  const remaining = remainingDiscoveries(userId, user.subscription_plan);
  const limited = scored.length > remaining;
  const toSave = scored.slice(0, remaining === Infinity ? undefined : remaining);
  if (limited) track("free_limit_hit", userId, { withheld: scored.length - toSave.length });

  const insertMatch = db.prepare(`INSERT INTO matches (user_id, opportunity_id, score, skills_score, experience_score, location_score,
      salary_score, role_score, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertNotif = db.prepare("INSERT INTO notifications (user_id, opportunity_id, type, title, body) VALUES (?, ?, ?, ?, ?)");
  const saved: { id: number; title: string; company: string; score: number }[] = [];
  let notified = 0;
  db.transaction(() => {
    for (const { opp, b } of toSave) {
      const explanation = generateMatchExplanation(profile, opp, b);
      insertMatch.run(userId, opp.id, b.score, b.skills_score, b.experience_score, b.location_score, b.salary_score, b.role_score, JSON.stringify(explanation));
      saved.push({ id: opp.id, title: opp.title, company: opp.company, score: b.score });
      if (b.score >= profile.notification_threshold) {
        insertNotif.run(userId, opp.id, "high_match", `${b.score}% match: ${opp.title} at ${opp.company}`, explanation.strengths.slice(0, 2).join(" · "));
        notified++;
      }
    }
    db.prepare("UPDATE search_profiles SET last_run_at = ? WHERE id = ?").run(now(), profile.id);
  })();

  if (saved.length && profile.digest_enabled && PLANS[user.subscription_plan].weeklyDiscoveries === Infinity) {
    const digest = generateDailyDigest(user.name, saved, process.env.APP_URL ?? "http://localhost:3000");
    insertNotif.run(userId, digest.top?.id ?? null, "digest", digest.subject, `${digest.excellent} excellent · ${digest.good} good`);
    email.send({ to: user.email, subject: digest.subject, text: digest.text, html: digest.html }).catch((e) => console.error("digest email failed", e));
    track("notification_sent", userId, { type: "digest", provider: email.name });
  }
  track("search_run", userId, { retrieved, fresh, newMatches: saved.length, limited });
  return { retrieved, newOpportunities: fresh, newMatches: saved.length, notified, limited };
}

/** Run hunts for every profile whose schedule is due. Called by the in-process scheduler and /api/cron/hunt. */
export async function runDueHunts() {
  const rows = db.prepare("SELECT user_id, search_frequency, last_run_at FROM search_profiles").all() as { user_id: number; search_frequency: string; last_run_at: string | null }[];
  let ran = 0;
  for (const r of rows) {
    const hours = FREQUENCY_HOURS[r.search_frequency] ?? 24;
    const due = !r.last_run_at || Date.now() - new Date(r.last_run_at.replace(" ", "T") + "Z").getTime() > hours * 36e5;
    if (due) { await runHunt(r.user_id); ran++; }
  }
  return ran;
}
