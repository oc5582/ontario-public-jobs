import { AppliedToggle } from "@/components/AppliedToggle";
import { JobView, jobMetadata } from "@/components/views/JobView";
import { applicationKey } from "@/lib/application-key";
import { hasApplication } from "@/lib/applications";
import { getViewer } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import type { Metadata } from "next";

type Props = { params: Promise<{ employer: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { employer, slug } = await params;
  return jobMetadata(employer, slug);
}

export default async function LiveJobPage({ params }: Props) {
  const { employer, slug } = await params;
  const viewer = await getViewer();
  const applyToggle =
    viewer.isMember && viewer.profile
      ? getJob(employer, slug).then(async (job) => {
          const key = job ? applicationKey(job.path) : null;
          if (!key || !viewer.profile) return null;
          return <AppliedToggle jobKey={key} initial={await hasApplication(viewer.profile.id, key)} />;
        })
      : null;
  return <JobView employer={employer} slug={slug} applyToggle={applyToggle} />;
}
