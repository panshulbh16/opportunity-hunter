import { LegalPage, supportEmail } from "@/components/LegalPage";

export const metadata = { title: "Contact" };

export default function Contact() {
  const email = supportEmail();
  return (
    <LegalPage title="Contact" updated="19 September 2026">
      <p>Opportunity Hunter is run by Panshul Bharadwaj, an individual developer based in India.</p>

      <h2>Email</h2>
      <p>
        {email ? <a className="text-lg font-medium text-zinc-900 underline" href={`mailto:${email}`}>{email}</a> : "Reply to any email you've received from us."}
        <br />We reply within 2 working days.
      </p>

      <h2>Payment problems</h2>
      <p>Include the Razorpay payment ID (it starts with <code>pay_</code> and is in your receipt email) and the email address of your Opportunity Hunter account, so we can find your payment quickly.</p>

      <h2>Data requests</h2>
      <p>To get a copy of your data or have it corrected, email us from the address on your account. You can delete your account yourself at any time from Settings.</p>
    </LegalPage>
  );
}
