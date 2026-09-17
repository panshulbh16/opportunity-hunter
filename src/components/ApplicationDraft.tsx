"use client";

import { useRef, useState } from "react";
import type { ApplicationDraft } from "@/lib/ai";
import { Check } from "./ui";

export function ApplicationDraftPanel({ draft }: { draft: ApplicationDraft }) {
  const [letter, setLetter] = useState(draft.letter);
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const box = useRef<HTMLTextAreaElement>(null);

  // The Clipboard API rejects when the document isn't focused or the page isn't on a secure origin.
  // Falling back to selecting the text means the button always does something visible.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setState("copied");
    } catch {
      box.current?.focus();
      box.current?.select();
      setState("manual");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Application draft</h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            Edit it here, then paste it into their form. Fill in anything in [brackets] — those are yours to write.
          </p>
        </div>
        <button type="button" onClick={copy} className="btn-secondary btn-sm shrink-0">
          {state === "copied" ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
            : state === "manual" ? "Selected — press ⌘C"
            : "Copy"}
        </button>
      </div>

      <textarea
        ref={box}
        value={letter}
        onChange={(event) => setLetter(event.target.value)}
        rows={14}
        spellCheck
        className="input mt-4 font-sans text-[13px] leading-relaxed"
        aria-label="Application draft"
      />

      {draft.talkingPoints.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-zinc-900">Lead with these</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
            {draft.talkingPoints.map((point) => (
              <li key={point} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />{point}</li>
            ))}
          </ul>
        </>
      )}

      {draft.prepare.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-zinc-900">Prepare for</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-600">
            {draft.prepare.map((item) => (
              <li key={item} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />{item}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
