import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile, listNotifications } from "@/lib/queries";
import { emailConfigured } from "@/lib/email";
import { markNotificationsRead, saveAlerts } from "@/app/actions";
import { Alert, EmptyState, PageHeader, timeAgo } from "@/components/ui";
import { ActionForm } from "@/components/AuthForm";

export const metadata = { title: "Alerts" };

export default async function Alerts() {
  const user = await requireUser();
  const profile = getProfile(user.id);
  const items = listNotifications(user.id);
  const unread = items.filter((n) => !n.read).length;
  const pro = user.subscription_plan === "pro";
  return (
    <>
      <PageHeader title="Alerts" description="We only notify you when a match clears your threshold.">
        {unread > 0 && <form action={markNotificationsRead}><button className="btn-secondary btn-sm">Mark all read</button></form>}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {items.length ? (
            <ul className="card divide-y divide-zinc-100">
              {items.map((n) => (
                <li key={n.id} className={`flex gap-3 px-4 py-3.5 ${n.read ? "" : "bg-indigo-50/30"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-indigo-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{n.type === "digest" ? "📬 " : "🔥 "}{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[13px] text-zinc-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.opportunity_id && <Link href={`/opportunities/${n.opportunity_id}`} className="btn-secondary btn-sm self-center">View</Link>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No alerts yet." body="When the agent finds a match above your threshold, it shows up here and in your digest." />
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Notification settings</h2>
            <div className="mt-4">
              <ActionForm action={saveAlerts} submit="Save">
                <div>
                  <label className="label" htmlFor="threshold">Notify me for matches at or above</label>
                  <select id="threshold" name="notification_threshold" defaultValue={profile?.notification_threshold ?? 80} className="input">
                    {[70, 75, 80, 85, 90].map((n) => <option key={n} value={n}>{n}% match</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="freq">Search frequency</label>
                  <select id="freq" name="search_frequency" defaultValue={profile?.search_frequency ?? "daily"} className="input">
                    <option value="daily">Daily</option><option value="twice_daily">Twice daily</option><option value="weekly">Weekly</option>
                  </select>
                </div>
                <label className={`check-row ${pro ? "" : "opacity-60"}`}>
                  <input type="checkbox" name="digest_enabled" value="1" defaultChecked={Boolean(profile?.digest_enabled)} disabled={!pro} />
                  <span>Daily Digest email{!pro && <span className="block text-xs text-zinc-500">Pro feature</span>}</span>
                </label>
              </ActionForm>
            </div>
          </div>
          <Alert kind={emailConfigured ? "success" : "warn"}>
            {emailConfigured ? `Email delivery is configured (${user.email}).` : "Email delivery isn't configured on this deployment — digests are logged to the server console. Set RESEND_API_KEY to send real email."}
          </Alert>
          <div className="card p-5 text-[13px] text-zinc-600">
            <p className="font-semibold text-zinc-900">What a digest looks like</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans leading-relaxed">{`Your Opportunity Hunter Report
You found 7 new opportunities today.
🔥 3 excellent matches
⭐ 4 good matches

Top match:
Senior AI Engineer — Example Company
94% Match
[View Opportunity]`}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
