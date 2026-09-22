"use client";

import { useState } from "react";
import { Alert, Check, ScoreBadge, Warn } from "./ui";
import { resumePdfToPrintWindow } from "@/lib/resumePdf";

const MARKS = ["FIT_SCORE:", "VERDICT:", "MATCHED:", "MISSING:", "CHANGES:", "RESUME:"];
const bullets = (s: string) => s.split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean);

function parse(text: string) {
  const at = MARKS.map((m) => text.indexOf(m));
  const seg = (i: number) => {
    if (at[i] < 0) return "";
    const start = at[i] + MARKS[i].length;
    let end = text.length;
    for (let j = 0; j < MARKS.length; j++) if (j !== i && at[j] > at[i] && at[j] < end) end = at[j];
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
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData();
    fd.set("jd", String(new FormData(form).get("jd") ?? ""));
    if (mode === "pdf") {
      const file = (form.elements.namedItem("resume") as HTMLInputElement)?.files?.[0];
      if (!file) { setError("Choose your résumé PDF, or switch to pasting text."); return; }
      fd.set("resume", file);
    } else {
      fd.set("resumeText", String(new FormData(form).get("resumeText") ?? ""));
    }
    setError(null); setText(""); setEdited(null); setStatus("streaming");
    let res: Response;
    try {
      res = await fetch("/api/tailor", { method: "POST", body: fd });
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
    setEdited(parse(acc).resume);
  }

  const p = text ? parse(text) : null;
  const resumeOut = edited ?? p?.resume ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">Your résumé</label>
            <button type="button" onClick={() => setMode(mode === "pdf" ? "text" : "pdf")} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
              {mode === "pdf" ? "or paste text" : "or upload PDF"}
            </button>
          </div>
          {mode === "pdf" ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 hover:border-zinc-400">
              <input type="file" name="resume" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
              <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">Choose PDF</span>
              <span className="truncate">{fileName ?? "Upload your résumé (PDF, up to 5 MB)"}</span>
            </label>
          ) : (
            <textarea name="resumeText" rows={12} placeholder="Paste your résumé as plain text…" className="input font-mono text-[13px] leading-relaxed" />
          )}
        </div>

        <div>
          <label className="label" htmlFor="jd">Job description</label>
          <textarea id="jd" name="jd" required rows={7} placeholder="Paste the job description you're applying to…" className="input text-[13px] leading-relaxed" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={status === "streaming"} className="btn-primary">{status === "streaming" ? "Tailoring…" : "Tailor my résumé"}</button>
          <span className="text-xs text-zinc-500">Free · included with your account</span>
        </div>
      </form>

      <div className="min-w-0">
        {!p ? (
          <div className="card grid h-full min-h-64 place-items-center p-8 text-center text-sm text-zinc-500">
            Your fit score, gaps, and a résumé rewritten for this job will appear here — editable, and ready to download as a PDF.
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
                  <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">{p.matched.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{t}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Missing / underplayed</p>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-zinc-700">{p.missing.map((t) => <li key={t} className="flex gap-2"><Warn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{t}</li>)}</ul>
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
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tailored résumé {status === "done" && <span className="font-normal normal-case text-zinc-400">· editable</span>}</p>
                  {status === "done" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => navigator.clipboard?.writeText(resumeOut).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="btn-secondary btn-sm">{copied ? "Copied ✓" : "Copy"}</button>
                      <button type="button" onClick={() => resumePdfToPrintWindow(resumeOut)} className="btn-primary btn-sm">Download PDF</button>
                    </div>
                  )}
                </div>
                {status === "done" ? (
                  <textarea value={edited ?? ""} onChange={(e) => setEdited(e.target.value)} rows={16} className="input font-mono text-[12.5px] leading-relaxed" />
                ) : (
                  <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap">{p.resume}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
