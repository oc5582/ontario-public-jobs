import { getViewer } from "@/lib/auth";
import { filtersFromSearch, pageParam } from "@/lib/filters";
import { paywallPreview, searchJobs } from "@/lib/jobs";

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
    location_places: job.location_places,
    closing: job.closing,
    type: job.type,
    href: job.href,
    path: job.path,
  }));
  const preview =
    viewer.isMember || jobs.length >= result.total ? null : await paywallPreview(filters, jobs.length);
  return Response.json(
    {
      jobs,
      total: result.total,
      page: viewer.isMember ? page : 1,
      pageIgnored: !viewer.isMember && page > 1,
      member: viewer.isMember,
      preview,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
