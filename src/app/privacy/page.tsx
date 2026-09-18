import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata = { title: "Privacy & Terms" };

// Every statement here should stay true of the code. If you add a tracker, a data processor,
// or change retention, update this page in the same change.
const UPDATED = "18 September 2026";

export default function Privacy() {
  const contact = process.env.SUPPORT_EMAIL;
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6"><Link href="/"><Logo /></Link></div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14 text-[15px] leading-relaxed text-zinc-700 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:mt-1.5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mt-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Privacy &amp; Terms</h1>
        <p className="text-sm text-zinc-500">Last updated {UPDATED}</p>
        <p>Opportunity Hunter is in early access and free to use. This page explains, in plain language, what we collect, why, and the terms of using the service.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details</strong> — your name, email, and password. Passwords are stored only as a salted hash; we can&apos;t read them.</li>
          <li><strong>Your search profile</strong> — the roles, skills, experience, locations, salary range and preferences you enter.</li>
          <li><strong>Your activity</strong> — which opportunities you save, reject or apply to, plus any notes and follow-up dates you add to the tracker.</li>
          <li><strong>Basic usage events</strong> — for example that you signed up or ran a search — so we can see what works and fix what doesn&apos;t.</li>
        </ul>

        <h2>How we use it</h2>
        <p>Only to run the service: finding and scoring job listings against your profile, showing your matches, tracking your applications, and emailing you (password resets, and match alerts if you turn them on). We don&apos;t sell your data, show ads, or use third-party tracking.</p>

        <h2>Who else handles it</h2>
        <ul>
          <li><strong>Railway</strong> hosts the app and its database.</li>
          <li><strong>Resend</strong> delivers our emails, so it receives your email address and the message.</li>
          <li><strong>JSearch (via RapidAPI)</strong> supplies job listings. We send it only search terms such as a job title and location — never your name, email, or profile.</li>
        </ul>

        <h2>Cookies</h2>
        <p>One cookie, to keep you logged in. No advertising or analytics cookies.</p>

        <h2>Keeping and deleting your data</h2>
        <p>We keep your data while your account exists. You can delete your account at any time from <strong>Settings</strong>; this permanently removes your profile, matches, saved jobs and applications. Daily backups are kept for up to 7 days, so deleted data is fully gone within a week.</p>

        <h2>Job listings</h2>
        <p>Listings come from third-party sources and link to the employer&apos;s own application page. We don&apos;t verify them and aren&apos;t affiliated with the employers or with sites such as LinkedIn or Indeed. Match scores and application drafts are suggestions — check them before relying on them, and review anything before you send it.</p>

        <h2>Terms of use</h2>
        <ul>
          <li>The service is provided as-is during early access. Features may change and there may be downtime.</li>
          <li>Keep your login to yourself, and don&apos;t use the service to scrape, spam, or abuse it or others. We may suspend accounts that do.</li>
          <li>You&apos;re responsible for the applications you send, including anything drafted by the app.</li>
          <li>We may update this page; significant changes will be announced in the app.</li>
        </ul>

        <h2>Contact</h2>
        <p>{contact ? <>Questions or data requests: <a className="underline" href={`mailto:${contact}`}>{contact}</a>.</> : "Questions or data requests: reply to any email you've received from us."}</p>
      </main>
    </div>
  );
}
