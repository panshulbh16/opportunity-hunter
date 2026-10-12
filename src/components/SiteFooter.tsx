import Link from "next/link";
import { Logo } from "./ui";

export const LEGAL_LINKS = [["/terms", "Terms"], ["/privacy", "Privacy"], ["/refunds", "Refunds"], ["/contact", "Contact"]] as const;

/** Footer for the public pages, so every one of them links to every other. */
export function SiteFooter({ narrow = false }: { narrow?: boolean }) {
  return (
    <footer className="border-t border-zinc-100">
      <div className={`mx-auto flex ${narrow ? "max-w-3xl" : "max-w-6xl"} flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500`}>
        <Link href="/"><Logo className="text-sm" /></Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="hover:text-zinc-900">Pricing</Link>
          {LEGAL_LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:text-zinc-900">{label}</Link>)}
          <Link href="/login" className="hover:text-zinc-900">Log in</Link>
        </nav>
      </div>
    </footer>
  );
}
