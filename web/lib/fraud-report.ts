import { LEGAL, isPlaceholder } from "./legal-config";
import { query } from "./db";
import { sendTransactional } from "./transactional-email";

export async function saveFraudReport(input: {
  jobPath: string;
  jobUrl: string;
  email: string;
  details: string;
}): Promise<void> {
  const details = input.details.trim();
  if (details.length < 10 || details.length > 4000) {
    throw new Error("Describe what you noticed in a few sentences.");
  }
  await query(
    `insert into fraud_reports (job_path, job_url, reporter_email, details) values ($1, $2, $3, $4)`,
    [input.jobPath.slice(0, 300), input.jobUrl.slice(0, 500), input.email.slice(0, 254), details],
  );
  const to = isPlaceholder(LEGAL.supportEmail) ? "" : LEGAL.supportEmail;
  if (!to) {
    console.info(JSON.stringify({ event: "fraud_report_stored", emailed: false }));
    return;
  }
  await sendTransactional({
    to,
    subject: "Fraud report on PublicJobs.ca",
    text: `Job: ${input.jobUrl || input.jobPath || "(not specified)"}\nFrom: ${input.email || "(no email)"}\n\n${details}`,
    html: `<p>Job: ${escapeHtml(input.jobUrl || input.jobPath || "(not specified)")}</p><p>From: ${escapeHtml(input.email || "(no email)")}</p><p>${escapeHtml(details)}</p>`,
    idempotencyKey: `fraud/${Date.now()}/${input.jobPath.slice(0, 40)}`,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
