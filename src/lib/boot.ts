import { db } from "./db";
import { hashPassword } from "./password";
import { runDueHunts, runHunt } from "./agent";

export const DEMO_EMAIL = "demo@opportunityhunter.app";
export const DEMO_PASSWORD = "demo1234";

async function seedDemoUser() {
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(DEMO_EMAIL)) return;
  const userId = db
    .prepare("INSERT INTO users (name, email, password_hash, subscription_plan, is_admin, onboarded) VALUES (?, ?, ?, 'pro', 1, 1)")
    .run("Demo User", DEMO_EMAIL, hashPassword(DEMO_PASSWORD)).lastInsertRowid;
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
  // One-off: earlier demo rows pointed at a fake external host; rewrite them to the in-app sample page.
  for (const [from, to] of [["https://demo.opportunityhunter.app/jobs", "/demo/jobs"], ["https://jobs.demo-aggregator.example/jobs", "/demo/aggregator"]])
    db.prepare(`UPDATE opportunities SET source_url = replace(source_url, ?, ?), application_url = replace(application_url, ?, ?),
      canonical_url = replace(canonical_url, ?, ?) WHERE is_demo = 1 AND source_url LIKE ?`).run(from, to, from, to, from, to, `${from}%`);
  await seedDemoUser();
  // ponytail: in-process scheduler; swap for an external cron hitting /api/cron/hunt when scaling past one instance
  setInterval(() => runDueHunts().catch((e) => console.error("[agent] scheduled run failed", e)), 15 * 60 * 1000).unref();
}
