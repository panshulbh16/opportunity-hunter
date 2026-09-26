import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CookieSettingsButton } from "@/components/Analytics";

// Rendered per request so a deploy is visible immediately (no year-long s-maxage on prebuilt HTML).
export const dynamic = "force-dynamic";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="26 September 2026">
      <p>Opportunity Hunter is free to use, with an optional paid Pro plan. This page explains, in plain language, what we collect and why.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — your name, email, and password. Passwords are stored only as a salted hash; we can&apos;t read them.</li>
        <li><strong>Your search profile</strong> — the roles, skills, experience, locations, salary range and preferences you enter.</li>
        <li><strong>Your resume, only if you import one</strong> — it&apos;s read once to suggest profile fields, then discarded. We don&apos;t store the file; only the fields you review and save are kept.</li>
        <li><strong>Your activity</strong> — which opportunities you save, reject or apply to, plus any notes and follow-up dates you add to the tracker.</li>
        <li><strong>Payments</strong>, if you buy Pro — the amount, date, and Razorpay order and payment IDs. Your card, UPI and bank details go straight to Razorpay; we never see or store them.</li>
        <li><strong>Basic usage events</strong> — for example that you signed up or ran a search — so we can see what works and fix what doesn&apos;t.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to run the service: finding and scoring job listings against your profile, showing your matches, tracking your applications, activating Pro when you pay, and emailing you (password resets, and match alerts if you turn them on). We don&apos;t sell your data or show ads. With your permission we use Google Analytics to see how the site is used (see Cookies below).</p>

      <h2>Who else handles it</h2>
      <ul>
        <li><strong>Railway</strong> hosts the app and its database.</li>
        <li><strong>Resend</strong> delivers our emails, so it receives your email address and the message.</li>
        <li><strong>Anthropic</strong> reads a resume you choose to import, to suggest your profile fields. Under its commercial terms it doesn&apos;t use this data to train its models.</li>
        <li><strong>Razorpay</strong> processes Pro payments. It receives your name, email and payment details, under its own <a className="underline" href="https://razorpay.com/privacy/">privacy policy</a>.</li>
        <li><strong>Google Analytics</strong> measures which pages are visited and how the site is used, to help us improve it. Advertising features are off. See Cookies below.</li>
        <li><strong>JSearch (via RapidAPI)</strong> supplies job listings. We send it only search terms such as a job title and location — never your name, email, or profile.</li>
      </ul>

      <h2>Cookies</h2>
      <p>One cookie keeps you logged in. Google Analytics cookies are set only if you click Accept on the cookie banner; until then Google receives only cookieless, anonymous signals. There are no advertising cookies. Razorpay&apos;s checkout window sets its own cookies while you pay. You can change your analytics choice at any time: <CookieSettingsButton className="underline" />.</p>

      <h2>Keeping and deleting your data</h2>
      <p>We keep your data while your account exists. You can delete your account at any time from <strong>Settings</strong>; this permanently removes your profile, matches, saved jobs, applications and our payment records. Daily backups are kept for up to 7 days, so deleted data is fully gone within a week. Razorpay keeps its own record of payments as the law requires.</p>

      <h2>Contact</h2>
      <p>Questions or data requests: see <Link className="underline" href="/contact">Contact</Link>.</p>
    </LegalPage>
  );
}
