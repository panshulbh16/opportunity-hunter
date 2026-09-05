"use client";

import { useTransition } from "react";
import { adminRunAgent, adminSetPlan } from "@/app/actions";

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
