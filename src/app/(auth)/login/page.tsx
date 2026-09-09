import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { ActionForm } from "@/components/AuthForm";
import { GoogleButton } from "../google";
import { DEMO_EMAIL, DEMO_PASSWORD, demoEnabled } from "@/lib/boot";

export const metadata = { title: "Log in" };

export default async function Login() {
  if (await getUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-500">Log in to see what the agent found.</p>
      <div className="mt-6">
        <ActionForm action={login} submit="Log in" pendingLabel="Logging in…">
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div>
            <div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot-password" className="mb-1.5 text-xs text-zinc-500 hover:text-zinc-900">Forgot?</Link></div>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
        </ActionForm>
        <GoogleButton />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500">New here? <Link href="/signup" className="font-medium text-zinc-900 hover:underline">Create an account</Link></p>
      {demoEnabled && (
        <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Demo account:</span> {DEMO_EMAIL} / {DEMO_PASSWORD}
        </div>
      )}
    </>
  );
}
