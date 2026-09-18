import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboardStats, getProfile, listMatches } from "@/lib/queries";
import { PLANS, remainingDiscoveries } from "@/lib/plans";
import { EmptyState, PageHeader, timeAgo } from "@/components/ui";
import { OpportunityCard } from "@/components/OpportunityCard";
import { RunSearchButton } from "@/components/RunSearchButton";
import { UpgradeButton } from "@/components/UpgradeButton";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const stats = dashboardStats(user.id);
  const profile = getProfile(user.id);
  const best = listMatches(user.id, { limit: 6 });
  const remaining = remainingDiscoveries(user.id, user.subscription_plan);
  const cards = [["New Opportunities", stats.newOpps, "/opportunities"], ["High Matches", stats.highMatches, "/opportunities?minScore=80"], ["Saved", stats.saved, "/opportunities?status=saved"], ["Applications", stats.applications, "/applications"], ["Follow-ups", stats.followUps, "/applications"]] as const;

  return (
    <>
      {welcome && (
        <div className="mb-6 rounded-xl bg-zinc-900 p-5 text-white rise-in">
          <p className="font-semibold">Your first hunt is done.</p>
          <p className="mt-1 text-sm text-zinc-300">The agent scored every opportunity it found against your profile. It will keep hunting {profile?.search_frequency === "weekly" ? "weekly" : profile?.search_frequency === "twice_daily" ? "twice a day" : "daily"} from here.</p>
        </div>
      )}
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`} description={profile?.last_run_at ? `Last hunt ${timeAgo(profile.last_run_at)} · next one runs ${profile.search_frequency.replace("_", " ")}` : "The agent hasn't run yet."}>
        <RunSearchButton />
      </PageHeader>

      {user.subscription_plan === "free" && (
        <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${remaining === 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-zinc-200 bg-white text-zinc-600"}`}>
          <span>{remaining === 0 ? `You've seen this week's ${PLANS.free.weeklyDiscoveries} new opportunities — more arrive as your weekly allowance frees up.` : `${remaining} of ${PLANS.free.weeklyDiscoveries} new opportunities left this week.`}</span>
          <UpgradeButton label="Get unlimited with Pro" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, n, href], i) => (
          <Link key={label} href={href} className="card rise-in p-4 transition-colors hover:border-zinc-300" style={{ animationDelay: `${i * 40}ms` }}>
            <p className="text-[13px] text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{n}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 mb-4 flex items-end justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Best Matches For You</h2>
        <Link href="/opportunities" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">View all →</Link>
      </div>
      {best.length ? (
        <div className="grid gap-4 lg:grid-cols-2">{best.map((item, i) => <OpportunityCard key={item.match.id} item={item} index={i} />)}</div>
      ) : (
        <EmptyState title="No matches yet" body="The agent hasn't found anything that fits your profile. Broaden your roles or skills, or run a search now." cta="Edit search profile" href="/profile" />
      )}
    </>
  );
}
