import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, isAdminEmail } from "@/lib/auth";
import { track } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  if (!code || !state || state !== jar.get("oh_oauth_state")?.value) return NextResponse.redirect(`${appUrl}/login?error=oauth`);
  jar.delete("oh_oauth_state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`, grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/login?error=oauth`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const info = (await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } })).json()) as
    { sub: string; email: string; email_verified: boolean; name?: string };
  if (!info.email_verified) return NextResponse.redirect(`${appUrl}/login?error=unverified`);

  const email = info.email.toLowerCase();
  let user = db.prepare("SELECT id, onboarded FROM users WHERE google_id = ? OR email = ?").get(info.sub, email) as { id: number; onboarded: number } | undefined;
  if (user) db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(info.sub, user.id);
  else {
    const id = db.prepare("INSERT INTO users (name, email, google_id, is_admin) VALUES (?, ?, ?, ?)").run(info.name ?? email.split("@")[0], email, info.sub, isAdminEmail(email) ? 1 : 0).lastInsertRowid;
    user = { id: Number(id), onboarded: 0 };
    track("signup", user.id, { method: "google" });
  }
  await createSession(user.id);
  return NextResponse.redirect(`${appUrl}${user.onboarded ? "/dashboard" : "/onboarding"}`);
}
