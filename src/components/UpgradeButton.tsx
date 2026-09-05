"use client";

import { useState, useTransition } from "react";
import { startUpgrade } from "@/app/actions";

export function UpgradeButton({ className = "btn-accent", label = "Upgrade to Pro" }: { className?: string; label?: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string } | undefined>();
  return (
    <div>
      <button type="button" disabled={pending} className={className} onClick={() => start(async () => setState(await startUpgrade()))}>
        {pending ? "One moment…" : label}
      </button>
      {state?.error === "not_configured" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-[13px] text-amber-900 fade-in">
          <p className="font-semibold">Payments aren&apos;t configured yet.</p>
          <p className="mt-1">This deployment has no payment provider connected. Set <code className="rounded bg-white/70 px-1">RAZORPAY_KEY_ID</code> and <code className="rounded bg-white/70 px-1">RAZORPAY_KEY_SECRET</code>, then complete the checkout integration in <code className="rounded bg-white/70 px-1">startUpgrade()</code>. No payment is simulated.</p>
        </div>
      )}
      {state?.error && state.error !== "not_configured" && <p className="mt-2 text-[13px] text-red-600">{state.error}</p>}
    </div>
  );
}
