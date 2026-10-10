import { NextResponse } from "next/server";
import { readFilters } from "@/lib/filters";
import { memberState } from "@/lib/member";
import { searchJobs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const member = await memberState();
  if (!member.member) {
    const { total } = await searchJobs(readFilters(sp), false);
    return NextResponse.json({ error: "membership_required", total }, { status: 403, headers: { "cache-control": "private, no-store" } });
  }
  const { total, jobs } = await searchJobs(readFilters(sp), true);
  return NextResponse.json({ total, jobs }, { headers: { "cache-control": "private, no-store" } });
}
