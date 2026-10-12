import Link from "next/link";

/** Visible "Home / Page" trail for public subpages. Its structured data comes from subpageLd(). */
export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li><Link href="/" className="hover:text-zinc-900">Home</Link></li>
        <li aria-hidden="true" className="text-zinc-300">/</li>
        <li aria-current="page" className="text-zinc-700">{current}</li>
      </ol>
    </nav>
  );
}
