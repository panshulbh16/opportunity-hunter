import { db } from "./db";
import { hashPassword } from "./password";
import { runDueHunts, runHunt } from "./agent";

export const DEMO_EMAIL = "demo@opportunityhunter.app";
export const DEMO_PASSWORD = "demo1234";

/**
 * The demo account has a published password, so it must never appear on a real deployment by default.
 * Set SEED_DEMO=true to opt in (for a public demo instance); it is never granted admin in production.
 */
const IS_PROD = process.env.NODE_ENV === "production";
export const demoEnabled = !IS_PROD || process.env.SEED_DEMO === "true";

async function seedDemoUser() {
  if (!demoEnabled) return;
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(DEMO_EMAIL)) return;
  const userId = db
    .prepare("INSERT INTO users (name, email, password_hash, subscription_plan, is_admin, onboarded) VALUES (?, ?, ?, 'pro', ?, 1)")
    .run("Demo User", DEMO_EMAIL, hashPassword(DEMO_PASSWORD), IS_PROD ? 0 : 1).lastInsertRowid;
  db.prepare(`INSERT INTO search_profiles (user_id, roles, skills, keywords, industries, excluded_companies, years_experience, current_role,
      education, seniority, locations, remote_preference, salary_min, currency, employment_types, preferences, notification_threshold, search_frequency)
    VALUES (?, ?, ?, ?, ?, ?, 4, 'AI Engineer', 'B.Tech Computer Science', 'mid', ?, ?, 2000000, 'INR', ?, ?, 80, 'daily')`).run(
    userId,
    JSON.stringify(["AI Engineer", "Machine Learning Engineer", "Python Developer"]),
    JSON.stringify(["Python", "RAG", "Vector Databases", "LLM", "FastAPI", "PostgreSQL"]),
    JSON.stringify(["GenAI", "Agents"]),
    JSON.stringify(["AI Infrastructure", "Developer Tools"]),
    JSON.stringify(["Sable Systems"]),
    JSON.stringify(["India", "Global"]),
    JSON.stringify(["remote", "hybrid"]),
    JSON.stringify(["full-time"]),
    JSON.stringify(["product_company"]),
  );
  await runHunt(Number(userId));
  console.log(`[boot] seeded demo account ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

const g = globalThis as unknown as { __booted?: boolean };

export async function boot() {
  if (g.__booted) return;
  g.__booted = true;
  // Demo source is retired; drop any seeded rows (matches/saves/applications cascade).
  const purged = db.prepare("DELETE FROM opportunities WHERE is_demo = 1").run().changes;
  if (purged) console.log(`[boot] removed ${purged} demo opportunities`);
  await seedDemoUser();
  // ADMIN_EMAILS is otherwise only consulted at signup, so an address added later would never take effect.
  // Grant-only: removing an address here does not revoke admin, so a typo can't lock everyone out.
  for (const addr of (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const r = db.prepare("UPDATE users SET is_admin = 1 WHERE lower(email) = ? AND is_admin = 0").run(addr);
    if (r.changes) console.log(`[boot] granted admin to ${addr}`);
  }
  // ponytail: in-process scheduler; swap for an external cron hitting /api/cron/hunt when scaling past one instance
  setInterval(() => runDueHunts().catch((e) => console.error("[agent] scheduled run failed", e)), 15 * 60 * 1000).unref();
}
