"use server";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
import {
  parseXerianoPlanIntent,
  sanitizeXerianoAuthDestination,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";

export type ResetState = { success: boolean; error: string | null; mode: "REQUEST" | "UPDATE" };

export async function requestPasswordReset(_state: ResetState, formData: FormData): Promise<ResetState> {
  const email = formData.get("email");
  const planIntent = parseXerianoPlanIntent(formData.get("planIntent"));
  if (typeof email !== "string" || !email.trim()) return { success: false, error: "Bitte gib deine E-Mail-Adresse ein.", mode: "REQUEST" };
  try {
    const supabase = await createServerSupabase();
    const next = sanitizeXerianoAuthDestination(
      withXerianoPlanIntent("/reset-password", planIntent, { mode: "update" }),
    );
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${getXerianoAppUrl()}/auth/callback?next=${encodeURIComponent(next)}` });
    return { success: true, error: null, mode: "REQUEST" };
  } catch { return { success: false, error: "Die Anfrage konnte gerade nicht gesendet werden.", mode: "REQUEST" }; }
}

export async function updatePassword(_state: ResetState, formData: FormData): Promise<ResetState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) return { success: false, error: "Das Passwort muss mindestens 8 Zeichen haben.", mode: "UPDATE" };
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { success: false, error: "Das Passwort konnte nicht aktualisiert werden.", mode: "UPDATE" } : { success: true, error: null, mode: "UPDATE" };
  } catch { return { success: false, error: "Das Passwort konnte nicht aktualisiert werden.", mode: "UPDATE" }; }
}
