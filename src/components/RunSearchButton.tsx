"use client";

import { useState, useTransition } from "react";
import { runSearchNow, type ActionState } from "@/app/actions";

export function RunSearchButton({ className = "btn-secondary" }: { className?: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} className={className} onClick={() => start(async () => setState(await runSearchNow()))}>
        {pending ? (
          <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>Hunting…</>
        ) : "Run Search Now"}
      </button>
      {state?.ok && <span className="text-[13px] text-emerald-700 fade-in">{state.ok}</span>}
      {state?.error && <span className="text-[13px] text-red-600 fade-in">{state.error}</span>}
    </div>
  );
}
