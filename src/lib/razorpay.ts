import crypto from "node:crypto";
import { db, now } from "./db.ts";
import { PLANS, proPrice, proUntil, type BillingCurrency } from "./plans.ts";
import { track } from "./analytics.ts";

// ponytail: Pro is a 30-day pass bought once via Razorpay Orders, no auto-renewal (no mandates, no cancel flow).
// Move to Razorpay Subscriptions if manual renewal turns out to cost too many users.
export const PASS_DAYS = 30;

const hmac = (secret: string, data: string) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createOrder(userId: number, currency: BillingCurrency = "INR") {
  const { amount: units } = proPrice(currency);
  const amount = units * 100; // paise for INR, cents for USD — Razorpay takes the smallest unit
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency, receipt: `u${userId}-${Date.now()}`, notes: { user_id: String(userId), plan: "pro" } }),
  });
  if (!res.ok) {
    console.error("[razorpay] order create failed", res.status, await res.text());
    throw new Error("Couldn't start checkout. Please try again in a minute.");
  }
  const { id } = (await res.json()) as { id: string };
  db.prepare("INSERT INTO orders (id, user_id, amount) VALUES (?, ?, ?)").run(id, userId, amount);
  return { orderId: id, amount, currency };
}

/** Checkout's success callback: signature = HMAC(order_id|payment_id, key secret). */
export const paymentSignatureValid = (orderId: string, paymentId: string, signature: string) =>
  same(hmac(process.env.RAZORPAY_KEY_SECRET ?? "", `${orderId}|${paymentId}`), signature);

/** Webhook: signature = HMAC(raw body, webhook secret). */
export const webhookSignatureValid = (body: string, signature: string) =>
  Boolean(process.env.RAZORPAY_WEBHOOK_SECRET) && same(hmac(process.env.RAZORPAY_WEBHOOK_SECRET!, body), signature);

/**
 * Grants the pass. Both the checkout callback and the webhook land here, so it is idempotent: only the call that
 * flips the order from 'created' to 'paid' counts. Buying again before the pass ends stacks on top of it.
 * Returns the user who got Pro, or null if the order was unknown or already paid.
 */
export function markOrderPaid(orderId: string, paymentId: string): number | null {
  return db.transaction(() => {
    const order = db.prepare("SELECT user_id FROM orders WHERE id = ? AND status = 'created'").get(orderId) as { user_id: number } | undefined;
    if (!order) return null;
    const current = proUntil(order.user_id), t = now();
    const from = current && current > t ? current : t;
    db.prepare(`UPDATE orders SET status = 'paid', payment_id = ?, paid_at = ?, pro_until = datetime(?, '+${PASS_DAYS} days') WHERE id = ?`)
      .run(paymentId, t, from, orderId);
    db.prepare("UPDATE users SET subscription_plan = 'pro' WHERE id = ?").run(order.user_id);
    track("subscription_started", order.user_id, { via: "razorpay", order: orderId });
    return order.user_id;
  })();
}
