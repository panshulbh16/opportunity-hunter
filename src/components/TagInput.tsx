"use client";

import { useState } from "react";

export function TagInput({ name, value, onChange, placeholder, suggestions = [] }: {
  name: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const i of items) if (!next.some((v) => v.toLowerCase() === i.toLowerCase())) next.push(i);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).filter((s) => !draft || s.toLowerCase().includes(draft.toLowerCase())).slice(0, 8);
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      <div className="input flex h-auto min-h-10 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-zinc-400 hover:text-white">×</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {open.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:border-zinc-500 hover:text-zinc-900">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
