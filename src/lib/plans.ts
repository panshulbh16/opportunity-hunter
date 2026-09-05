import { db } from "./db";

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    weeklyDiscoveries: 5,
    profiles: 1,
    features: ["5 new opportunities per week", "Basic matching", "Basic application tracker", "One search profile"],
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
