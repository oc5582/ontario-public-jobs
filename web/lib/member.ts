import { cookies } from "next/headers";
import { createClient } from "./supabase/server";

export type MemberState = {
  member: boolean;
  email: string | null;
  dev: boolean;
  status: string;
};

export async function memberState(): Promise<MemberState> {
  const jar = await cookies();
  if (process.env.ALLOW_DEV_MEMBER === "1") {
    const token = process.env.DEV_MEMBER_TOKEN || "";
    if (token && jar.get("pj_dev_member")?.value === token) {
      return { member: true, email: "member@example.com", dev: true, status: "active" };
    }
  }
  const supabase = await createClient();
  if (!supabase) return { member: false, email: null, dev: false, status: "none" };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { member: false, email: null, dev: false, status: "none" };
  const profile = await supabase
    .from("profiles")
    .select("membership_status, current_period_end, email")
    .eq("id", user.id)
    .maybeSingle();
  const status = profile.data?.membership_status || "none";
  const end = profile.data?.current_period_end ? new Date(profile.data.current_period_end).getTime() : null;
  const current = status === "active" && (end == null || end > Date.now());
  return {
    member: current,
    email: profile.data?.email || user.email || null,
    dev: false,
    status,
  };
}
