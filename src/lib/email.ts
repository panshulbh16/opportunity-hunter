export type Email = { to: string; subject: string; text: string; html?: string };

export interface EmailProvider {
  name: string;
  send(email: Email): Promise<void>;
}

const consoleProvider: EmailProvider = {
  name: "console",
  async send(e) {
    console.log(`\n[email → ${e.to}] ${e.subject}\n${e.text}\n`);
  },
};

// Resend via plain fetch; swap this object for any other provider (SES, Postmark, SMTP).
const resendProvider = (key: string): EmailProvider => ({
  name: "resend",
  async send(e) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Opportunity Hunter <onboarding@resend.dev>",
        to: e.to,
        subject: e.subject,
        text: e.text,
        html: e.html,
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  },
});

/**
 * Gmail over SMTP with an app password. Free, delivers to any recipient, and needs no domain —
 * so it, unlike unverified Resend, can serve real users' password resets. ~500 recipients/day on a
 * free account. nodemailer is imported lazily so the console/Resend paths don't pull it in.
 */
const gmailProvider = (user: string, pass: string): EmailProvider => ({
  name: "gmail",
  async send(e) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({ from: process.env.EMAIL_FROM ?? `Opportunity Hunter <${user}>`, to: e.to, subject: e.subject, text: e.text, html: e.html });
  },
});

export const email: EmailProvider =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? gmailProvider(process.env.GMAIL_USER, process.env.GMAIL_APP_PASSWORD)
    : process.env.RESEND_API_KEY
      ? resendProvider(process.env.RESEND_API_KEY)
      : consoleProvider;

export const emailConfigured = email.name !== "console";

/**
 * Whether the app can reach ARBITRARY users (so self-service password reset works), vs only the owner.
 * - Gmail SMTP: yes, to anyone.
 * - Resend: only once a domain is verified, which is exactly when EMAIL_FROM gets set.
 * Otherwise the reset page falls back to the manual, support-assisted flow.
 */
export const canEmailAnyone = email.name === "gmail" || (email.name === "resend" && Boolean(process.env.EMAIL_FROM));
