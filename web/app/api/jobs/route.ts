import { getViewer } from "@/lib/auth";
import { filtersFromSearch, pageParam } from "@/lib/filters";
import { searchJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const filters = filtersFromSearch(params);
  const page = pageParam(params);
  const viewer = await getViewer();
  const result = await searchJobs(filters, viewer.isMember);
  const jobs = result.jobs.map((job) => ({
    title: job.title,
    employer: job.employer,
    location: job.location,
    closing: job.closing,
    type: job.type,
    href: job.href,
  }));
  return Response.json(
    {
      jobs,
      total: result.total,
      page: viewer.isMember ? page : 1,
      pageIgnored: !viewer.isMember && page > 1,
      member: viewer.isMember,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
