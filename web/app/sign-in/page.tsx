import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = pageMeta({
  title: "Sign in | PublicJobs.ca",
  description: "Sign in to PublicJobs.ca to see the full list of openings.",
  path: "/sign-in/",
  noindex: true,
});

export default function SignInPage() {
  const devEnabled = process.env.ALLOW_DEV_MEMBER === "1" && Boolean(process.env.DEV_MEMBER_TOKEN);
  return (
    <>
      <SiteHeader current="sign-in" />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          <h1>Sign in</h1>
          <section className="description auth-panel">
            <p>Use the email on your account. We send a link. No password. You can also use Google. The account is created before any payment.</p>
            <SignInForm configured={supabaseConfigured()} devEnabled={devEnabled} />
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
