import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="p-6"><Link href="/"><Logo /></Link></header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-6 sm:pt-12">
        <div className="card w-full max-w-sm p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.15)] rise-in">{children}</div>
      </main>
    </div>
  );
}
