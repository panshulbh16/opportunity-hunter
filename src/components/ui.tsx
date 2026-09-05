import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6M8 11h6" />
        </svg>
      </span>
      Opportunity Hunter
    </span>
  );
}

export const scoreTone = (s: number) =>
  s >= 85 ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : s >= 70 ? "bg-amber-50 text-amber-700 ring-amber-600/20" : "bg-zinc-100 text-zinc-600 ring-zinc-500/20";

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "text-xs px-1.5 py-0.5", md: "text-sm px-2 py-0.5", lg: "text-base px-2.5 py-1" }[size];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold tabular-nums ring-1 ring-inset ${scoreTone(score)} ${sz}`} title="AI Match Score">
      {score}% Match
    </span>
  );
}

export function EmptyState({ title, body, cta, href, icon }: { title: string; body: string; cta?: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center fade-in">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-500">{icon ?? <SearchIcon />}</div>
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-zinc-500">{body}</p>
      {cta && href && <Link href={href} className="btn-primary mt-6">{cta}</Link>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warn"; children: React.ReactNode }) {
  const tone = { info: "bg-zinc-50 text-zinc-700 border-zinc-200", error: "bg-red-50 text-red-700 border-red-200", success: "bg-emerald-50 text-emerald-700 border-emerald-200", warn: "bg-amber-50 text-amber-800 border-amber-200" }[kind];
  return <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${tone} fade-in`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export const timeAgo = (d: string) => {
  const ms = Date.now() - new Date(d.includes("T") ? d : d.replace(" ", "T") + (d.length <= 10 ? "T00:00:00" : "Z")).getTime();
  const days = Math.floor(ms / 864e5);
  if (days <= 0) { const h = Math.floor(ms / 36e5); return h <= 0 ? "just now" : `${h}h ago`; }
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export const titleCase = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
}
export function Check({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
export function Warn({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></svg>;
}
export function Bookmark({ className = "h-4 w-4", filled = false }: { className?: string; filled?: boolean }) {
  return <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>;
}
