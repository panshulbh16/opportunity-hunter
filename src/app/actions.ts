"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, json, now } from "@/lib/db";
import { createSession, destroySession, getUser, isAdminEmail, requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword, token, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";
import { email } from "@/lib/email";
import { refreshPool, runHunt } from "@/lib/agent";
import { billingCurrency, PLANS, paymentsConfigured, type BillingCurrency, type Plan } from "@/lib/plans";
import { getProfile } from "@/lib/queries";
import { createOrder, markOrderPaid, paymentSignatureValid } from "@/lib/razorpay";
import { extractProfileFromResume, looksLikePdf, RESUME_MAX_BYTES, resumeImportConfigured, type ResumeProfile } from "@/lib/ai/resume";
import { profileFromResume, scoreAgainstProfile, type LandingMatchView } from "@/lib/landingMatch";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const list = (fd: FormData, k: string) => json<string[]>(str(fd, k, 5000), []).map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
const num = (fd: FormData, k: string) => { const v = parseFloat(str(fd, k, 20)); return Number.isFinite(v) ? v : null; };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (m: string) => { throw new Error(m) };
const guard = async <T,>(fn: () => Promise<T>): Promise<T | { error: string }> => {
  try { return await fn(); } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
};

// ---------- Auth ----------

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await rateLimit("signup", 10, 300);
    const name = str(fd, "name", 80), em = str(fd, "email").toLowerCase(), pw = str(fd, "password", 200);
    if (name.length < 2) fail("Please enter your name.");
    if (!EMAIL_RE.test(em)) fail("Please enter a valid email.");
    if (pw.length < 8) fail("Password must be at least 8 characters.");
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(em)) fail("An account with this email already exists.");
    const id = db.prepare("INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)").run(name, em, hashPassword(pw), isAdminEmail(em) ? 1 : 0).lastInsertRowid;
    track("signup", Number(id), { method: "password" });
    await createSession(Number(id));
    redirect("/onboarding");
  });
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await rateLimit("login", 10, 300);
    const em = str(fd, "email").toLowerCase(), pw = str(fd, "password", 200);
    const u = db.prepare("SELECT id, password_hash, onboarded FROM users WHERE email = ?").get(em) as { id: number; password_hash: string | null; onboarded: number } | undefined;
    if (!u || !verifyPassword(pw, u.password_hash)) fail("Incorrect email or password.");
    track("login", u!.id, {});
    await createSession(u!.id);
    redirect(u!.onboarded ? "/dashboard" : "/onboarding");
  });
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await rateLimit("reset", 5, 300);
    const em = str(fd, "email").toLowerCase();
    const u = db.prepare("SELECT id, name FROM users WHERE email = ?").get(em) as { id: number; name: string } | undefined;
    if (u) {
      const t = token();
      db.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)").run(t, u.id, new Date(Date.now() + 36e5).toISOString());
      const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${t}`;
      // A delivery failure must look identical to success: otherwise the error appears only for
      // registered addresses, revealing who has an account (and leaking the provider's raw error).
      await email
        .send({ to: em, subject: "Reset your Opportunity Hunter password", text: `Hi ${u.name},\n\nReset your password here (valid for 1 hour):\n${url}\n\nIf you didn't request this, ignore this email.` })
        .catch((e) => console.error("[reset] email delivery failed", String(e).slice(0, 200)));
    }
    return { ok: email.name === "console" ? "If that email exists, a reset link was generated. Email delivery isn't configured, so check the server console for the link." : "If that email exists, we've sent a reset link." };
  });
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const t = str(fd, "token", 100), pw = str(fd, "password", 200);
    if (pw.length < 8) fail("Password must be at least 8 characters.");
    const r = db.prepare("SELECT user_id FROM password_resets WHERE token = ? AND expires_at > ?").get(t, new Date().toISOString()) as { user_id: number } | undefined;
    if (!r) fail("This reset link is invalid or has expired.");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(pw), r!.user_id);
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(r!.user_id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(r!.user_id);
    await createSession(r!.user_id);
    redirect("/dashboard");
  });
}

// ---------- Search profile ----------

