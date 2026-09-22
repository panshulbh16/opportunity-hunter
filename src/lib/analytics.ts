import { db } from "./db.ts";

export type EventName =
  | "signup"
  | "login"
  | "onboarding_completed"
  | "search_created"
  | "search_updated"
  | "search_run"
  | "opportunity_viewed"
  | "opportunity_saved"
  | "opportunity_rejected"
  | "application_created"
  | "application_moved"
  | "upgrade_clicked"
  | "subscription_started"
  | "free_limit_hit"
  | "notification_sent"
  | "password_reset_issued"
  | "resume_imported"
  | "resume_preview"
  | "tailor_created";

// ponytail: events land in SQLite; forward to PostHog/Segment from here when needed
export function track(name: EventName, userId: number | null, props: Record<string, unknown> = {}) {
  db.prepare("INSERT INTO events (user_id, name, props) VALUES (?, ?, ?)").run(userId, name, JSON.stringify(props));
}
