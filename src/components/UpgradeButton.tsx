import Link from "next/link";
import { getUser } from "@/lib/auth";
import { paymentsConfigured } from "@/lib/plans";
import { CheckoutButton } from "./CheckoutButton";

// Server wrapper so call sites stay one tag: placeholder until Razorpay keys are set, sign-up link for visitors.
export async function UpgradeButton({ className = "btn-secondary", label = "Upgrade to Pro" }: { className?: string; label?: string }) {
  if (!paymentsConfigured)
    return (
      <span className={`${className} pointer-events-none cursor-default opacity-70`} aria-disabled="true">
        Pro — coming soon
      </span>
    );
  if (!(await getUser())) return <Link href="/signup" className={className}>{label}</Link>;
  return <CheckoutButton className={className} label={label} />;
}