/** Reads an uploaded resume into draft profile fields. Nothing is saved and the file isn't kept: the user reviews, then saves. */
export async function importResume(fd: FormData): Promise<{ profile?: ResumeProfile; error?: string }> {
  return guard(async () => {
    const user = await getUser(); // not requireUser: this also runs during onboarding
    if (!user) redirect("/login");
    if (!resumeImportConfigured) fail("Resume import isn't available yet. Fill in the form instead.");
    await rateLimit("resume", 5, 600);
    const file = fd.get("resume");
    if (!(file instanceof File) || file.size === 0) fail("Choose your resume as a PDF file.");
    const f = file as File;
    if (f.size > RESUME_MAX_BYTES) fail("That PDF is over 5 MB. Export a smaller copy and try again.");
    const bytes = Buffer.from(await f.arrayBuffer());
    if (!looksLikePdf(bytes)) fail("That file isn't a PDF. Save your resume as a PDF and try again.");
    const profile = await extractProfileFromResume(bytes);
    track("resume_imported", user!.id, { skills: profile.skills.length, roles: profile.roles.length });
    return { profile };
  });
}

/** Public landing preview: score a listing from a resume without creating an account. PDF is not stored. */
export async function previewResumeMatch(fd: FormData): Promise<{ match?: LandingMatchView; error?: string }> {
  return guard(async () => {
    if (!resumeImportConfigured) fail("Resume scoring isn't available yet. Create an account and fill in your profile instead.");
    await rateLimit("resume-preview", 5, 600);
    const file = fd.get("resume");
    if (!(file instanceof File) || file.size === 0) fail("Choose your resume as a PDF file.");
    const f = file as File;
    if (f.size > RESUME_MAX_BYTES) fail("That PDF is over 5 MB. Export a smaller copy and try again.");
    const bytes = Buffer.from(await f.arrayBuffer());
    if (!looksLikePdf(bytes)) fail("That file isn't a PDF. Save your resume as a PDF and try again.");
    const extracted = await extractProfileFromResume(bytes);
    if (!extracted.roles.length && !extracted.skills.length) fail("Couldn't find roles or skills on that resume. Fill in the form after you sign up.");
    track("resume_preview", null, { skills: extracted.skills.length, roles: extracted.roles.length });
    return { match: await scoreAgainstProfile(profileFromResume(extracted), "resume") };
  });
}

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await getUser();
    if (!user) redirect("/login");
    const currency = str(fd, "currency", 3) || "INR";
    const scale = currency === "INR" ? 1e5 : 1; // INR entered in lakhs
    const salMin = num(fd, "salary_min"), salMax = num(fd, "salary_max");
    const roles = list(fd, "roles"), skills = list(fd, "skills");
    if (!roles.length && !skills.length) fail("Add at least one role or skill so we know what to hunt for.");
    const threshold = [70, 75, 80, 85, 90].includes(num(fd, "notification_threshold") ?? 0) ? num(fd, "notification_threshold") : 80;
    const freq = ["daily", "twice_daily", "weekly"].includes(str(fd, "search_frequency")) ? str(fd, "search_frequency") : "daily";
    const seniority = ["intern", "junior", "mid", "senior", "lead", "manager", "director"].includes(str(fd, "seniority")) ? str(fd, "seniority") : "mid";
    const data = {
      roles: JSON.stringify(roles), skills: JSON.stringify(skills), keywords: JSON.stringify(list(fd, "keywords")),
      industries: JSON.stringify(list(fd, "industries")), companies: JSON.stringify(list(fd, "companies")),
      excluded_companies: JSON.stringify(list(fd, "excluded_companies")), excluded_keywords: JSON.stringify(list(fd, "excluded_keywords")),
      years_experience: Math.max(0, Math.min(50, num(fd, "years_experience") ?? 0)), current_role: str(fd, "current_role", 100),
      education: str(fd, "education", 120), seniority, locations: JSON.stringify(list(fd, "locations")),
      remote_preference: JSON.stringify(list(fd, "remote_preference")),
      salary_min: str(fd, "salary_unspecified") ? null : salMin != null ? Math.round(salMin * scale) : null,
      salary_max: str(fd, "salary_unspecified") ? null : salMax != null ? Math.round(salMax * scale) : null,
      currency, salary_period: str(fd, "salary_period") === "month" ? "month" : "year",
      employment_types: JSON.stringify(list(fd, "employment_types")), preferences: JSON.stringify(list(fd, "preferences")),
      notification_threshold: threshold, search_frequency: freq, digest_enabled: str(fd, "digest_enabled") === "0" ? 0 : 1,
      updated_at: now(), user_id: user!.id,
    };
    const existing = getProfile(user!.id);
    if (existing) {
      db.prepare(`UPDATE search_profiles SET ${Object.keys(data).filter((k) => k !== "user_id").map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id AND user_id = @user_id`).run({ ...data, id: existing.id });
      track("search_updated", user!.id, {});
    } else {
      db.prepare(`INSERT INTO search_profiles (${Object.keys(data).join(", ")}) VALUES (${Object.keys(data).map((k) => `@${k}`).join(", ")})`).run(data);
      track("search_created", user!.id, {});
    }
    if (!user!.onboarded) {
      db.prepare("UPDATE users SET onboarded = 1 WHERE id = ?").run(user!.id);
      track("onboarding_completed", user!.id, {});
      await refreshPool(); // only fetches if the pool is stale — e.g. a brand-new deployment
      await runHunt(user!.id);
      redirect("/dashboard?welcome=1");
    }
    revalidatePath("/", "layout");
    return { ok: "Profile saved. Your next hunt will use the updated criteria." };
  });
}

