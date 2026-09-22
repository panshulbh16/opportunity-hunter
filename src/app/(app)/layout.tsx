import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";
import { logout } from "@/app/actions";
import { Logo } from "@/components/ui";

const NAV = [["/dashboard", "Dashboard"], ["/opportunities", "Opportunities"], ["/tailor", "Tailor Résumé"], ["/applications", "Applications"], ["/alerts", "Alerts"], ["/profile", "Search Profile"], ["/settings", "Settings"]];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = unreadCount(user.id);
  return (
    <div className="min-h-screen bg-zinc-50/70">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard"><Logo className="text-[15px]" /></Link>
            <nav className="hidden items-center gap-0.5 md:flex">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="relative rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                  {label}
                  {label === "Alerts" && unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">{unread}</span>}
                </Link>
              ))}
              {user.is_admin ? <Link href="/admin" className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">Admin</Link> : null}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {user.subscription_plan === "pro" && <span className="chip bg-zinc-900 text-white">Pro</span>}
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="hidden max-w-32 truncate text-[13px] font-medium text-zinc-700 sm:block">{user.name}</span>
              </summary>
              <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg fade-in">
                <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500 truncate">{user.email}</div>
                <Link href="/settings" className="block px-3 py-2 hover:bg-zinc-50">Settings</Link>
                <form action={logout}><button type="submit" className="block w-full px-3 py-2 text-left hover:bg-zinc-50">Log out</button></form>
              </div>
            </details>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-1.5 md:hidden">
          {NAV.map(([href, label]) => <Link key={href} href={href} className="shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100">{label}</Link>)}
          {user.is_admin ? <Link href="/admin" className="shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-zinc-400">Admin</Link> : null}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
