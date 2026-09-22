"use client";

import { useState } from "react";
import { Alert, Check, ScoreBadge, Warn } from "./ui";

const MARKS = ["FIT_SCORE:", "VERDICT:", "MATCHED:", "MISSING:", "CHANGES:", "RESUME:"];
const bullets = (s: string) => s.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean);

// Tolerant parse of the (possibly still-streaming) response for live display.
function parse(text: string) {
  const at = MARKS.map((m) => text.indexOf(m));
  const seg = (i: number) => {
    if (at[i] < 0) return "";
    const start = at[i] + MARKS[i].length;
    let end = text.length;
    for (let j = i + 1; j < MARKS.length; j++) if (at[j] >= 0) { end = at[j]; break; }
    return text.slice(start, end).trim();
  };
  return {
    hasFit: at[0] >= 0 && at[1] >= 0,
    fit: Math.max(0, Math.min(100, parseInt(seg(0), 10) || 0)),
    verdict: seg(1), matched: bullets(seg(2)), missing: bullets(seg(3)),
    changes: bullets(seg(4)), resume: seg(5), hasResume: at[5] >= 0,
  };
}

export function TailorTool() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const resume = String(fd.get("resume") ?? ""), jd = String(fd.get("jd") ?? "");
    setError(null); setText(""); setStatus("streaming");
    let res: Response;
    try {
      res = await fetch("/api/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume, jd }) });
    } catch { setError("Network error — please try again."); setStatus("idle"); return; }
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok || !res.body) { setError((await res.text().catch(() => "")) || "Something went wrong."); setStatus("idle"); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let acc = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      setText(acc);
    }
    setStatus("done");
  }

  const p = text ? parse(text) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <label className="label" htmlFor="resume">Your résumé</label>
          <textarea id="resume" name="resume" required rows={12} placeholder="Paste your résumé as plain text…" className="input font-mono text-[13px] leading-relaxed" />
        </div>
        <div>
          <label className="label" htmlFor="jd">Job description</label>
          <textarea id="jd" name="jd" required rows={8} placeholder="Paste the job description you're applying to…" className="input text-[13px] leading-relaxed" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={status === "streaming"} className="btn-primary">{status === "streaming" ? "Tailoring…" : "Tailor my résumé"}</button>
          <span className="text-xs text-zinc-500">Free · included with your account</span>
        </div>
      </form>

      <div className="min-w-0">
        {!p ? (
          <div className="card grid h-full min-h-64 place-items-center p-8 text-center text-sm text-zinc-500">
            Your fit score, gaps, and a résumé rewritten for this job will appear here.
          </div>
        ) : (
          <div className="card space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fit score</p>
                <p className="mt-1 text-sm text-zinc-700">{p.verdict || (status === "streaming" ? "Analyzing…" : "")}</p>
              </div>
              {p.hasFit && <ScoreBadge score={p.fit} size="lg" />}
            </div>

            {(p.matched.length > 0 || p.missing.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Matched</p>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
                    {p.matched.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{t}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Missing / underplayed</p>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">
                    {p.missing.map((t) => <li key={t} className="flex gap-2"><Warn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{t}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {p.changes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What changed</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-zinc-600">{p.changes.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}

            {p.hasResume && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tailored résumé</p>
                  {status === "done" && (
                    <button type="button" onClick={() => navigator.clipboard?.writeText(p.resume).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="btn-secondary btn-sm">{copied ? "Copied ✓" : "Copy"}</button>
                  )}
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap">{p.resume}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
