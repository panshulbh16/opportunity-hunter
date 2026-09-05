import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatSalary } from "@/lib/ai";
import { parseOpp } from "@/lib/queries";
import { Logo, titleCase } from "@/components/ui";

// Stand-in for an employer's job page, so demo listings have somewhere real to link to.
export default async function DemoListing({ params }: { params: Promise<{ slug: string[] }> }) {
  const path = `/demo/${(await params).slug.join("/")}`.replace(/\/apply$/, "");
  const row = db.prepare("SELECT * FROM opportunities WHERE is_demo = 1 AND source_url LIKE ?").get(`${path}%`) as Record<string, unknown> | undefined;
  if (!row) notFound();
  const o = parseOpp(row);
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex h-16 items-center px-6"><Link href="/dashboard"><Logo /></Link></header>
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-4">
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Sample listing.</span> This is demo data shipped with Opportunity Hunter. Real listings link to the employer&apos;s own application page.
        </div>
        <article className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{o.company}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{o.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">{o.location} · {titleCase(o.employment_type)} · {formatSalary(o)}</p>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-zinc-700">{o.description}</p>
          <h2 className="mt-6 text-sm font-semibold text-zinc-900">Requirements</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {o.min_years > 0 && <li>{o.min_years}+ years of experience</li>}
            {o.skills.map((s) => <li key={s}>{s}</li>)}
            {o.nice_to_have.map((s) => <li key={s} className="text-zinc-500">{s} (nice to have)</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-6">
            <button type="button" disabled className="btn-primary opacity-50">Apply (demo — no form)</button>
            <Link href={`/opportunities/${o.id}`} className="btn-secondary">Back to AI analysis</Link>
          </div>
        </article>
      </main>
    </div>
  );
}
