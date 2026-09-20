import Link from "next/link";
import type { MatchWithOpp } from "@/lib/queries";
import { formatSalary } from "@/lib/ai";
import { Check, ScoreBadge, Warn, timeAgo, titleCase } from "./ui";
import { OppActions } from "./OppActions";

export function OpportunityCard({ item, index = 0 }: { item: MatchWithOpp; index?: number }) {
  const { match: m, opp: o } = item;
  return (
    <article className="card rise-in p-5 transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/opportunities/${o.id}`} className="block text-[15px] font-semibold text-zinc-900 hover:underline decoration-zinc-300 underline-offset-4">
            {o.title}
          </Link>
          <p className="mt-0.5 text-sm text-zinc-600">{o.company}</p>
          {item.closed && <p className="mt-1.5 text-[13px] font-medium text-amber-700">Listing closed — the employer has taken this one down.</p>}
        </div>
        {m ? <ScoreBadge score={m.score} /> : item.liveScore != null ? <ScoreBadge score={item.liveScore} /> : <span className="chip shrink-0 text-zinc-500">Not scored</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-zinc-500">
        <span>{o.location}</span>
        <span className="font-medium text-zinc-700">{formatSalary(o)}</span>
        <span>{titleCase(o.employment_type)}</span>
        <span>Posted {timeAgo(o.posted_date)}</span>
        <span className="text-zinc-400">via {o.source}</span>
        {m?.status === "new" && <span className="rounded bg-indigo-50 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">New</span>}
      </div>
      {m ? (
        <>
          <div className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <ul className="space-y-1">
              {m.explanation.strengths.slice(0, 3).map((s) => (
                <li key={s} className="flex gap-2 text-zinc-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{s}</li>
              ))}
            </ul>
            <ul className="space-y-1">
              {m.explanation.gaps.slice(0, 2).map((g) => (
                <li key={g} className="flex gap-2 text-zinc-600"><Warn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{g}</li>
              ))}
              {m.explanation.gaps.length === 0 && <li className="text-zinc-400">No notable gaps</li>}
            </ul>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
            <OppActions oppId={o.id} saved={Boolean(m.saved)} applied={["applied", "interview", "offer"].includes(m.application_status ?? "")} applyUrl={o.application_url} />
            <Link href={`/opportunities/${o.id}`} className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900">Details →</Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-zinc-600">{o.description}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
            <a href={o.application_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">View listing ↗</a>
            <Link href={`/opportunities/${o.id}`} className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900">{item.liveScore != null ? "See analysis →" : "Details →"}</Link>
          </div>
        </>
      )}
    </article>
  );
}
