import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { getMatch } from "@/lib/queries";
import { formatSalary, recommendNextAction } from "@/lib/ai";
import { track } from "@/lib/analytics";
import { Check, ScoreBadge, Warn, scoreTone, timeAgo, titleCase } from "@/components/ui";
import { OppActions } from "@/components/OppActions";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = parseInt((await params).id);
  if (!Number.isFinite(id)) notFound();
  const item = getMatch(user.id, id);
  if (!item) notFound();
  const { match: m, opp: o } = item;
  if (!m.viewed_at) {
    db.prepare("UPDATE matches SET viewed_at = ?, status = CASE WHEN status = 'new' THEN 'viewed' ELSE status END WHERE id = ?").run(now(), m.id);
    track("opportunity_viewed", user.id, { oppId: o.id, score: m.score });
  }
  const e = m.explanation;
  const next = recommendNextAction(m.score, e);
  const applied = ["applied", "interview", "offer"].includes(m.application_status ?? "");
  const breakdown = [["Skills", m.skills_score], ["Experience", m.experience_score], ["Location", m.location_score], ["Salary", m.salary_score], ["Role", m.role_score]] as const;
  const diffTone = { low: "text-emerald-700 bg-emerald-50", medium: "text-amber-700 bg-amber-50", high: "text-red-700 bg-red-50" }[e.difficulty];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/opportunities" className="text-sm text-zinc-500 hover:text-zinc-900">← Opportunities</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card p-6 rise-in">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{o.title}</h1>
                <p className="mt-1 text-zinc-600">{o.company}{o.company_type && <span className="text-zinc-400"> · {titleCase(o.company_type)} company</span>}</p>
              </div>
              <ScoreBadge score={m.score} size="lg" />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[["Location", o.location], ["Salary", formatSalary(o)], ["Employment type", titleCase(o.employment_type)], ["Posted", `${timeAgo(o.posted_date)} (${o.posted_date})`], ["Source", o.source], ["Experience", `${o.min_years}+ years · ${titleCase(o.seniority)}`]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd className="mt-0.5 font-medium text-zinc-800">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <OppActions oppId={o.id} saved={Boolean(m.saved)} applied={applied} applyUrl={o.application_url} variant="page" />
              {o.is_demo ? <p className="mt-3 text-xs text-zinc-400">Demo listing — the apply link is a placeholder until a live source is connected.</p> : null}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">About the role</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">{o.description}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {o.skills.map((s) => <span key={s} className="chip">{s}</span>)}
              {o.nice_to_have.map((s) => <span key={s} className="chip bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200">{s} (plus)</span>)}
            </div>
            <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">View original listing ↗</a>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5 rise-in" style={{ animationDelay: "60ms" }}>
            <h2 className="text-sm font-semibold text-zinc-900">AI Analysis</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{m.score}<span className="text-base font-normal text-zinc-400">/100</span></p>
            <div className="mt-4 space-y-2.5">
              {breakdown.map(([k, s]) => (
                <div key={k}>
                  <div className="flex justify-between text-xs"><span className="text-zinc-600">{k}</span><span className="font-medium tabular-nums text-zinc-800">{s}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className={`h-full rounded-full ${s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-amber-400" : "bg-zinc-400"}`} style={{ width: `${s}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-zinc-900">Why you match</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-zinc-700">
              {e.strengths.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{s}</li>)}
              {!e.strengths.length && <li className="text-zinc-400">Few overlaps with your profile.</li>}
            </ul>
            <h3 className="mt-5 text-sm font-semibold text-zinc-900">Potential gaps</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-zinc-600">
              {e.gaps.map((g) => <li key={g} className="flex gap-2"><Warn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{g}</li>)}
              {!e.gaps.length && <li className="text-zinc-400">None detected.</li>}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-zinc-900">Application difficulty</h3>
            <p className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${diffTone}`}>{e.difficulty}</p>
            <p className="mt-2 text-[13px] text-zinc-600">{e.difficultyReason}</p>
            <h3 className="mt-5 text-sm font-semibold text-zinc-900">Recommended action</h3>
            <p className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${scoreTone(m.score)}`}>{next.label}</p>
            <p className="mt-2 text-[13px] text-zinc-600">{next.reason}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
