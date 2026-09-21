// Opportunity Hunter Agent: profile → queries → sources → normalize → dedupe → score → explain → save → notify.
import { db, now } from "./db";
import { track } from "./analytics";
import { email } from "./email";
import { PLANS, remainingDiscoveries, type Plan } from "./plans";
import { activeSources } from "./sources";
import type { SearchQuery, SourceAdapter } from "./sources/types";
import { MAX_QUERIES_PER_RUN } from "./sources/jsearch";
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

// The pool is refreshed on a fixed global cadence, never per user: signups, "Run Search Now" and
// scheduled hunts all score against the shared pool, which costs nothing. Only refreshPool() spends API calls.
// Defaults fit the ~200 calls/month free RapidAPI tier: 2 refreshes/day × 3 calls ≈ 180/month.
const REFRESH_HOURS = Number(process.env.POOL_REFRESH_HOURS ?? 12);
const MONTHLY_CALL_BUDGET = Number(process.env.RAPIDAPI_MONTHLY_CALLS ?? 180);

export type HuntResult = { retrieved: number; newOpportunities: number; newMatches: number; notified: number; limited: boolean };

/**
 * Retry transient network failures — a dropped connection otherwise costs a whole scheduled cycle.
 * Only `fetch` itself failing is retried; an HTTP error (say a 429) would just burn more quota.
 */
