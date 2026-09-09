// Opportunity Hunter Agent: profile → queries → sources → normalize → dedupe → score → explain → save → notify.
import { db, now } from "./db";
import { track } from "./analytics";
import { email } from "./email";
import { PLANS, remainingDiscoveries, type Plan } from "./plans";
import { activeSources } from "./sources";
import type { SearchQuery } from "./sources/types";
import {
  calculateMatchScore, deduplicateOpportunities, generateDailyDigest, generateMatchExplanation, generateSearchQueries,
  normalizeOpportunity, type NormalizedOpportunity, type Opportunity,
} from "./ai";
import { getProfile, parseOpp } from "./queries";

const MIN_RELEVANT_SCORE = 40;
const FREQUENCY_HOURS: Record<string, number> = { daily: 24, twice_daily: 12, weekly: 168 };
// Feeds occasionally return long-dead postings; don't create new matches for them.
// Already-matched listings are untouched, so saved and applied entries survive.
const MAX_LISTING_AGE_DAYS = 45;

export type HuntResult = { retrieved: number; newOpportunities: number; newMatches: number; notified: number; limited: boolean };

/** Fetch from every configured source and upsert into the opportunities table. Returns count of brand-new rows. */
async function collect(queries: SearchQuery[]) {
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

/**
 * Score the shared opportunity pool for one user.
 * `collectFirst: false` skips the API round-trip — used when the caller has already refreshed the pool
 * for a batch of users, since every user is scored against the same pool regardless of who fetched it.
 */
export async function runHunt(userId: number, { collectFirst = true } = {}): Promise<HuntResult> {
  const profile = getProfile(userId);
  const user = db.prepare("SELECT name, email, subscription_plan FROM users WHERE id = ?").get(userId) as { name: string; email: string; subscription_plan: Plan } | undefined;
  if (!profile || !user) return { retrieved: 0, newOpportunities: 0, newMatches: 0, notified: 0, limited: false };

  const { retrieved, fresh } = collectFirst ? await collect(generateSearchQueries(profile)) : { retrieved: 0, fresh: 0 };

  // Candidates: everything not yet evaluated for this user (rejected/hidden matches persist, so they never resurface).
  const candidates = (db.prepare(`SELECT o.* FROM opportunities o WHERE o.category = ? AND o.posted_date >= date('now', ?)
      AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_id = ? AND m.opportunity_id = o.id) ORDER BY o.posted_date DESC`)
    .all(profile.category ?? "job", `-${MAX_LISTING_AGE_DAYS} days`, userId) as Record<string, unknown>[]).map(parseOpp);

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

/** Score one listing for a user on demand (Pro users opening an unscored listing) and persist the match. */
export function evaluateForUser(userId: number, opp: Opportunity) {
  const profile = getProfile(userId);
  if (!profile) return null;
  const b = calculateMatchScore(profile, opp);
  const explanation = generateMatchExplanation(profile, opp, b);
  db.prepare(`INSERT OR IGNORE INTO matches (user_id, opportunity_id, score, skills_score, experience_score, location_score, salary_score,
      role_score, explanation, status, viewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'viewed', ?)`)
    .run(userId, opp.id, b.score, b.skills_score, b.experience_score, b.location_score, b.salary_score, b.role_score, JSON.stringify(explanation), now());
  return b;
}

/**
 * Run hunts for every profile whose schedule is due. Called by the in-process scheduler and /api/cron/hunt.
 * Sources are polled ONCE for the deduplicated union of every due profile's queries, then each user is scored
 * against the shared pool — so API usage tracks the number of distinct queries, not the number of users.
 */
async function collectForProfiles(userIds: number[]) {
  const seen = new Set<string>();
  const queries: SearchQuery[] = [];
  for (const id of userIds) {
    const profile = getProfile(id);
    if (!profile) continue;
    for (const q of generateSearchQueries(profile)) {
      const key = `${q.q}|${q.location ?? ""}|${q.remote ?? false}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); queries.push(q); }
    }
  }
  // Adapters cap how many queries they run per call, so rotate daily — otherwise the same few
  // queries at the head of the list would be the only ones ever issued.
  const offset = queries.length ? Math.floor(Date.now() / 864e5) % queries.length : 0;
  await collect([...queries.slice(offset), ...queries.slice(0, offset)]);
}

async function scoreFor(userIds: number[]) {
  for (const id of userIds) await runHunt(id, { collectFirst: false });
  return userIds.length;
}

export async function runDueHunts() {
  const rows = db.prepare("SELECT user_id, search_frequency, last_run_at FROM search_profiles").all() as { user_id: number; search_frequency: string; last_run_at: string | null }[];
  const due = rows.filter((r) => {
    const hours = FREQUENCY_HOURS[r.search_frequency] ?? 24;
    return !r.last_run_at || Date.now() - new Date(r.last_run_at.replace(" ", "T") + "Z").getTime() > hours * 36e5;
  }).map((r) => r.user_id);
  if (!due.length) return 0;
  await collectForProfiles(due);
  return scoreFor(due);
}

/** Force a hunt for every profile regardless of schedule (admin action), still on a single shared fetch. */
export async function runAllHunts() {
  const ids = (db.prepare("SELECT user_id FROM search_profiles").all() as { user_id: number }[]).map((r) => r.user_id);
  if (!ids.length) return 0;
  await collectForProfiles(ids);
  return scoreFor(ids);
}
