import { db, json } from "./db";
import type { Explanation, Opportunity, Profile } from "./ai";

export type ProfileRow = Profile & { id: number; user_id: number; category: string; digest_enabled: number; last_run_at: string | null };

const LIST_FIELDS = ["roles", "skills", "keywords", "industries", "companies", "excluded_companies", "excluded_keywords",
  "locations", "remote_preference", "employment_types", "preferences"] as const;

export function getProfile(userId: number): ProfileRow | null {
  const row = db.prepare("SELECT * FROM search_profiles WHERE user_id = ? ORDER BY id LIMIT 1").get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const p = { ...row } as Record<string, unknown>;
  for (const f of LIST_FIELDS) p[f] = json<string[]>(row[f] as string, []);
  return p as unknown as ProfileRow;
}

export function parseOpp(row: Record<string, unknown>): Opportunity {
  return { ...row, skills: json<string[]>(row.skills as string, []), nice_to_have: json<string[]>(row.nice_to_have as string, []) } as unknown as Opportunity;
}

export type MatchRow = {
  id: number; user_id: number; opportunity_id: number; score: number; skills_score: number; experience_score: number;
  location_score: number; salary_score: number; role_score: number; explanation: Explanation; status: string;
  viewed_at: string | null; created_at: string; saved: number; application_status: string | null;
};

export type MatchWithOpp = { match: MatchRow | null; opp: Opportunity; liveScore?: number };
export type MatchedOpp = MatchWithOpp & { match: MatchRow };

// Every gathered opportunity, left-joined with this user's match (if the agent scored it for them).
const OPP_SELECT = `
  SELECT m.id AS m_id, m.user_id, m.opportunity_id, m.score, m.skills_score, m.experience_score, m.location_score, m.salary_score,
    m.role_score, m.explanation, m.status, m.viewed_at, m.created_at AS m_created_at, o.*,
    (SELECT 1 FROM saved_opportunities s WHERE s.user_id = m.user_id AND s.opportunity_id = o.id) AS saved,
    (SELECT status FROM applications a WHERE a.user_id = m.user_id AND a.opportunity_id = o.id) AS application_status
  FROM opportunities o LEFT JOIN matches m ON m.opportunity_id = o.id AND m.user_id = ?`;

function splitRow(r: Record<string, unknown>): MatchWithOpp {
  const match = r.m_id == null ? null : {
    id: r.m_id, user_id: r.user_id, opportunity_id: r.opportunity_id, score: r.score, skills_score: r.skills_score,
    experience_score: r.experience_score, location_score: r.location_score, salary_score: r.salary_score,
    role_score: r.role_score, explanation: json<Explanation>(r.explanation as string, { strengths: [], gaps: [], difficulty: "medium", difficultyReason: "" }),
    status: r.status, viewed_at: r.viewed_at, created_at: r.m_created_at, saved: r.saved ?? 0, application_status: r.application_status ?? null,
  } as MatchRow;
  return { match, opp: parseOpp(r) };
}

export type Filters = {
  q?: string; minScore?: number; location?: string; remote?: string; minSalary?: number; maxYears?: number;
  type?: string; postedDays?: number; company?: string; skill?: string; status?: string; sort?: string; limit?: number;
  matchedOnly?: boolean;
};

export function listOpportunities(userId: number, f: Filters = {}): MatchWithOpp[] {
  const where: string[] = [];
  const args: unknown[] = [userId];
  if (f.status) { where.push("m.status = ?"); args.push(f.status); } else where.push("(m.status IS NULL OR m.status NOT IN ('rejected','hidden'))");
  if (f.matchedOnly) where.push("m.id IS NOT NULL");
  if (f.q) { where.push("(o.title LIKE ? OR o.company LIKE ? OR o.description LIKE ? OR o.skills LIKE ?)"); args.push(...Array(4).fill(`%${f.q}%`)); }
  if (f.minScore) { where.push("m.score >= ?"); args.push(f.minScore); }
  if (f.location) { where.push("(o.location LIKE ? OR o.country LIKE ?)"); args.push(`%${f.location}%`, `%${f.location}%`); }
  if (f.remote) { where.push("o.remote_type = ?"); args.push(f.remote); }
  if (f.minSalary) { where.push("COALESCE(o.salary_max, o.salary_min) * CASE o.currency WHEN 'USD' THEN 84 WHEN 'EUR' THEN 91 WHEN 'GBP' THEN 106 WHEN 'SGD' THEN 62 ELSE 1 END * CASE o.salary_period WHEN 'month' THEN 12 ELSE 1 END >= ?"); args.push(f.minSalary); }
  if (f.maxYears != null) { where.push("o.min_years <= ?"); args.push(f.maxYears); }
  if (f.type) { where.push("o.employment_type = ?"); args.push(f.type); }
  if (f.postedDays) { where.push("o.posted_date >= date('now', ?)"); args.push(`-${f.postedDays} days`); }
  if (f.company) { where.push("o.company LIKE ?"); args.push(`%${f.company}%`); }
  if (f.skill) { where.push("(o.skills LIKE ? OR o.nice_to_have LIKE ?)"); args.push(`%${f.skill}%`, `%${f.skill}%`); }
  const order = {
    newest: "o.posted_date DESC, m.score DESC",
    salary: "COALESCE(o.salary_max, o.salary_min) DESC NULLS LAST, m.score DESC",
    relevance: "m.role_score DESC NULLS LAST, m.skills_score DESC",
  }[f.sort ?? ""] ?? "m.score DESC NULLS LAST, o.posted_date DESC";
  const rows = db.prepare(`${OPP_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`).all(...args, f.limit ?? 100) as Record<string, unknown>[];
  return rows.map(splitRow);
}

