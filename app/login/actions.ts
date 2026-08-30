"use server";

import { redirect } from "next/navigation";
import {
  authenticateNexhqPassword,
  GENERIC_LOGIN_ERROR,
} from "@/lib/auth/password-session";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { parseXerianoPlanIntent, withXerianoPlanIntent } from "@/lib/xeriano/plan-intent";

export type LoginActionState = {
  error: string | null;
};

export async function loginOwner(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const planIntent = parseXerianoPlanIntent(formData.get("planIntent"));

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: GENERIC_LOGIN_ERROR };
  }

  try {
    const supabase = await createServerSupabase();
    const result = await authenticateNexhqPassword({
      email,
      password,
      signInWithPassword: (credentials) =>
        supabase.auth.signInWithPassword(credentials),
    });

    if (!result.ok) return { error: result.error };
  } catch {
    return { error: GENERIC_LOGIN_ERROR };
  }

  redirect(planIntent ? withXerianoPlanIntent("/app/credits", planIntent) : "/app");
}
