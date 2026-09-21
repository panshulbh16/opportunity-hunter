import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Check, Logo } from "@/components/ui";
import { LEGAL_LINKS } from "@/components/LegalPage";
import { LandingMatchPreview } from "@/components/LandingMatchPreview";
import { resumeImportConfigured } from "@/lib/ai/resume";
import { getProfile, listMatches } from "@/lib/queries";
import { formatSalary } from "@/lib/ai";
import { sampleLandingMatch, scoreAgainstProfile, type LandingMatchView } from "@/lib/landingMatch";

const STEPS = [
  ["Tell us what you want", "Roles, skills, location, salary and the kind of company you'd join. Two minutes, once."],
  ["Our AI hunts for opportunities", "The agent searches every configured source on your schedule, removes duplicates and filters noise."],
  ["We score every opportunity", "Each listing gets a 0–100 match score with a plain-English explanation of why — and what's missing."],
  ["You apply to the best ones", "Save, reject or apply in one click. Track every application through interview to offer."],
];

const FEATURES = [
  ["AI Match Score", "The number is calculated from the resume or search profile you save — skills, role, experience, location and salary — not a canned 92%."],
  ["Continuous Opportunity Monitoring", "Daily, twice daily or weekly. The hunt runs whether or not you log in."],
  ["Duplicate Removal", "The same job on three boards shows up once, with the earliest posting."],
  ["Personalized Match Explanation", "Every score comes with why it matches and what could hold you back."],
  ["Application Tracker", "A simple pipeline from saved to offer, with notes and follow-up dates."],
  ["Daily Opportunity Digest", "One email with the new matches that clear your threshold. Nothing else."],
];

export default async function Landing() {
  const user = await getUser();
  const profile = user ? getProfile(user.id) : null;
  const top = user ? listMatches(user.id, { limit: 1 })[0] : undefined;
  let initial: LandingMatchView;
  if (top?.match) {
    const o = top.opp, m = top.match;
    initial = {
      title: o.title, company: o.company, location: o.location,
      salary: formatSalary(o) || "Salary not listed",
      employment: o.employment_type === "full-time" ? "Full-time" : o.employment_type,
      score: m.score, strengths: m.explanation.strengths.slice(0, 4), gaps: m.explanation.gaps.slice(0, 2),
      caption: `Scored against your search profile${profile?.current_role || profile?.roles[0] ? `: ${profile.current_role || profile.roles[0]}${profile.years_experience ? ` · ${profile.years_experience} years` : ""}` : ""}.`,
      ctaHref: `/opportunities/${o.id}`, ctaLabel: "View Opportunity",
    };
  } else if (profile) {
    initial = await scoreAgainstProfile(profile, "profile", { href: "/dashboard", label: "Open dashboard" });
  } else {
    initial = await sampleLandingMatch();
  }
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
                {["Scored against your resume or search profile, not a canned number", "Gaps called out before you apply", "Rejected listings never come back"].map((t) => (
                  <li key={t} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 text-emerald-600" />{t}</li>
                ))}
              </ul>
            </div>
            <LandingMatchPreview initial={initial} resumeImport={resumeImportConfigured && !top?.match} />
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
