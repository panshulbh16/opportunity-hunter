import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PLANS } from "@/lib/plans";
import { PASS_DAYS } from "@/lib/razorpay";

export const metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="19 September 2026">
      <p>These terms cover your use of Opportunity Hunter, a job-discovery service run by Panshul Bharadwaj, an individual developer based in India. By creating an account you agree to them.</p>

      <h2>The service</h2>
      <ul>
        <li>Opportunity Hunter searches third-party job sources, scores listings against the profile you give it, and helps you track applications.</li>
        <li>It&apos;s provided as-is. Features may change, and there may be downtime.</li>
        <li>We don&apos;t guarantee that you&apos;ll find a job, get an interview, or that any listing is accurate or still open.</li>
      </ul>

      <h2>Job listings</h2>
      <p>Listings come from third-party sources and link to the employer&apos;s own application page. We don&apos;t verify them and aren&apos;t affiliated with the employers or with sites such as LinkedIn or Indeed. Match scores and application drafts are suggestions — check them before relying on them, and review anything before you send it. You&apos;re responsible for the applications you send, including anything drafted by the app.</p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your login to yourself. One account per person.</li>
        <li>Don&apos;t use the service to scrape, spam, or abuse it or others. We may suspend accounts that do; if you had an active Pro pass, we&apos;ll refund the unused days.</li>
        <li>You can delete your account at any time from Settings.</li>
      </ul>

      <h2>Pro plan and payments</h2>
      <ul>
        <li>Pro costs ₹{PLANS.pro.prices.INR} for {PASS_DAYS} days in India, or ${PLANS.pro.prices.USD} where we bill in US dollars, paid once through Razorpay. Which one applies depends on where you are paying from.</li>
        <li>It does <strong>not</strong> renew automatically. When the {PASS_DAYS} days end, your account returns to the Free plan and you keep all your data. Buying again adds another {PASS_DAYS} days.</li>
        <li>If we change the price, passes you&apos;ve already bought aren&apos;t affected.</li>
        <li>Refunds are covered in our <Link className="underline" href="/refunds">Refund policy</Link>.</li>
      </ul>

      <h2>Liability</h2>
      <p>To the extent the law allows, we aren&apos;t liable for indirect losses such as missed opportunities, and our total liability to you is limited to what you paid us in the {PASS_DAYS} days before the claim.</p>

      <h2>Changes and governing law</h2>
      <p>We may update these terms; significant changes will be announced in the app before they apply. These terms are governed by the laws of India. Questions: see <Link className="underline" href="/contact">Contact</Link>.</p>
    </LegalPage>
  );
}
