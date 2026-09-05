import { NextResponse, type NextRequest } from "next/server";
import { runDueHunts } from "@/lib/agent";

// External scheduler entry point (e.g. a platform cron hitting this every 15 min). Requires CRON_SECRET.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ran = await runDueHunts();
  return NextResponse.json({ ok: true, profilesRun: ran });
}
