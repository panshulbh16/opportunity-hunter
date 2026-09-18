import { requireAdmin } from "@/lib/auth";
import { adminStats } from "@/lib/queries";
import { apiUsage } from "@/lib/agent";
import { sources } from "@/lib/sources";
import { emailConfigured } from "@/lib/email";
import { paymentsConfigured } from "@/lib/plans";
import { PageHeader, timeAgo } from "@/components/ui";
import { AdminActions, PlanToggle, ResetLink } from "@/components/AdminActions";

export const metadata = { title: "Admin" };

export default async function Admin() {
  await requireAdmin();
  const s = adminStats();
  const usage = apiUsage();
  const cards = [["Total users", s.users], ["Free users", s.free], ["Pro users", s.pro], ["Opportunities discovered", s.opportunities], ["Opportunities matched", s.matched], ["Applications tracked", s.applications], ["Daily active users", s.dau]] as const;
  const runs = new Map(s.sourceRuns.map((r) => [r.source, r]));
  return (
    <>
      <PageHeader title="Admin" description="Product health at a glance."><AdminActions /></PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([l, n]) => <div key={l} className="card p-4"><p className="text-xs text-zinc-500">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{n}</p></div>)}
      </div>

      <h2 className="mt-10 mb-3 text-base font-semibold text-zinc-900">Source health</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Last successful run</th><th className="px-4 py-2.5">Opportunities retrieved</th><th className="px-4 py-2.5">Status</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {sources.map((src) => {
              const r = runs.get(src.name);
              const status = !src.configured ? "not configured" : r?.status ?? "never run";
              const tone = status === "ok" ? "bg-emerald-50 text-emerald-700" : status === "error" ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-600";
              return (
                <tr key={src.name}>
                  <td className="px-4 py-3"><p className="font-medium text-zinc-900">{src.name}</p>{src.setupHint && <p className="mt-0.5 max-w-md text-xs text-zinc-500">{src.setupHint}</p>}</td>
                  <td className="px-4 py-3 text-zinc-600">{r?.last_ok ? timeAgo(r.last_ok) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600">{r?.retrieved ?? 0}</td>
                  <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>{r?.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          <p className="font-medium text-zinc-900">Job API budget this month</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Pool refreshes at most every {usage.refreshHours}h{usage.lastRefresh ? ` · last ${timeAgo(usage.lastRefresh)}` : ""}. When the budget runs out, users keep being matched against the existing pool until the month resets.
          </p>
        </div>
        <p className={`text-lg font-semibold tabular-nums ${usage.callsThisMonth >= usage.budget * 0.9 ? "text-red-600" : "text-zinc-900"}`}>
          {usage.callsThisMonth} / {usage.budget}
        </p>
      </div>

      <h2 className="mt-10 mb-3 text-base font-semibold text-zinc-900">Integrations</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Email (Resend)", emailConfigured, "RESEND_API_KEY"], ["Payments (Razorpay)", paymentsConfigured, "RAZORPAY_KEY_ID / _SECRET"], ["Google login", Boolean(process.env.GOOGLE_CLIENT_ID), "GOOGLE_CLIENT_ID / _SECRET"]].map(([l, ok, env]) => (
          <div key={String(l)} className="card p-4"><p className="text-sm font-medium text-zinc-900">{l}</p><p className={`mt-1 text-xs font-semibold ${ok ? "text-emerald-700" : "text-zinc-500"}`}>{ok ? "Configured" : `Not configured · set ${env}`}</p></div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 text-base font-semibold text-zinc-900">Users</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5">Last active</th><th className="px-4 py-2.5">Password</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {s.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5"><p className="font-medium text-zinc-900">{u.name}</p><p className="text-xs text-zinc-500">{u.email}</p></td>
                    <td className="px-4 py-2.5"><PlanToggle userId={u.id} plan={u.subscription_plan as "free" | "pro"} /></td>
                    <td className="px-4 py-2.5 text-zinc-600">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{u.last_active_at ? timeAgo(u.last_active_at) : "—"}</td>
                    <td className="px-4 py-2.5"><ResetLink userId={u.id} email={u.email} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-base font-semibold text-zinc-900">Events (7 days)</h2>
          <ul className="card divide-y divide-zinc-100 text-sm">
            {s.events.map((e) => <li key={e.name} className="flex justify-between px-4 py-2"><span className="font-mono text-xs text-zinc-700">{e.name}</span><span className="tabular-nums text-zinc-500">{e.n}</span></li>)}
            {!s.events.length && <li className="px-4 py-3 text-zinc-400">No events yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
