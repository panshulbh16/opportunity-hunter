import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, now } from "./db";
import { token } from "./password";

export type User = {
  id: number;
  name: string;
  email: string;
  subscription_plan: "free" | "pro";
  is_admin: number;
  onboarded: number;
  created_at: string;
};

const COOKIE = "oh_session";
const SESSION_DAYS = 30;

export async function createSession(userId: number) {
  const t = token();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    t,
    userId,
    expires.toISOString(),
  );
  (await cookies()).set(COOKIE, t, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) db.prepare("DELETE FROM sessions WHERE token = ?").run(t);
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.subscription_plan, u.is_admin, u.onboarded, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(t, new Date().toISOString()) as User | undefined;
  if (!user) return null;
  db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(now(), user.id);
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.is_admin) redirect("/dashboard");
  return user;
}

/** Admins come from ADMIN_EMAILS only — never from a hardcoded address with a published password. */
export function isAdminEmail(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}
