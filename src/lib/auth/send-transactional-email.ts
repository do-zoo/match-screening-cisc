import { Resend } from "resend";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email pengiriman belum dikonfigurasi.");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html !== undefined ? { html: input.html } : {}),
  });

  if (error) {
    console.error("[sendTransactionalEmail]", error);
    throw new Error("Gagal mengirim email.");
  }
}
