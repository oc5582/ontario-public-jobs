"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { saveFraudReport } from "@/lib/fraud-report";
import { clientIpFrom } from "@/lib/client-ip";
import { boundedEmail } from "@/lib/email-address";
import { requestAllowed, RULES } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/site";
import { turnstileOk, turnstileToken } from "@/lib/turnstile";

function back(jobPath: string, notice: string): never {
  redirect(`/report/?job=${encodeURIComponent(jobPath)}&notice=${encodeURIComponent(notice)}`);
}

export async function submitFraudReport(formData: FormData) {
  const details = String(formData.get("details") || "");
  const rawEmail = String(formData.get("email") || "").trim();
  const jobPath = String(formData.get("job") || "").trim();
  if (rawEmail.length > 254) back(jobPath, "Enter an email of 254 characters or less.");
  const email = boundedEmail(rawEmail);
  const ip = clientIpFrom(await headers());
  if (!(await turnstileOk(turnstileToken(formData), ip))) {
    back(jobPath, "The security check did not pass. Please try again.");
  }
  const allowed = await requestAllowed({
    scope: "report",
    ip,
    email: email.toLowerCase(),
    ipRule: RULES.report.ip,
    emailRule: email ? RULES.report.email : undefined,
  });
  if (!allowed) back(jobPath, "Please wait a few minutes before sending another report.");
  const jobUrl = jobPath.startsWith("http") ? jobPath : `${SITE_URL}${jobPath.startsWith("/") ? jobPath : `/${jobPath}`}`;
  try {
    await saveFraudReport({ jobPath, jobUrl, email, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the report.";
    back(jobPath, message);
  }
  redirect("/report/?notice=sent");
}
