"use server";

import { redirect } from "next/navigation";
import { clearLocalSession, supabaseConfigured } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await clearLocalSession();
  redirect("/");
}
