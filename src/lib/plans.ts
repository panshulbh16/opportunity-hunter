import { db } from "./db.ts";

const FREE_WEEKLY = 15;

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    weeklyDiscoveries: FREE_WEEKLY,
    profiles: 1,
    features: [`${FREE_WEEKLY} new opportunities per week`, "Basic matching", "Basic application tracker", "One search profile"],
  },
  pro: {
    name: "Pro",
    price: 499,
    weeklyDiscoveries: Infinity,
    profiles: 5,
    features: [
      "Unlimited opportunities",
      "Continuous monitoring",
      "Advanced AI matching",
      "Daily digest",
      "Multiple search profiles",
      "Advanced filters",
      "Application tracking",
      "AI opportunity analysis",
    ],
  },
} as const;

export type Plan = keyof typeof PLANS;

export function discoveriesThisWeek(userId: number) {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM matches WHERE user_id = ? AND created_at > datetime('now', '-7 days')")
      .get(userId) as { n: number }
  ).n;
}

export function remainingDiscoveries(userId: number, plan: Plan) {
  const cap = PLANS[plan].weeklyDiscoveries;
  return cap === Infinity ? Infinity : Math.max(0, cap - discoveriesThisWeek(userId));
}

export const paymentsConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** End of the user's paid Pro time (UTC, "YYYY-MM-DD HH:MM:SS"), or null if they never bought a pass. */
export function proUntil(userId: number) {
  return (db.prepare("SELECT max(pro_until) AS t FROM orders WHERE user_id = ? AND status = 'paid'").get(userId) as { t: string | null }).t;
}

/** Drops paid users back to Free once their last pass runs out. Admin-granted Pro (no orders) is left alone. */
export function expireLapsedPasses() {
  return db.prepare(`UPDATE users SET subscription_plan = 'free' WHERE subscription_plan = 'pro' AND id IN
    (SELECT user_id FROM orders WHERE status = 'paid' GROUP BY user_id HAVING max(pro_until) < datetime('now'))`).run().changes;
}
