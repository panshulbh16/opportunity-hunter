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
    price: 499, // INR; see PRO_PRICES for the per-currency table
    prices: { INR: 499, USD: 10 },
    weeklyDiscoveries: Infinity,
    profiles: 5,
    features: [
      "Unlimited opportunities",
      "Continuous monitoring",
      "Daily digest",
      "Application tracking",
      "Match explanations on every listing",
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

export type BillingCurrency = keyof typeof PLANS.pro.prices;
export const CURRENCY_SYMBOL: Record<BillingCurrency, string> = { INR: "₹", USD: "$" };

/** Razorpay needs international cards enabled before it can take anything but INR. */
export const internationalEnabled = () => process.env.RAZORPAY_INTERNATIONAL === "true";

/**
 * What to charge this visitor. India pays ₹499, everyone else $10 — but only where the country is
 * actually known (Cloudflare's header). Without that evidence we bill INR rather than overcharge
 * an Indian user whose browser reports a US locale.
 */
export function billingCurrency(h: { get(name: string): string | null }): BillingCurrency {
  if (!internationalEnabled()) return "INR";
  const country = (h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? "").toUpperCase();
  if (country) return country === "IN" || country === "XX" ? "INR" : "USD";
  return "INR"; // no country header (e.g. Cloudflare proxy off) — bill the home market
}

export const proPrice = (currency: BillingCurrency) => ({
  currency,
  amount: PLANS.pro.prices[currency],
  display: `${CURRENCY_SYMBOL[currency]}${PLANS.pro.prices[currency]}`,
});

/** End of the user's paid Pro time (UTC, "YYYY-MM-DD HH:MM:SS"), or null if they never bought a pass. */
export function proUntil(userId: number) {
  return (db.prepare("SELECT max(pro_until) AS t FROM orders WHERE user_id = ? AND status = 'paid'").get(userId) as { t: string | null }).t;
}

/** Drops paid users back to Free once their last pass runs out. Admin-granted Pro (no orders) is left alone. */
export function expireLapsedPasses() {
  return db.prepare(`UPDATE users SET subscription_plan = 'free' WHERE subscription_plan = 'pro' AND id IN
    (SELECT user_id FROM orders WHERE status = 'paid' GROUP BY user_id HAVING max(pro_until) < datetime('now'))`).run().changes;
}
