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

export const email: EmailProvider = process.env.RESEND_API_KEY
  ? resendProvider(process.env.RESEND_API_KEY)
  : consoleProvider;

export const emailConfigured = email.name !== "console";
