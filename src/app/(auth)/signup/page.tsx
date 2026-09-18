import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { signup } from "@/app/actions";
import { ActionForm } from "@/components/AuthForm";
import { GoogleButton } from "../google";

export const metadata = { title: "Sign up" };

export default async function Signup() {
  if (await getUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Start hunting free</h1>
      <p className="mt-1 text-sm text-zinc-500">Create your account, then tell us what you&apos;re looking for.</p>
      <div className="mt-6">
        <ActionForm action={signup} submit="Create account" pendingLabel="Creating account…">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required autoComplete="name" className="input" /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" /><p className="hint">At least 8 characters.</p></div>
        </ActionForm>
        <GoogleButton />
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">By creating an account you agree to our <Link href="/terms" className="underline hover:text-zinc-700">Terms</Link> and <Link href="/privacy" className="underline hover:text-zinc-700">Privacy Policy</Link>.</p>
      <p className="mt-6 text-center text-sm text-zinc-500">Already have an account? <Link href="/login" className="font-medium text-zinc-900 hover:underline">Log in</Link></p>
    </>
  );
}
