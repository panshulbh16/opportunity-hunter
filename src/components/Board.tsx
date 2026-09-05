"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { deleteApplication, moveApplication, updateApplication, type ActionState } from "@/app/actions";
import type { ApplicationRow } from "@/lib/queries";
import { ScoreBadge } from "./ui";

const COLUMNS = [["saved", "Saved"], ["applied", "Applied"], ["interview", "Interview"], ["offer", "Offer"], ["rejected", "Rejected"]] as const;

export function Board({ apps }: { apps: ApplicationRow[] }) {
  const [optimistic, move] = useOptimistic(apps, (state, { id, status }: { id: number; status: string }) => state.map((a) => (a.id === id ? { ...a, status } : a)));
  const [, start] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<ApplicationRow | null>(null);

  const moveTo = (id: number, status: string) => {
    const app = optimistic.find((a) => a.id === id);
    if (!app || app.status === status) return;
    start(async () => { move({ id, status }); await moveApplication(id, status); });
  };
  const drop = (status: string) => {
    setOver(null);
    if (dragging != null) moveTo(dragging, status);
    setDragging(null);
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-5">
        {COLUMNS.map(([key, label]) => {
          const items = optimistic.filter((a) => a.status === key);
          return (
            <div key={key} onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver(null)} onDrop={() => drop(key)}
              className={`flex min-h-40 flex-col rounded-xl border p-2 transition-colors ${over === key ? "border-indigo-400 bg-indigo-50/50" : "border-zinc-200 bg-zinc-50/60"}`}>
              <div className="flex items-center justify-between px-1.5 py-1.5"><span className="text-[13px] font-semibold text-zinc-700">{label}</span><span className="text-xs tabular-nums text-zinc-400">{items.length}</span></div>
              <div className="flex flex-1 flex-col gap-2">
                {items.map((a) => (
                  <div key={a.id} draggable onDragStart={() => setDragging(a.id)} onDragEnd={() => setDragging(null)} onClick={() => setOpen(a)}
                    className={`card cursor-grab p-3 text-[13px] transition-shadow hover:shadow-sm active:cursor-grabbing ${dragging === a.id ? "opacity-40" : ""}`}>
                    <p className="font-medium leading-snug text-zinc-900">{a.title}</p>
                    <p className="mt-0.5 text-zinc-500">{a.company}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {a.score != null ? <ScoreBadge score={a.score} size="sm" /> : <span />}
                      {a.follow_up_date && <span className={`text-[11px] ${a.follow_up_date <= new Date().toISOString().slice(0, 10) ? "font-semibold text-amber-600" : "text-zinc-400"}`}>Follow up {a.follow_up_date}</span>}
                    </div>
                  </div>
                ))}
                {!items.length && <p className="px-1.5 py-6 text-center text-xs text-zinc-400">Drop here</p>}
              </div>
              <select aria-label={`Move to ${label}`} className="mt-2 input h-8 text-xs md:hidden" value="" onChange={(e) => { const id = parseInt(e.target.value); if (id) moveTo(id, key); }}>
                <option value="">Move here…</option>
                {optimistic.filter((a) => a.status !== key).map((a) => <option key={a.id} value={a.id}>{a.title} — {a.company}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {open && <Drawer app={optimistic.find((a) => a.id === open.id) ?? open} onClose={() => setOpen(null)} onMove={(s) => moveTo(open.id, s)} />}
    </>
  );
}

function Drawer({ app, onClose, onMove }: { app: ApplicationRow; onClose: () => void; onMove: (s: string) => void }) {
  const [state, formAction, pending] = useActionState(updateApplication, undefined as ActionState);
  const [, start] = useTransition();
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-zinc-900/30 fade-in" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{app.title}</h2>
            <p className="text-sm text-zinc-500">{app.company} · {app.location}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">Close</button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-zinc-500">Status</dt><dd><select className="input mt-1 h-9" value={app.status} onChange={(e) => onMove(e.target.value)}>{COLUMNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></dd></div>
          <div><dt className="text-xs text-zinc-500">Application date</dt><dd className="mt-1 font-medium text-zinc-800">{app.applied_at?.slice(0, 10) ?? "—"}</dd></div>
        </dl>
        <div className="mt-3 flex gap-3 text-sm">
          <a href={app.application_url} target="_blank" rel="noopener noreferrer" className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">Job URL ↗</a>
          <Link href={`/opportunities/${app.opportunity_id}`} className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">AI analysis</Link>
        </div>
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="id" value={app.id} />
          <div><label className="label" htmlFor="fu">Follow-up date</label><input id="fu" type="date" name="follow_up_date" defaultValue={app.follow_up_date ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={6} defaultValue={app.notes} placeholder="Recruiter name, interview dates, what to prepare…" className="input" /></div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => start(async () => { await deleteApplication(app.id); onClose(); })} className="btn-danger btn-sm">Remove</button>
            <div className="flex items-center gap-3">
              {state?.ok && <span className="text-[13px] text-emerald-700">{state.ok}</span>}
              <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
