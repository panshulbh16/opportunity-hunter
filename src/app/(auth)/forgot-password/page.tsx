import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";
import { ActionForm } from "@/components/AuthForm";

export const metadata = { title: "Reset password" };

export default function Forgot() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Reset your password</h1>
      <p className="mt-1 text-sm text-zinc-500">We&apos;ll send a link that&apos;s valid for one hour.</p>
      <div className="mt-6">
        <ActionForm action={requestPasswordReset} submit="Send reset link" pendingLabel="Sending…">
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        </ActionForm>
      </div>
      <p className="mt-6 text-center text-sm text-zinc-500"><Link href="/login" className="font-medium text-zinc-900 hover:underline">Back to log in</Link></p>
    </>
  );
}
