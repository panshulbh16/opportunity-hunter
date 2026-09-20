import { db } from "./db.ts";

/**
 * Employers take listings down, and a dead "Apply" link is the worst thing a job board can show.
 * A slow background sweep re-checks apply links; 404/410 means the listing is gone, so it stops
 * appearing in lists (it stays visible, labelled, for anyone who saved or applied to it).
 */

const BATCH = 20; // per sweep; the scheduler runs every 15 min
const RECHECK_DAYS = 7;
const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export type LinkVerdict = "closed" | "alive" | "unknown";

/** Job boards block bots with 401/403/429 — that says nothing about the listing, so only 404/410 count as gone. */
export function classifyLinkStatus(status: number): LinkVerdict {
  if (status === 404 || status === 410) return "closed";
  if (status >= 200 && status < 400) return "alive";
  return "unknown"; // blocked, rate-limited or the site is down: re-check another day
}

export const isClosed = (opportunityId: number) =>
  Boolean(db.prepare("SELECT 1 FROM link_checks WHERE opportunity_id = ? AND status_code IN (404, 410)").get(opportunityId));

/** Checks a few listings users can actually see. Returns how many were newly marked closed. */
export async function sweepListingLinks(batch = BATCH): Promise<number> {
  const due = db
    .prepare(
      `SELECT o.id, o.application_url FROM opportunities o
       JOIN matches m ON m.opportunity_id = o.id
       LEFT JOIN link_checks c ON c.opportunity_id = o.id
       WHERE o.application_url LIKE 'http%'
         AND (c.checked_at IS NULL OR (c.status_code NOT IN (404, 410) AND c.checked_at < datetime('now', ?)))
       GROUP BY o.id
       ORDER BY c.checked_at IS NOT NULL, o.created_at DESC
       LIMIT ?`,
    )
    .all(`-${RECHECK_DAYS} days`, batch) as { id: number; application_url: string }[];

  const record = db.prepare(
    `INSERT INTO link_checks (opportunity_id, status_code, checked_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(opportunity_id) DO UPDATE SET status_code = excluded.status_code, checked_at = excluded.checked_at`,
  );
  let closed = 0;
  for (const row of due) {
    let status = 0;
    try {
      const res = await fetch(row.application_url, { redirect: "follow", headers: { "user-agent": UA, "accept-language": "en-IN,en" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = res.status;
    } catch {
      status = 0; // network error or timeout — "unknown", recorded so we don't hammer it
    }
    const verdict = classifyLinkStatus(status);
    record.run(row.id, status);
    if (verdict === "closed") closed++;
  }
  if (closed) console.log(`[links] checked ${due.length}, ${closed} listing(s) taken down by the employer`);
  return closed;
}
