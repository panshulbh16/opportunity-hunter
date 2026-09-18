"use client";

import { useState, useTransition } from "react";
import { adminCreateResetLink, adminRunAgent, adminSetPlan } from "@/app/actions";

export function AdminActions() {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => adminRunAgent())} className="btn-secondary btn-sm">{pending ? "Running agent…" : "Run agent for all users"}</button>;
}

export function PlanToggle({ userId, plan }: { userId: number; plan: "free" | "pro" }) {
  const [pending, start] = useTransition();
  return (
    <select value={plan} disabled={pending} onChange={(e) => start(() => adminSetPlan(userId, e.target.value as "free" | "pro"))} className="input h-8 w-24 text-xs">
      <option value="free">Free</option><option value="pro">Pro</option>
    </select>
  );
}

export function ResetLink({ userId, email }: { userId: number; email: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    // Guard against the one real risk: issuing a link to someone who merely *claims* the account.
    if (!confirm(`Only continue if the request came from ${email} itself.\n\nGenerate a 24-hour reset link?`)) return;
    start(async () => {
      const r = await adminCreateResetLink(userId);
      if (r.url) { setUrl(r.url); setError(null); } else setError(r.error ?? "Failed");
    });
  };

  if (url) {
    return (
      <div className="flex max-w-xs flex-col gap-1">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="input h-8 text-[11px]" aria-label="Reset link" />
        <span className="text-[11px] text-zinc-500">Email this to {email}. Expires in 24h.</span>
      </div>
    );
  }
  return (
    <div>
      <button type="button" disabled={pending} onClick={generate} className="btn-ghost btn-sm">{pending ? "…" : "Reset link"}</button>
      {error && <span className="ml-2 text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
