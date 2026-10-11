"use server";

import { redirect } from "next/navigation";
import { saveFraudReport } from "@/lib/fraud-report";
import { SITE_URL } from "@/lib/site";

export async function submitFraudReport(formData: FormData) {
  const details = String(formData.get("details") || "");
  const email = String(formData.get("email") || "").trim();
  const jobPath = String(formData.get("job") || "").trim();
  const jobUrl = jobPath.startsWith("http") ? jobPath : `${SITE_URL}${jobPath.startsWith("/") ? jobPath : `/${jobPath}`}`;
  try {
    await saveFraudReport({ jobPath, jobUrl, email, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the report.";
    redirect(`/report/?job=${encodeURIComponent(jobPath)}&notice=${encodeURIComponent(message)}`);
  }
  redirect("/report/?notice=sent");
}
