import { NextResponse, type NextRequest } from "next/server";
import { markOrderPaid, webhookSignatureValid } from "@/lib/razorpay";

// Razorpay → Settings → Webhooks: URL <APP_URL>/api/razorpay/webhook, event "order.paid", secret = RAZORPAY_WEBHOOK_SECRET.
// Backstop for buyers who pay and close the tab before checkout's callback reaches us.
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!webhookSignatureValid(body, req.headers.get("x-razorpay-signature") ?? "")) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const event = JSON.parse(body) as { event: string; payload: { order?: { entity: { id: string } }; payment?: { entity: { id: string } } } };
  if (event.event === "order.paid" && event.payload.order && event.payload.payment) markOrderPaid(event.payload.order.entity.id, event.payload.payment.entity.id);
  return NextResponse.json({ ok: true });
}
