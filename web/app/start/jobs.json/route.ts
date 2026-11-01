import { quizCatalog } from "@/lib/quiz-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await quizCatalog();
  return new Response(JSON.stringify(catalog), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