export async function runSearchNow(): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser();
    await rateLimit("hunt", 6, 300);
    const pool = await refreshPool();
    const r = await runHunt(user.id);
    revalidatePath("/", "layout");
    if (pool === "no-sources") {
      return { error: "The live job feed is not connected (RAPIDAPI_KEY). Hunts cannot pull listings until it is set." };
    }
    if (r.newMatches) {
      return { ok: `Found ${r.newMatches} new ${r.newMatches === 1 ? "opportunity" : "opportunities"}${r.limited ? " (weekly limit reached)" : ""}.` };
    }
    if (r.limited) return { ok: "New matches found, but you've used this week's free opportunities. Your limit resets weekly." };
    if (pool === "budget") {
      return { error: "This month's job-feed budget is used. We'll keep matching you against listings already in the pool." };
    }
    return { ok: "No new opportunities right now. We'll keep hunting." };
  });
}

// ---------- Opportunity actions ----------

async function ownMatch(oppId: number) {
  const user = await requireUser();
  const m = db.prepare("SELECT id FROM matches WHERE user_id = ? AND opportunity_id = ?").get(user.id, oppId);
  if (!m) fail("Opportunity not found.");
  return user;
}

export async function saveOpportunity(oppId: number) {
  const user = await ownMatch(oppId);
  db.prepare("INSERT OR IGNORE INTO saved_opportunities (user_id, opportunity_id) VALUES (?, ?)").run(user.id, oppId);
  db.prepare("INSERT OR IGNORE INTO applications (user_id, opportunity_id, status) VALUES (?, ?, 'saved')").run(user.id, oppId);
  db.prepare("UPDATE matches SET status = 'saved' WHERE user_id = ? AND opportunity_id = ? AND status IN ('new','viewed')").run(user.id, oppId);
  track("opportunity_saved", user.id, { oppId });
  revalidatePath("/", "layout");
}

export async function unsaveOpportunity(oppId: number) {
  const user = await ownMatch(oppId);
  db.prepare("DELETE FROM saved_opportunities WHERE user_id = ? AND opportunity_id = ?").run(user.id, oppId);
  db.prepare("DELETE FROM applications WHERE user_id = ? AND opportunity_id = ? AND status = 'saved'").run(user.id, oppId);
  db.prepare("UPDATE matches SET status = 'viewed' WHERE user_id = ? AND opportunity_id = ? AND status = 'saved'").run(user.id, oppId);
  revalidatePath("/", "layout");
}

