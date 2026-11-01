import { QuizApp } from "@/components/QuizApp";
import { getViewer } from "@/lib/auth";
import { CA_TAX_JURISDICTIONS } from "@/lib/ca-tax";
import { checkoutUtmFromRecord } from "@/lib/checkout-utm";
import { isCheckoutEmail, normalizeCheckoutEmail } from "@/lib/guest-checkout";
import { quizCatalog } from "@/lib/quiz-catalog";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Find public jobs that fit you | PublicJobs.ca",
  description:
    "A short quiz that matches you with current public-sector jobs in Toronto and the GTA. Apply stays free on every job page.",
  path: "/start/",
  index: false,
});

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, catalog, viewer] = await Promise.all([searchParams, quizCatalog(), getViewer()]);
  const notice = typeof params.notice === "string" ? params.notice : "";
  const typed = typeof params.email === "string" ? normalizeCheckoutEmail(params.email) : "";
  return (
    <>
      <link rel="stylesheet" href="/quiz.css" />
      <QuizApp
        catalog={catalog}
        signedIn={Boolean(viewer.email)}
        notice={notice}
        returnEmail={isCheckoutEmail(typed) ? typed : ""}
        utm={checkoutUtmFromRecord(params)}
        provinces={CA_TAX_JURISDICTIONS.map((item) => ({
          code: item.code,
          label: `${item.name} (${item.displayName} ${item.percentage}%${item.code === "QC" ? ", GST only" : ""})`,
        }))}
      />
    </>
  );
}