async function fetchWithRetry(src: SourceAdapter, queries: SearchQuery[], attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await src.fetch(queries);
    } catch (e) {
      if (!(e instanceof TypeError) || attempt >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** Fetch from every configured source and upsert into the opportunities table. Returns count of brand-new rows. */
async function collect(queries: SearchQuery[]) {
  const all: NormalizedOpportunity[] = [];
  for (const src of activeSources()) {
    const run = db.prepare("INSERT INTO source_runs (source) VALUES (?)").run(src.name).lastInsertRowid;
    try {
      const raws = await fetchWithRetry(src, queries);
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

const utc = (sqliteTime: string) => Date.parse(sqliteTime.replace(" ", "T") + "Z");

export function apiUsage() {
  const runs = (db.prepare("SELECT COUNT(*) n FROM source_runs WHERE source LIKE 'JSearch%' AND started_at >= date('now','start of month')").get() as { n: number }).n;
  const last = (db.prepare("SELECT MAX(started_at) t FROM source_runs").get() as { t: string | null }).t;
  return { callsThisMonth: runs * MAX_QUERIES_PER_RUN, budget: MONTHLY_CALL_BUDGET, lastRefresh: last, refreshHours: REFRESH_HOURS };
}

export type PoolHealth = {
  kind: "ok" | "no-sources" | "empty" | "source-error" | "budget";
  listings: number;
  userMessage: string;
  adminMessage: string;
};

/** Why the shared listing pool is empty or the feed is off — used on dashboard, opportunities, admin. */
export function poolHealth(): PoolHealth {
  const listings = (db.prepare("SELECT COUNT(*) n FROM opportunities").get() as { n: number }).n;
  const last = db.prepare("SELECT status, error FROM source_runs ORDER BY id DESC LIMIT 1").get() as { status: string; error: string | null } | undefined;
  const usage = apiUsage();
  if (!activeSources().length) {
    return {
      kind: "no-sources",
      listings,
      userMessage: "The live job feed is not connected, so hunts cannot pull new listings. If you run this site, set RAPIDAPI_KEY and check Admin → Integrations.",
      adminMessage: "JSearch is off. Set RAPIDAPI_KEY (RapidAPI JSearch) so hunts can pull LinkedIn/Indeed/Glassdoor listings. Until then the pool stays empty.",
    };
  }
  if (last?.status === "error" && listings === 0) {
    const err = last.error?.slice(0, 240) || "unknown error";
    return {
      kind: "source-error",
      listings,
      userMessage: "The job feed failed on the last refresh. Try Run Search Now in a few minutes, or ask the operator to check Admin → Source health.",
      adminMessage: `Last JSearch run failed: ${err}`,
    };
  }
  if (listings === 0 && usage.callsThisMonth + MAX_QUERIES_PER_RUN > usage.budget) {
    return {
      kind: "budget",
      listings,
      userMessage: "This month's job-feed budget is used up, and the pool is still empty. Existing matches will wait until the budget resets.",
      adminMessage: `API budget exhausted (${usage.callsThisMonth}/${usage.budget}) with an empty pool. Raise RAPIDAPI_MONTHLY_CALLS or wait for next month.`,
    };
  }
  if (listings === 0) {
    return {
      kind: "empty",
      listings,
      userMessage: "The shared pool has no listings yet. Run Search Now after the feed is connected, or wait for the next scheduled hunt.",
      adminMessage: "Opportunity pool is empty. Click Run agent for all users, or wait for the 15-minute scheduler. Confirm RAPIDAPI_KEY is valid if a run already completed with 0 retrieved.",
    };
  }
  return {
    kind: "ok",
    listings,
    userMessage: "",
    adminMessage: "",
  };
}

/**
 * Refresh the shared pool if it's due and the month's API budget allows. Safe to call from anywhere —
 * it self-limits, so a burst of signups or clicks costs at most one refresh per REFRESH_HOURS.
 */
export async function refreshPool(): Promise<"refreshed" | "fresh" | "budget" | "no-sources"> {
  if (!activeSources().length) return "no-sources";
  const u = apiUsage();
  if (u.lastRefresh && Date.now() - utc(u.lastRefresh) < REFRESH_HOURS * 36e5) return "fresh";
  if (u.callsThisMonth + MAX_QUERIES_PER_RUN > MONTHLY_CALL_BUDGET) return "budget";

  const seen = new Set<string>();
  const queries: SearchQuery[] = [];
  for (const { user_id } of db.prepare("SELECT user_id FROM search_profiles").all() as { user_id: number }[]) {
    const profile = getProfile(user_id);
    if (!profile) continue;
    for (const q of generateSearchQueries(profile)) {
      const key = `${q.q}|${q.location ?? ""}|${q.remote ?? false}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); queries.push(q); }
    }
  }
  if (!queries.length) return "fresh";
  // Each refresh only issues a few queries, so advance a cursor by that many every time —
  // over successive refreshes every user's searches get their turn.
  const done = (db.prepare("SELECT COUNT(*) n FROM source_runs").get() as { n: number }).n;
  const offset = (done * MAX_QUERIES_PER_RUN) % queries.length;
  await collect([...queries.slice(offset), ...queries.slice(0, offset)]);
  return "refreshed";
}

/** Score the shared opportunity pool for one user. Never calls an external API — see refreshPool(). */
export async function runHunt(userId: number): Promise<HuntResult> {
  const profile = getProfile(userId);
  const user = db.prepare("SELECT name, email, subscription_plan FROM users WHERE id = ?").get(userId) as { name: string; email: string; subscription_plan: Plan } | undefined;
  if (!profile || !user) return { retrieved: 0, newOpportunities: 0, newMatches: 0, notified: 0, limited: false };

  const retrieved = 0, fresh = 0;

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

async function scoreFor(userIds: number[]) {
  for (const id of userIds) await runHunt(id);
  return userIds.length;
}

/** Scheduler tick (in-process every 15 min, and /api/cron/hunt): refresh the pool if due, then score due users. */
export async function runDueHunts() {
  await refreshPool();
  const rows = db.prepare("SELECT user_id, search_frequency, last_run_at FROM search_profiles").all() as { user_id: number; search_frequency: string; last_run_at: string | null }[];
  const due = rows.filter((r) => {
    const hours = FREQUENCY_HOURS[r.search_frequency] ?? 24;
    return !r.last_run_at || Date.now() - new Date(r.last_run_at.replace(" ", "T") + "Z").getTime() > hours * 36e5;
  }).map((r) => r.user_id);
  return due.length ? scoreFor(due) : 0;
}

/** Score every profile now (admin action). Still respects the refresh cadence and budget. */
export async function runAllHunts() {
  await refreshPool();
  const ids = (db.prepare("SELECT user_id FROM search_profiles").all() as { user_id: number }[]).map((r) => r.user_id);
  return scoreFor(ids);
}
