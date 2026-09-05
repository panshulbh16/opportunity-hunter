import Link from "next/link";
import { getUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { Check, Logo } from "@/components/ui";
import { UpgradeButton } from "@/components/UpgradeButton";

export const metadata = { title: "Pricing" };

export default async function Pricing() {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-1 text-sm">
            {user ? <Link href="/dashboard" className="btn-ghost">Dashboard</Link> : <Link href="/login" className="btn-ghost">Log in</Link>}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Simple pricing</h1>
          <p className="mt-3 text-zinc-600">Start free. Upgrade when the agent is finding you more than five good matches a week.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="card p-8">
            <h2 className="text-lg font-semibold text-zinc-900">{PLANS.free.name}</h2>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900">₹0<span className="text-base font-normal text-zinc-500">/month</span></p>
            <ul className="mt-8 space-y-3 text-sm text-zinc-700">
              {PLANS.free.features.map((f) => <li key={f} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 text-zinc-400" />{f}</li>)}
            </ul>
            <div className="mt-8">
              {user ? <span className="btn-secondary w-full pointer-events-none">{user.subscription_plan === "free" ? "Your current plan" : "Included in Pro"}</span> : <Link href="/signup" className="btn-secondary w-full">Start Hunting Free</Link>}
            </div>
          </div>
          <div className="relative rounded-xl bg-zinc-900 p-8 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]">
            <span className="absolute -top-3 left-8 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide">Recommended</span>
            <h2 className="text-lg font-semibold">{PLANS.pro.name}</h2>
            <p className="mt-4 text-4xl font-semibold tracking-tight">₹{PLANS.pro.price}<span className="text-base font-normal text-zinc-400">/month</span></p>
            <ul className="mt-8 space-y-3 text-sm text-zinc-200">
              {PLANS.pro.features.map((f) => <li key={f} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 text-indigo-400" />{f}</li>)}
            </ul>
            <div className="mt-8">
              {!user ? <Link href="/signup?plan=pro" className="btn-accent w-full">Start Hunting Free</Link>
                : user.subscription_plan === "pro" ? <span className="btn w-full bg-white/10 pointer-events-none">Your current plan</span>
                : <UpgradeButton className="btn-accent w-full" />}
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-zinc-400">Prices in INR. Cancel any time. Pro billing goes live once a payment provider is connected to this deployment.</p>
      </main>
    </div>
  );
}
