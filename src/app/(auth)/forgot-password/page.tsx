import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";
import { ActionForm } from "@/components/AuthForm";
import { canEmailAnyone } from "@/lib/email";

export const metadata = { title: "Reset password" };

export default function Forgot() {
  const support = process.env.SUPPORT_EMAIL;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Reset your password</h1>
      {canEmailAnyone ? (
        <>
          <p className="mt-1 text-sm text-zinc-500">We&apos;ll send a link that&apos;s valid for one hour.</p>
          <div className="mt-6">
            <ActionForm action={requestPasswordReset} submit="Send reset link" pendingLabel="Sending…">
              <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
            </ActionForm>
          </div>
        </>
      ) : (
        // Honest fallback: a form that says "we've sent a link" when nothing can arrive leaves people waiting forever.
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <p>Automatic reset emails aren&apos;t available yet during early access.</p>
          <p>
            {support ? (
              <>Email <a href={`mailto:${support}?subject=Password%20reset`} className="font-medium text-zinc-900 underline">{support}</a> from the address you signed up with, and we&apos;ll send you a reset link — usually within a day.</>
            ) : (
              "Contact the site owner from the address you signed up with, and they'll send you a reset link."
            )}
          </p>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-zinc-500"><Link href="/login" className="font-medium text-zinc-900 hover:underline">Back to log in</Link></p>
    </>
  );
}
