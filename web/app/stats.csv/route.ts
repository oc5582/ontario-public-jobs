import { publicJobStats } from "@/lib/stats-data";
import { statsToCsv } from "@/lib/stats";

export const revalidate = 900;

export async function GET() {
  const stats = await publicJobStats();
  return new Response(statsToCsv(stats), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
