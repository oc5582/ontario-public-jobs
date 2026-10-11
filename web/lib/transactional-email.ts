import { LEGAL, isPlaceholder } from "./legal-config";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export function transactionalFrom(): string {
  return `PublicJobs.ca <membership@publicjobs.ca>`;
}

export async function sendTransactional(message: OutboundEmail): Promise<{ id: string } | { skipped: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "RESEND_API_KEY is not set" };
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const result = await resend.emails.send(
    {
      from: transactionalFrom(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: isPlaceholder(LEGAL.supportEmail) ? undefined : LEGAL.supportEmail,
    },
    { idempotencyKey: message.idempotencyKey },
  );
  if (result.error) {
    throw new Error(result.error.message);
  }
  return { id: result.data?.id || "" };
}