export async function rejectOpportunity(oppId: number) {
  const user = await ownMatch(oppId);
  db.prepare("UPDATE matches SET status = 'rejected' WHERE user_id = ? AND opportunity_id = ?").run(user.id, oppId);
  db.prepare("DELETE FROM saved_opportunities WHERE user_id = ? AND opportunity_id = ?").run(user.id, oppId);
  track("opportunity_rejected", user.id, { oppId });
  revalidatePath("/", "layout");
}

export async function markApplied(oppId: number) {
  const user = await ownMatch(oppId);
  db.prepare(`INSERT INTO applications (user_id, opportunity_id, status, applied_at) VALUES (?, ?, 'applied', ?)
    ON CONFLICT(user_id, opportunity_id) DO UPDATE SET status = 'applied', applied_at = COALESCE(applied_at, excluded.applied_at), updated_at = excluded.applied_at`).run(user.id, oppId, now());
  db.prepare("UPDATE matches SET status = 'applied' WHERE user_id = ? AND opportunity_id = ?").run(user.id, oppId);
  track("application_created", user.id, { oppId });
  revalidatePath("/", "layout");
}

export async function hideSimilar(oppId: number) {
  const user = await ownMatch(oppId);
  const o = db.prepare("SELECT company FROM opportunities WHERE id = ?").get(oppId) as { company: string };
  // ponytail: "similar" = same company; refine with title-token overlap if users ask for it
  const r = db.prepare(`UPDATE matches SET status = 'hidden' WHERE user_id = ? AND status IN ('new','viewed')
    AND opportunity_id IN (SELECT id FROM opportunities WHERE company = ?)`).run(user.id, o.company);
  revalidatePath("/", "layout");
  redirect(`/opportunities?hidden=${r.changes}`);
}

// ---------- Applications ----------

const STATUSES = ["saved", "applied", "interview", "offer", "rejected"];

export async function moveApplication(id: number, status: string) {
  const user = await requireUser();
  if (!STATUSES.includes(status)) fail("Invalid status");
  const appliedAt = status === "applied" ? now() : null;
  db.prepare(`UPDATE applications SET status = ?, applied_at = COALESCE(applied_at, ?), updated_at = ? WHERE id = ? AND user_id = ?`).run(status, appliedAt, now(), id, user.id);
  const row = db.prepare("SELECT opportunity_id FROM applications WHERE id = ? AND user_id = ?").get(id, user.id) as { opportunity_id: number } | undefined;
  if (row) {
    if (status === "applied" || status === "interview" || status === "offer") db.prepare("UPDATE matches SET status = 'applied' WHERE user_id = ? AND opportunity_id = ?").run(user.id, row.opportunity_id);
    if (status === "applied") track("application_created", user.id, { oppId: row.opportunity_id, via: "board" });
  }
  track("application_moved", user.id, { id, status });
  revalidatePath("/applications");
}

export async function updateApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser();
    const id = num(fd, "id");
    db.prepare("UPDATE applications SET notes = ?, follow_up_date = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(str(fd, "notes", 2000), str(fd, "follow_up_date", 10) || null, now(), id, user.id);
    revalidatePath("/applications");
    return { ok: "Saved" };
  });
}

export async function deleteApplication(id: number) {
  const user = await requireUser();
  const row = db.prepare("SELECT opportunity_id FROM applications WHERE id = ? AND user_id = ?").get(id, user.id) as { opportunity_id: number } | undefined;
  db.prepare("DELETE FROM applications WHERE id = ? AND user_id = ?").run(id, user.id);
  if (row) db.prepare("DELETE FROM saved_opportunities WHERE user_id = ? AND opportunity_id = ?").run(user.id, row.opportunity_id);
  revalidatePath("/", "layout");
}

// ---------- Alerts / settings ----------

export async function saveAlerts(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser();
    const threshold = [70, 75, 80, 85, 90].includes(num(fd, "notification_threshold") ?? 0) ? num(fd, "notification_threshold") : 80;
    const freq = ["daily", "twice_daily", "weekly"].includes(str(fd, "search_frequency")) ? str(fd, "search_frequency") : "daily";
    // The digest toggle is disabled for free users, so an absent field must not silently clear their preference.
    const digest = user.subscription_plan === "pro" ? (fd.get("digest_enabled") ? 1 : 0) : null;
    db.prepare(`UPDATE search_profiles SET notification_threshold = ?, search_frequency = ?,
        digest_enabled = COALESCE(?, digest_enabled), updated_at = ? WHERE user_id = ?`)
      .run(threshold, freq, digest, now(), user.id);
    revalidatePath("/alerts");
    return { ok: "Alert settings saved." };
  });
}

