import Link from "next/link";
import { Logo } from "./ui";
import { Breadcrumbs } from "./Breadcrumbs";
import { JsonLd } from "./JsonLd";
import { SiteFooter } from "./SiteFooter";
import { PUBLIC_PAGES, formatDate, subpageLd } from "@/lib/site";

// Every statement on these pages should stay true of the code. If you add a tracker, a data processor,
// or change pricing, retention or refunds, update the matching page in the same change, and bump its
// lastModified in src/lib/site.ts (shown below as "Last updated" and used in sitemap.xml).

export const supportEmail = () => process.env.SUPPORT_EMAIL;

type LegalPath = "/terms" | "/privacy" | "/refunds" | "/contact";

export function LegalPage({ path, description, children }: { path: LegalPath; description: string; children: React.ReactNode }) {
  const { name, title, lastModified } = PUBLIC_PAGES[path];
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6"><Link href="/"><Logo /></Link></div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pt-8"><Breadcrumbs current={name} /></div>
      <main className="mx-auto max-w-3xl px-6 pb-14 pt-6 text-[15px] leading-relaxed text-zinc-700 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:mt-1.5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mt-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500">Last updated <time dateTime={lastModified}>{formatDate(lastModified)}</time></p>
        {children}
      </main>
      <SiteFooter narrow />
      <JsonLd data={subpageLd(path, description)} />
    </div>
  );
}
