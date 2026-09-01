"use server";

import { redirect } from "next/navigation";
import { endNexhqSession, GENERIC_LOGIN_ERROR } from "@/lib/auth/password-session";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { hasXerianoOwnerAuthority, resolveXerianoAccess } from "@/lib/xeriano/auth";
import type { LoginActionState } from "@/app/login/actions";

export async function loginMaintenanceOwner(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    supabase = await createServerSupabase();
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) return { error: GENERIC_LOGIN_ERROR };
    const access = await resolveXerianoAccess();
    if (access.status !== "AUTHENTICATED" || !hasXerianoOwnerAuthority(access.context)) {
      await endNexhqSession(() => supabase.auth.signOut());
      return { error: "Dieser Zugang ist ausschließlich für den Xeriamo Owner verfügbar." };
    }
  } catch {
    return { error: GENERIC_LOGIN_ERROR };
  }

  redirect("/hq");
}
