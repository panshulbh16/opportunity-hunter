"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { previewResumeMatch } from "@/app/actions";
import type { LandingMatchView } from "@/lib/landingMatch";
import { Check, ScoreBadge, Warn } from "./ui";

export function LandingMatchPreview({ initial, resumeImport }: { initial: LandingMatchView; resumeImport: boolean }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("resume", file);
    setError(undefined);
    start(async () => {
      const res = await previewResumeMatch(fd);
      if (res.error || !res.match) return setError(res.error ?? "Couldn't score that resume.");
      setView(res.match);
    });
  };

  return (
    <div>
      <div className="card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900">{view.title}</h3>
            <p className="mt-0.5 text-sm text-zinc-600">{view.company}</p>
          </div>
          <ScoreBadge score={view.score} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 text-[13px] text-zinc-500">
          <span>{view.location}</span>
          <span className="font-medium text-zinc-700">{view.salary}</span>
          <span>{view.employment}</span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Why this matches</p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
          {view.strengths.map((t) => (
            <li key={t} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{t}</li>
          ))}
        </ul>
        {view.gaps.length > 0 && (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Potential concern</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-600">
              {view.gaps.map((t) => (
                <li key={t} className="flex gap-2"><Warn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{t}</li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">{view.caption}</p>
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <Link href={view.ctaHref} className="btn-primary btn-sm">{view.ctaLabel}</Link>
        </div>
      </div>
      {resumeImport && (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-4">
          <label className="label" htmlFor="landing-resume">See a score from your resume (PDF)</label>
          <input
            id="landing-resume"
            type="file"
            accept="application/pdf"
            disabled={pending}
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 disabled:opacity-60"
          />
          <p className="hint" aria-live="polite">{pending ? "Reading your resume and scoring a listing…" : "The file is read once and not stored. The % is the same engine used after you sign up."}</p>
          {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