export const listMatches = (userId: number, f: Filters = {}) => listOpportunities(userId, { ...f, matchedOnly: true }) as MatchedOpp[];

/** One opportunity with this user's match attached when it exists; null if the opportunity doesn't exist. */
export function getMatch(userId: number, opportunityId: number): MatchWithOpp | null {
  const r = db.prepare(`${OPP_SELECT} WHERE o.id = ?`).get(userId, opportunityId) as Record<string, unknown> | undefined;
  return r ? splitRow(r) : null;
}

export function listSaved(userId: number): MatchWithOpp[] {
  const rows = db.prepare(`${OPP_SELECT} JOIN saved_opportunities s2 ON s2.user_id = ? AND s2.opportunity_id = o.id ORDER BY s2.created_at DESC`).all(userId, userId) as Record<string, unknown>[];
  return rows.map(splitRow);
}

export function dashboardStats(userId: number) {
  const one = (sql: string) => (db.prepare(sql).get(userId) as { n: number }).n;
  return {
    newOpps: one("SELECT COUNT(*) n FROM matches WHERE user_id = ? AND status = 'new'"),
    highMatches: one("SELECT COUNT(*) n FROM matches WHERE user_id = ? AND score >= 80 AND status NOT IN ('rejected','hidden')"),
    saved: one("SELECT COUNT(*) n FROM saved_opportunities WHERE user_id = ?"),
    applications: one("SELECT COUNT(*) n FROM applications WHERE user_id = ? AND status <> 'saved'"),
    followUps: one("SELECT COUNT(*) n FROM applications WHERE user_id = ? AND follow_up_date IS NOT NULL AND follow_up_date <= date('now', '+3 days') AND status IN ('applied','interview')"),
  };
}

export type ApplicationRow = {
  id: number; opportunity_id: number; status: string; applied_at: string | null; follow_up_date: string | null; notes: string;
  created_at: string; title: string; company: string; location: string; application_url: string; score: number | null;
};

export function listApplications(userId: number): ApplicationRow[] {
  return db.prepare(`SELECT a.*, o.title, o.company, o.location, o.application_url,
      (SELECT score FROM matches m WHERE m.user_id = a.user_id AND m.opportunity_id = a.opportunity_id) AS score
    FROM applications a JOIN opportunities o ON o.id = a.opportunity_id WHERE a.user_id = ? ORDER BY a.updated_at DESC`).all(userId) as ApplicationRow[];
}

export type NotificationRow = { id: number; opportunity_id: number | null; type: string; title: string; body: string; read: number; created_at: string };

export function listNotifications(userId: number, limit = 50): NotificationRow[] {
  return db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(userId, limit) as NotificationRow[];
}

export function unreadCount(userId: number) {
  return (db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0").get(userId) as { n: number }).n;
}

export function adminStats() {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    users: n("SELECT COUNT(*) n FROM users"),
    free: n("SELECT COUNT(*) n FROM users WHERE subscription_plan = 'free'"),
    pro: n("SELECT COUNT(*) n FROM users WHERE subscription_plan = 'pro'"),
    opportunities: n("SELECT COUNT(*) n FROM opportunities"),
    matched: n("SELECT COUNT(*) n FROM matches"),
    applications: n("SELECT COUNT(*) n FROM applications WHERE status <> 'saved'"),
    dau: n("SELECT COUNT(*) n FROM users WHERE last_active_at > datetime('now', '-1 day')"),
    sourceRuns: db.prepare(`SELECT source, MAX(CASE WHEN status='ok' THEN finished_at END) AS last_ok, SUM(retrieved) AS retrieved,
        (SELECT status FROM source_runs r2 WHERE r2.source = r.source ORDER BY id DESC LIMIT 1) AS status,
        (SELECT error FROM source_runs r3 WHERE r3.source = r.source ORDER BY id DESC LIMIT 1) AS error
      FROM source_runs r GROUP BY source`).all() as { source: string; last_ok: string | null; retrieved: number; status: string; error: string | null }[],
    // ponytail: listing every user is fine at early-access scale; add search past a few hundred
    recentUsers: db.prepare("SELECT id, name, email, subscription_plan, created_at, last_active_at FROM users ORDER BY id DESC LIMIT 500").all() as
      { id: number; name: string; email: string; subscription_plan: string; created_at: string; last_active_at: string | null }[],
    events: db.prepare("SELECT name, COUNT(*) n FROM events WHERE created_at > datetime('now', '-7 days') GROUP BY name ORDER BY n DESC").all() as { name: string; n: number }[],
  };
}
