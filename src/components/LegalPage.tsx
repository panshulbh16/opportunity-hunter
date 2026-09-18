import Link from "next/link";
import { Logo } from "./ui";

// Every statement on these pages should stay true of the code. If you add a tracker, a data processor,
// or change pricing, retention or refunds, update the matching page in the same change.
export const LEGAL_LINKS = [["/terms", "Terms"], ["/privacy", "Privacy"], ["/refunds", "Refunds"], ["/contact", "Contact"]] as const;

export const supportEmail = () => process.env.SUPPORT_EMAIL;

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6"><Link href="/"><Logo /></Link></div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14 text-[15px] leading-relaxed text-zinc-700 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:mt-1.5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mt-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500">Last updated {updated}</p>
        {children}
        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
          {LEGAL_LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:text-zinc-900">{label}</Link>)}
        </nav>
      </main>
    </div>
  );
}
