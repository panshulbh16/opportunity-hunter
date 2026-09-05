import { requireUser } from "@/lib/auth";
import { listMatches, listSaved, type Filters } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { OpportunityCard } from "@/components/OpportunityCard";

export const metadata = { title: "Opportunities" };

type SP = Record<string, string | undefined>;

export default async function Opportunities({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const num = (k: string) => (sp[k] && Number.isFinite(parseFloat(sp[k]!)) ? parseFloat(sp[k]!) : undefined);
  const f: Filters = {
    q: sp.q?.slice(0, 100), minScore: num("minScore"), location: sp.location?.slice(0, 60), remote: sp.remote, minSalary: num("minSalary"),
    maxYears: num("maxYears"), type: sp.type, postedDays: num("postedDays"), company: sp.company?.slice(0, 60), skill: sp.skill?.slice(0, 40),
    sort: sp.sort, status: sp.status === "rejected" ? "rejected" : undefined,
  };
  const items = sp.status === "saved" ? listSaved(user.id) : listMatches(user.id, f);
  const active = Object.entries(sp).filter(([k, v]) => v && k !== "sort" && k !== "hidden").length;

  return (
    <>
      <PageHeader title={sp.status === "saved" ? "Saved opportunities" : sp.status === "rejected" ? "Rejected opportunities" : "Opportunities"} description={`${items.length} ${items.length === 1 ? "result" : "results"}${active ? ` · ${active} ${active === 1 ? "filter" : "filters"} active` : ""}`}>
        {sp.hidden && <span className="text-sm text-zinc-500">Hid {sp.hidden} similar {sp.hidden === "1" ? "opportunity" : "opportunities"}.</span>}
      </PageHeader>

      <form className="card mb-6 p-4" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <div className="flex flex-col gap-3 md:flex-row">
          <input name="q" defaultValue={sp.q} placeholder="Search title, company, skills…" className="input md:flex-1" />
          <select name="sort" defaultValue={sp.sort ?? "best"} className="input md:w-44">
            <option value="best">Best Match</option><option value="newest">Newest</option><option value="salary">Salary</option><option value="relevance">Relevance</option>
          </select>
          <button type="submit" className="btn-primary">Apply</button>
        </div>
        <details className="mt-3 group" open={active > 0}>
          <summary className="cursor-pointer list-none text-[13px] font-medium text-zinc-500 hover:text-zinc-900">Filters <span className="text-zinc-400 group-open:hidden">(show)</span></summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="label">Match score</label><select name="minScore" defaultValue={sp.minScore ?? ""} className="input"><option value="">Any</option>{[90, 80, 70, 60, 50].map((n) => <option key={n} value={n}>{n}%+</option>)}</select></div>
            <div><label className="label">Location</label><input name="location" defaultValue={sp.location} placeholder="India, Berlin…" className="input" /></div>
            <div><label className="label">Remote</label><select name="remote" defaultValue={sp.remote ?? ""} className="input"><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></div>
            <div><label className="label">Min salary (₹/year)</label><select name="minSalary" defaultValue={sp.minSalary ?? ""} className="input"><option value="">Any</option>{[10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n * 1e5}>₹{n} LPA+</option>)}</select></div>
            <div><label className="label">Experience required</label><select name="maxYears" defaultValue={sp.maxYears ?? ""} className="input"><option value="">Any</option>{[0, 2, 3, 4, 5, 8].map((n) => <option key={n} value={n}>≤ {n} years</option>)}</select></div>
            <div><label className="label">Job type</label><select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Any</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select></div>
            <div><label className="label">Date posted</label><select name="postedDays" defaultValue={sp.postedDays ?? ""} className="input"><option value="">Any time</option><option value="1">Last 24 hours</option><option value="3">Last 3 days</option><option value="7">Last week</option><option value="30">Last month</option></select></div>
            <div><label className="label">Company</label><input name="company" defaultValue={sp.company} className="input" /></div>
            <div><label className="label">Skill</label><input name="skill" defaultValue={sp.skill} placeholder="Python" className="input" /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary btn-sm">Apply filters</button>
            <a href={sp.status ? `/opportunities?status=${sp.status}` : "/opportunities"} className="btn-ghost btn-sm">Reset</a>
          </div>
        </details>
      </form>

      <div className="mb-4 flex gap-1 text-[13px]">
        {[["", "All"], ["saved", "Saved"], ["rejected", "Rejected"]].map(([s, l]) => (
          <a key={s} href={s ? `/opportunities?status=${s}` : "/opportunities"} className={`rounded-md px-2.5 py-1 font-medium ${(sp.status ?? "") === s ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>{l}</a>
        ))}
      </div>

      {items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">{items.map((item, i) => <OpportunityCard key={item.match.id} item={item} index={i} />)}</div>
      ) : sp.status === "saved" ? (
        <EmptyState title="Nothing saved yet." body="When you find an opportunity worth pursuing, save it here." cta="Find Opportunities" href="/opportunities" />
      ) : sp.status === "rejected" ? (
        <EmptyState title="Nothing rejected." body="Opportunities you reject stay here and never come back to your feed." />
      ) : (
        <EmptyState title="No opportunities match these filters." body={active ? "Try loosening a filter or two." : "The agent will keep hunting. You can also broaden your search profile."} cta={active ? "Clear filters" : "Edit search profile"} href={active ? "/opportunities" : "/profile"} />
      )}
    </>
  );
}
