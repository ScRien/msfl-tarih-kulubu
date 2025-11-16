import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail(to, subject, html) {
  try {
    const { error } = await resend.emails.send({
      from: "MSFL Tarih Kulübü <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Mail send error:", error);
      return false;
    }

    return true;

  } catch (err) {
    console.error("Resend error:", err);
    return false;
  }
}
