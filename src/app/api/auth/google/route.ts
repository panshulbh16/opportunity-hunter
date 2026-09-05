import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { token } from "@/lib/password";

export async function GET() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return NextResponse.json({ error: "Google login not configured" }, { status: 404 });
  const state = token();
  (await cookies()).set("oh_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
