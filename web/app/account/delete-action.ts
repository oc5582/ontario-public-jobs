"use server";

import { redirect } from "next/navigation";
import { AccountDeleteBlocked, deleteAccount } from "@/lib/account-delete";
import { clearLocalSession, supabaseConfigured } from "@/lib/auth";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export async function deleteMyAccount(formData: FormData) {
  if (formData.get("confirm") !== "yes") redirect("/account/?notice=delete");
  const viewer = await getViewer();
  if (!viewer.profile) redirect("/login/?next=/account/");
  try {
    await deleteAccount(viewer.profile.id);
  } catch (error) {
    if (error instanceof AccountDeleteBlocked) redirect("/account/?notice=cancel-first");
    throw error;
  }
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await clearLocalSession();
  redirect("/?notice=account-deleted");
}
