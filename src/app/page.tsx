import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Check, Logo, ScoreBadge, Warn } from "@/components/ui";
import { LEGAL_LINKS } from "@/components/LegalPage";

const STEPS = [
  ["Tell us what you want", "Roles, skills, location, salary and the kind of company you'd join. Two minutes, once."],
  ["Our AI hunts for opportunities", "The agent searches every configured source on your schedule, removes duplicates and filters noise."],
  ["We score every opportunity", "Each listing gets a 0–100 match score with a plain-English explanation of why — and what's missing."],
  ["You apply to the best ones", "Save, reject or apply in one click. Track every application through interview to offer."],
];

const FEATURES = [
  ["AI Match Score", "Skills, role, experience, location, salary and preferences — weighed into one honest number."],
  ["Continuous Opportunity Monitoring", "Daily, twice daily or weekly. The hunt runs whether or not you log in."],
  ["Duplicate Removal", "The same job on three boards shows up once, with the earliest posting."],
  ["Personalized Match Explanation", "Every score comes with why it matches and what could hold you back."],
  ["Application Tracker", "A simple pipeline from saved to offer, with notes and follow-up dates."],
  ["Daily Opportunity Digest", "One email with the new matches that clear your threshold. Nothing else."],
];

export default async function Landing() {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="btn-ghost hidden sm:inline-flex">How it works</a>
            <Link href="/pricing" className="btn-ghost">Pricing</Link>
            {user ? <Link href="/dashboard" className="btn-primary ml-2">Open dashboard</Link> : (
              <>
                <Link href="/login" className="btn-ghost">Log in</Link>
                <Link href="/signup" className="btn-primary ml-2">Start Hunting Free</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center sm:pt-32">
        <p className="rise-in mb-5 text-[13px] font-medium uppercase tracking-[0.18em] text-zinc-500">AI job-hunting agent</p>
        <h1 className="rise-in mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl" style={{ animationDelay: "60ms" }}>
          Stop Searching.<br />Start Getting Matched.
        </h1>
        <p className="rise-in mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600" style={{ animationDelay: "120ms" }}>
          Opportunity Hunter continuously finds jobs that match your skills, experience, location and salary expectations — so you don&apos;t have to search every day.
        </p>
        <div className="rise-in mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "180ms" }}>
          <Link href="/signup" className="btn-primary h-11 px-6 text-[15px]">Start Hunting Free</Link>
          <a href="#how" className="btn-secondary h-11 px-6 text-[15px]">See How It Works</a>
        </div>
        <p className="mt-4 text-xs text-zinc-400">Free plan · No card required · Set up in under 3 minutes</p>
      </section>

      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">Every match, explained.</h2>
              <p className="mt-4 text-zinc-600 leading-relaxed">
                A score without a reason is noise. Every opportunity comes with what matched, what didn&apos;t, and what to do about it — so you can decide in seconds, not after reading a 900-word description.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-zinc-700">
                {["Scored against your real profile, not keywords", "Gaps called out before you apply", "Rejected listings never come back"].map((t) => (
                  <li key={t} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 text-emerald-600" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,0,0,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-900">Registered Nurse — ICU</h3>
                  <p className="mt-0.5 text-sm text-zinc-600">Example Hospital</p>
                </div>
                <ScoreBadge score={92} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 text-[13px] text-zinc-500"><span>Mumbai, India</span><span className="font-medium text-zinc-700">₹6–9 LPA</span><span>Full-time</span></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Why this matches</p>
              <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
                {["Critical care experience", "BLS & ACLS certified", "4+ years experience", "Mumbai preference"].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />{t}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Potential concern</p>
              <ul className="mt-2 text-[13px] text-zinc-600"><li className="flex gap-2"><Warn className="mt-0.5 h-3.5 w-3.5 text-amber-500" />Night shifts required</li></ul>
              <div className="mt-5 border-t border-zinc-100 pt-4"><Link href="/signup" className="btn-primary btn-sm">View Opportunity</Link></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">How it works</h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <div key={t}>
              <div className="mb-4 grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">{i + 1}</div>
              <h3 className="font-semibold text-zinc-900">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">Built for people who&apos;d rather be interviewing than scrolling</h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="bg-white p-6">
                <h3 className="font-semibold text-zinc-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">Tell us what you want. We&apos;ll keep hunting for it.</h2>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary h-11 px-6 text-[15px]">Start Hunting Free</Link>
          <Link href="/pricing" className="btn-secondary h-11 px-6 text-[15px]">See pricing</Link>
        </div>
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500">
          <Logo className="text-sm" />
          <div className="flex flex-wrap gap-x-6 gap-y-2"><Link href="/pricing" className="hover:text-zinc-900">Pricing</Link>{LEGAL_LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:text-zinc-900">{label}</Link>)}<Link href="/login" className="hover:text-zinc-900">Log in</Link></div>
        </div>
      </footer>
    </div>
  );
}
