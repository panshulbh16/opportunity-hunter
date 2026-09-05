"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
import { Alert } from "./ui";

export function ActionForm({ action, submit, pendingLabel, children, className = "space-y-4" }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  submit: string; pendingLabel?: string; children: React.ReactNode; className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      {children}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? (pendingLabel ?? "Please wait…") : submit}</button>
    </form>
  );
}
