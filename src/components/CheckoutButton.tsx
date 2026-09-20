"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmUpgrade, startUpgrade } from "@/app/actions";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (options: object) => { open(): void; on(event: "payment.failed", cb: (r: { error: { description: string } }) => void): void };
  }
}

const loadCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Razorpay. Check your connection and try again."));
    document.body.appendChild(s);
  });

export function CheckoutButton({ className, label }: { className: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();

  const buy = () =>
    start(async () => {
      setError(undefined);
      try {
        const [order] = await Promise.all([startUpgrade(), loadCheckout()]);
        if ("error" in order) return setError(order.error);
        const checkout = new window.Razorpay!({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "Opportunity Hunter",
          description: "Pro · 30 days",
          prefill: { name: order.name, email: order.email },
          theme: { color: "#18181b" },
          handler: async (r: RazorpayResponse) => {
            const res = await confirmUpgrade(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature);
            if (res?.error) setError(res.error);
            else router.refresh();
          },
        });
        checkout.on("payment.failed", (r) => setError(`Payment failed: ${r.error.description}`));
        checkout.open();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });

  return (
    <span className="inline-flex flex-col gap-1.5">
      <button type="button" onClick={buy} disabled={pending} className={className}>
        {pending ? "Opening checkout…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
