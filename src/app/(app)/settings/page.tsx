import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PLANS, remainingDiscoveries } from "@/lib/plans";
import { deleteAccount, updateAccount } from "@/app/actions";
import { Check, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/AuthForm";
import { UpgradeButton } from "@/components/UpgradeButton";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireUser();
  const plan = PLANS[user.subscription_plan];
  const remaining = remainingDiscoveries(user.id, user.subscription_plan);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Subscription</h2>
              <p className="mt-1 text-sm text-zinc-500">You&apos;re on the <span className="font-medium text-zinc-800">{plan.name}</span> plan{user.subscription_plan === "free" ? ` · ${remaining} of ${plan.weeklyDiscoveries} discoveries left this week` : ""}.</p>
            </div>
            {user.subscription_plan === "free" ? <UpgradeButton /> : <Link href="/pricing" className="btn-secondary">Manage plan</Link>}
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            {plan.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-600" />{f}</li>)}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="text-base font-semibold text-zinc-900">Account</h2>
          <div className="mt-5 max-w-sm">
            <ActionForm action={updateAccount} submit="Save changes">
              <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={user.name} className="input" /></div>
              <div><label className="label">Email</label><input value={user.email} disabled className="input bg-zinc-50 text-zinc-500" /></div>
              <div className="border-t border-zinc-100 pt-4"><p className="text-sm font-medium text-zinc-800">Change password</p></div>
              <div><label className="label" htmlFor="cp">Current password</label><input id="cp" name="current_password" type="password" autoComplete="current-password" className="input" /></div>
              <div><label className="label" htmlFor="np">New password</label><input id="np" name="new_password" type="password" minLength={8} autoComplete="new-password" className="input" /><p className="hint">Leave blank to keep your current password.</p></div>
            </ActionForm>
          </div>
        </section>

        <section className="card border-red-100 p-6">
          <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
          <p className="mt-1 text-sm text-zinc-500">Deleting your account removes your profile, matches, saved opportunities and applications permanently.</p>
          <form action={deleteAccount} className="mt-4"><button type="submit" className="btn-danger border border-red-200">Delete account</button></form>
        </section>
      </div>
    </div>
  );
}
