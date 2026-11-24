import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIpFrom } from "@/lib/client-ip";
import { pageMetadata } from "@/lib/seo";
import { SIGNUP_ENDPOINT } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Confirm job alerts | PublicJobs.ca",
  description: "Confirm that you want weekly job alert emails from PublicJobs.ca.",
  path: "/alerts/confirm/",
  index: false,
});

type ConfirmState = "confirmed" | "expired" | "invalid" | "limited" | "error";

async function confirmToken(token: string, ip: string): Promise<ConfirmState> {
  if (!token || token.length > 2000) return "invalid";
  try {
    const response = await fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-publicjobs-forwarded-for": ip,
      },
      body: JSON.stringify({ confirm_token: token }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string };
    if (response.ok && body.ok) return "confirmed";
    if (body.code === "expired") return "expired";
    if (response.status === 429 || body.code === "limited") return "limited";
    if (response.status === 400) return "invalid";
    return "error";
  } catch {
    return "error";
  }
}

export default async function ConfirmAlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.done === "1") {
    return <ConfirmMessage state="confirmed" />;
  }
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) return <ConfirmMessage state="invalid" />;
  const state = await confirmToken(token, clientIpFrom(await headers()));
  if (state === "confirmed") redirect("/alerts/confirm/?done=1");
  return <ConfirmMessage state={state} />;
}

function ConfirmMessage({ state }: { state: ConfirmState }) {
  const copy = {
    confirmed: {
      title: "You're confirmed",
      text: "We'll email new openings to this address. You can unsubscribe from any alert email.",
    },
    expired: {
      title: "This link has expired",
      text: "Confirmation links last 48 hours. Sign up again and we'll send a new one. You won't get job alerts until you confirm.",
    },
    invalid: {
      title: "This link is not valid",
      text: "Use the confirmation link from the email, or sign up again on the homepage.",
    },
    limited: {
      title: "Please wait a few minutes",
      text: "Too many confirmation attempts just came from this network. Open the link again in a few minutes.",
    },
    error: {
      title: "We could not confirm that email",
      text: "Please try the link again in a minute. If it still fails, sign up once more.",
    },
  }[state];
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>{copy.title}</h1>
        <section className="description">
          <p>{copy.text}</p>
          <p>
            <a className="apply-btn" href="/">
              Back to openings
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
