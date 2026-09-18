import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PASS_DAYS } from "@/lib/razorpay";

export const metadata = { title: "Cancellation & Refund Policy" };

const REFUND_WINDOW_DAYS = 7;

export default function Refunds() {
  return (
    <LegalPage title="Cancellation & Refund Policy" updated="19 September 2026">
      <h2>Cancellation</h2>
      <p>There&apos;s nothing to cancel. Pro is a one-time {PASS_DAYS}-day pass, not a subscription: we never charge you again unless you choose to buy another pass. When it ends, your account returns to Free and keeps all your data.</p>

      <h2>Refunds</h2>
      <ul>
        <li>Not happy with Pro? Ask for a full refund within <strong>{REFUND_WINDOW_DAYS} days</strong> of buying it — no questions asked. Your account returns to Free when the refund is issued.</li>
        <li>Charged twice, or charged but Pro didn&apos;t turn on? Tell us any time and we&apos;ll activate your pass or refund the extra payment.</li>
        <li>After {REFUND_WINDOW_DAYS} days, passes aren&apos;t refundable except where the law requires it or we suspended your account (see <Link className="underline" href="/terms">Terms</Link>).</li>
      </ul>
      <p>Approved refunds go back to your original payment method through Razorpay, usually within 5–7 working days depending on your bank.</p>

      <h2>How to ask</h2>
      <p>Email us from the address on your account, with the Razorpay payment ID (it starts with <code>pay_</code> and is in your receipt email). Details on the <Link className="underline" href="/contact">Contact</Link> page.</p>

      <h2>Delivery</h2>
      <p>Pro is a digital service. It&apos;s active on your account as soon as your payment succeeds; nothing is shipped.</p>
    </LegalPage>
  );
}
