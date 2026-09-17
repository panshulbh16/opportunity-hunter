import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  is_admin INTEGER NOT NULL DEFAULT 0,
  onboarded INTEGER NOT NULL DEFAULT 0,
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS search_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'job',
  roles TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  industries TEXT NOT NULL DEFAULT '[]',
  companies TEXT NOT NULL DEFAULT '[]',
  excluded_companies TEXT NOT NULL DEFAULT '[]',
  excluded_keywords TEXT NOT NULL DEFAULT '[]',
  years_experience REAL NOT NULL DEFAULT 0,
  current_role TEXT NOT NULL DEFAULT '',
  education TEXT NOT NULL DEFAULT '',
  seniority TEXT NOT NULL DEFAULT 'mid',
  locations TEXT NOT NULL DEFAULT '[]',
  remote_preference TEXT NOT NULL DEFAULT '[]',
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  salary_period TEXT NOT NULL DEFAULT 'year',
  employment_types TEXT NOT NULL DEFAULT '["full-time"]',
  preferences TEXT NOT NULL DEFAULT '[]',
  notification_threshold INTEGER NOT NULL DEFAULT 80,
  search_frequency TEXT NOT NULL DEFAULT 'daily',
  digest_enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON search_profiles(user_id);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'job',
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  remote_type TEXT NOT NULL DEFAULT 'onsite',
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT,
  salary_period TEXT NOT NULL DEFAULT 'year',
  description TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '[]',
  nice_to_have TEXT NOT NULL DEFAULT '[]',
  min_years INTEGER NOT NULL DEFAULT 0,
  seniority TEXT NOT NULL DEFAULT 'mid',
  employment_type TEXT NOT NULL DEFAULT 'full-time',
  company_type TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  visa_sponsorship INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  application_url TEXT NOT NULL,
  posted_date TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  dedupe_key TEXT NOT NULL UNIQUE,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  skills_score INTEGER NOT NULL,
  experience_score INTEGER NOT NULL,
  location_score INTEGER NOT NULL,
  salary_score INTEGER NOT NULL,
  role_score INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  viewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, opportunity_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_user_score ON matches(user_id, score DESC);
CREATE TABLE IF NOT EXISTS saved_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, opportunity_id)
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved',
  applied_at TEXT,
  follow_up_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, opportunity_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, created_at);
CREATE TABLE IF NOT EXISTS source_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  retrieved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT
);
`;

const g = globalThis as unknown as { __db?: Database.Database; __closeHooked?: boolean };

function open() {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  return d;
}

// Close on shutdown so prepared statements are finalized while the V8 environment still exists.
// Otherwise their destructors run after teardown and abort the process
// ("Assertion failed: (env) != nullptr"), turning every container stop into a crash.
function hookShutdown() {
  if (g.__closeHooked) return;
  g.__closeHooked = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      try {
        g.__db?.close();
      } catch {
        // already closed — nothing to salvage on the way out
      }
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
    });
  }
}

/**
 * Opened on first use rather than on import. `next build` imports server modules to collect page
 * data, so opening eagerly made the *build* create the database and its parallel collectors contend
 * over it (SQLITE_BUSY). Deferring also means the file is opened after the host has mounted its volume.
 */
function handle(): Database.Database {
  if (!g.__db) {
    g.__db = open();
    hookShutdown();
  }
  return g.__db;
}

export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const d = handle();
    const value = Reflect.get(d, prop) as unknown;
    return typeof value === "function" ? value.bind(d) : value;
  },
});

export const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);
export const json = <T>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
