"use client";

import { useTransition } from "react";
import { markApplied, rejectOpportunity, saveOpportunity, unsaveOpportunity, hideSimilar } from "@/app/actions";
import { Bookmark } from "./ui";

export function OppActions({ oppId, saved, applied, applyUrl, variant = "card" }: {
  oppId: number; saved: boolean; applied: boolean; applyUrl: string; variant?: "card" | "page";
}) {
  const [pending, start] = useTransition();
  const sm = variant === "card" ? "btn-sm" : "";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <a href={applyUrl} target="_blank" rel="noopener noreferrer" onClick={() => !applied && start(() => markApplied(oppId))} className={`btn-primary ${sm}`}>
        {applied ? "Applied ✓" : variant === "page" ? "Apply Now" : "Apply"}
      </a>
      <button type="button" disabled={pending} onClick={() => start(() => (saved ? unsaveOpportunity(oppId) : saveOpportunity(oppId)))} className={`btn-secondary ${sm}`}>
        <Bookmark filled={saved} className="h-3.5 w-3.5" /> {saved ? "Saved" : "Save"}
      </button>
      {variant === "page" && !applied && (
        <button type="button" disabled={pending} onClick={() => start(() => markApplied(oppId))} className="btn-secondary">Mark as Applied</button>
      )}
      <button type="button" disabled={pending} onClick={() => start(() => rejectOpportunity(oppId))} className={`btn-ghost ${sm}`}>Reject</button>
      {variant === "page" && (
        <button type="button" disabled={pending} onClick={() => start(() => hideSimilar(oppId))} className="btn-ghost text-zinc-500">Hide Similar</button>
      )}
    </div>
  );
}
