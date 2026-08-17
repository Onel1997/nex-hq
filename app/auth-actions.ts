"use server";

import { redirect } from "next/navigation";
import { endNexhqSession } from "@/lib/auth/password-session";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function logoutOwner(): Promise<never> {
  try {
    const supabase = await createServerSupabase();
    await endNexhqSession(() => supabase.auth.signOut());
  } catch {
    // The public login redirect is still the safest destination if auth is down.
  }

  redirect("/login");
}

