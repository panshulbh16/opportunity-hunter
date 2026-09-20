import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { resumeImportConfigured } from "@/lib/ai/resume";
import { EMPTY_PROFILE, ProfileForm } from "@/components/ProfileForm";

export const metadata = { title: "Set up your search" };

export default async function Onboarding() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.onboarded) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex h-16 items-center justify-between px-6"><Logo /><span className="text-sm text-zinc-500">{user.name}</span></header>
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-6">
        <div className="card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.15)]">
          <ProfileForm initial={EMPTY_PROFILE} mode="onboarding" resumeImport={resumeImportConfigured} />
        </div>
      </main>
    </div>
  );
}
