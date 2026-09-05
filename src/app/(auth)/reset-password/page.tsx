import Link from "next/link";
import { resetPassword } from "@/app/actions";
import { ActionForm } from "@/components/AuthForm";

export const metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="text-sm text-zinc-600">This link is missing its token. <Link href="/forgot-password" className="font-medium text-zinc-900 hover:underline">Request a new one.</Link></p>;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Choose a new password</h1>
      <div className="mt-6">
        <ActionForm action={resetPassword} submit="Update password" pendingLabel="Updating…">
          <input type="hidden" name="token" value={token} />
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /></div>
        </ActionForm>
      </div>
    </>
  );
}
