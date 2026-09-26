import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  db.prepare("SELECT 1").get();
  return Response.json({ commit: process.env.APP_COMMIT_SHA ?? "unknown" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
