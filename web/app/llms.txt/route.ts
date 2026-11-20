import { listingFacts } from "@/lib/jobs";
import { renderLlmsTxt } from "@/lib/llms-txt";

export const revalidate = 900;

export async function GET() {
  const facts = await listingFacts();
  const body = renderLlmsTxt({ fetched: facts.fetched });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
