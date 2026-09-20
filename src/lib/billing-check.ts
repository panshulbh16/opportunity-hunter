// Self-check for Pro passes: `npm run check`. Runs against a throwaway database.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oh-billing-"));
process.env.DATABASE_PATH = path.join(dir, "app.db");
process.env.RAZORPAY_KEY_SECRET = "key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "hook_secret";

const { db } = await import("./db.ts");
const { proUntil, expireLapsedPasses, billingCurrency, proPrice } = await import("./plans.ts");
const { markOrderPaid, paymentSignatureValid, webhookSignatureValid } = await import("./razorpay.ts");

const sign = (secret: string, data: string) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const user = (email: string, plan = "free") => Number(db.prepare("INSERT INTO users (name, email, subscription_plan) VALUES ('T', ?, ?)").run(email, plan).lastInsertRowid);
const order = (id: string, userId: number) => db.prepare("INSERT INTO orders (id, user_id, amount) VALUES (?, ?, 49900)").run(id, userId);
const plan = (id: number) => (db.prepare("SELECT subscription_plan p FROM users WHERE id = ?").get(id) as { p: string }).p;
const daysLeft = (id: number) => (db.prepare("SELECT julianday(?) - julianday('now') d").get(proUntil(id)) as { d: number }).d;

// Signatures: only Razorpay's HMAC passes; tampering or a wrong-length value fails without throwing.
assert.ok(paymentSignatureValid("order_1", "pay_1", sign("key_secret", "order_1|pay_1")));
assert.ok(!paymentSignatureValid("order_1", "pay_2", sign("key_secret", "order_1|pay_1")), "signature bound to the payment");
assert.ok(!paymentSignatureValid("order_1", "pay_1", "short"), "wrong length rejected");
assert.ok(webhookSignatureValid('{"a":1}', sign("hook_secret", '{"a":1}')));
assert.ok(!webhookSignatureValid('{"a":2}', sign("hook_secret", '{"a":1}')), "webhook body tampering rejected");

// Paying grants 30 days; the callback + webhook double-delivery grants it once.
const a = user("a@x.com");
order("order_a1", a);
assert.equal(markOrderPaid("order_a1", "pay_a1"), a);
assert.equal(markOrderPaid("order_a1", "pay_a1"), null, "second delivery is a no-op");
assert.equal(plan(a), "pro");
assert.ok(Math.abs(daysLeft(a) - 30) < 0.01, "first pass = 30 days");
assert.equal(markOrderPaid("order_unknown", "pay_x"), null, "unknown order grants nothing");

// Buying again before the pass ends stacks rather than resetting.
order("order_a2", a);
markOrderPaid("order_a2", "pay_a2");
assert.ok(Math.abs(daysLeft(a) - 60) < 0.01, "second pass stacks to 60 days");

// Expiry drops lapsed payers to Free and leaves admin-granted Pro alone.
const b = user("b@x.com"), gift = user("gift@x.com", "pro");
order("order_b1", b);
markOrderPaid("order_b1", "pay_b1");
db.prepare("UPDATE orders SET pro_until = datetime('now', '-1 minute') WHERE id = 'order_b1'").run();
assert.equal(expireLapsedPasses(), 1);
assert.equal(plan(b), "free", "lapsed pass expires");
assert.equal(plan(a), "pro", "active pass untouched");
assert.equal(plan(gift), "pro", "admin-granted Pro untouched");

// A lapsed buyer who pays again starts a fresh 30 days from now, not from the old end date.
order("order_b2", b);
markOrderPaid("order_b2", "pay_b2");
assert.equal(plan(b), "pro");
assert.ok(Math.abs(daysLeft(b) - 30) < 0.01, "renewal after lapse starts from now");

// Currency: INR unless the request proves the payer is outside India. Never overcharge on a guess.
const hdrs = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
assert.equal(billingCurrency(hdrs({ "cf-ipcountry": "US" })), "INR", "USD stays off until RAZORPAY_INTERNATIONAL=true");
process.env.RAZORPAY_INTERNATIONAL = "true";
const billing = billingCurrency, price = proPrice;
assert.equal(billing(hdrs({ "cf-ipcountry": "US" })), "USD", "a US visitor pays in dollars");
assert.equal(billing(hdrs({ "cf-ipcountry": "IN" })), "INR", "an Indian visitor pays in rupees");
assert.equal(billing(hdrs({ "cf-ipcountry": "XX" })), "INR", "unknown country falls back to INR");
assert.equal(billing(hdrs({ "accept-language": "en-US,en;q=0.9" })), "INR", "browser locale alone never triggers USD");
assert.deepEqual(price("INR"), { currency: "INR", amount: 499, display: "₹499" });
assert.deepEqual(price("USD"), { currency: "USD", amount: 10, display: "$10" });
delete process.env.RAZORPAY_INTERNATIONAL;

db.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("billing check passed");