export async function markNotificationsRead() {
  const user = await requireUser();
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  revalidatePath("/", "layout");
}

export async function updateAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser();
    const name = str(fd, "name", 80);
    const pw = str(fd, "new_password", 200);
    // Validate everything before writing, so a rejected password change can't still commit the name.
    if (name.length < 2) fail("Name is too short.");
    let hash: string | null = null;
    if (pw) {
      if (pw.length < 8) fail("New password must be at least 8 characters.");
      const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string | null };
      if (row.password_hash && !verifyPassword(str(fd, "current_password", 200), row.password_hash)) fail("Current password is incorrect.");
      hash = hashPassword(pw);
    }
    db.prepare("UPDATE users SET name = ?, password_hash = COALESCE(?, password_hash) WHERE id = ?").run(name, hash, user.id);
    revalidatePath("/", "layout");
    return { ok: "Account updated." };
  });
}

export async function deleteAccount() {
  const user = await requireUser();
  // events has no FK to users (it outlives sessions for analytics), so it doesn't cascade — delete explicitly,
  // or the privacy page's promise that deletion removes your data would be false.
  db.transaction(() => {
    db.prepare("DELETE FROM events WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  })();
  await destroySession();
  redirect("/");
}

// ---------- Billing ----------

export type Checkout = { orderId: string; amount: number; currency: BillingCurrency; keyId: string; name: string; email: string };

export async function startUpgrade(): Promise<Checkout | { error: string }> {
  return guard(async () => {
    const user = await requireUser();
    track("upgrade_clicked", user.id, { plan: "pro", paymentsConfigured });
    if (!paymentsConfigured) fail("Pro isn't on sale yet.");
    await rateLimit("upgrade", 10, 300);
    const currency = billingCurrency(await headers());
    const { orderId, amount } = await createOrder(user.id, currency);
    return { orderId, amount, currency, keyId: process.env.RAZORPAY_KEY_ID!, name: user.name, email: user.email };
  });
}

/** Checkout's success callback. The webhook grants the same pass if the tab closes before this runs. */
export async function confirmUpgrade(orderId: string, paymentId: string, signature: string): Promise<ActionState> {
  return guard(async () => {
    await requireUser();
    if (!paymentSignatureValid(String(orderId), String(paymentId), String(signature)))
      fail("We couldn't verify that payment. If you were charged, email us and we'll sort it out.");
    markOrderPaid(orderId, paymentId); // grants to the order's owner, not the caller
    revalidatePath("/", "layout");
    return { ok: "You're on Pro." };
  });
}

// ---------- Admin ----------

export async function adminSetPlan(userId: number, plan: Plan) {
  await requireAdmin();
  if (!(plan in PLANS)) fail("Invalid plan");
  db.prepare("UPDATE users SET subscription_plan = ? WHERE id = ?").run(plan, userId);
  if (plan === "pro") track("subscription_started", userId, { via: "admin" });
  revalidatePath("/admin");
}

/**
 * Manual password reset while email can't reach users: the admin generates a link and sends it from the
 * support inbox. Only do this for a request that came *from* the account's own address — that reply is the
 * sole proof of ownership. Valid 24h, since a manual round-trip is slower than an automated email.
 */
export async function adminCreateResetLink(userId: number): Promise<{ url?: string; error?: string }> {
  const admin = await requireAdmin();
  if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId)) return { error: "User not found" };
  const t = token();
  db.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)").run(t, userId, new Date(Date.now() + 24 * 36e5).toISOString());
  track("password_reset_issued", admin.id, { forUser: userId });
  return { url: `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${t}` };
}

export async function adminRunAgent() {
  await requireAdmin();
  const { runAllHunts } = await import("@/lib/agent");
  await runAllHunts();
  revalidatePath("/admin");
}
