"use server";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
import {
  parseXerianoPlanIntent,
  sanitizeXerianoAuthDestination,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";

export type RegisterState = { success: boolean; error: string | null };

export async function registerCustomer(_state: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const planIntent = parseXerianoPlanIntent(formData.get("planIntent"));
  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || typeof password !== "string" || password.length < 8) {
    return { success: false, error: "Bitte gib einen Namen, eine gültige E-Mail und mindestens 8 Zeichen als Passwort ein." };
  }
  try {
    const admin = createAdminClient();
    const foundation = await Promise.all([
      admin.from("xeriano_accounts").select("id", { head: true }),
      admin.from("xeriano_credit_accounts").select("account_id", { head: true }),
      admin.from("xeriano_billing_customers").select("account_id", { head: true }),
      admin.from("xeriano_library_assets").select("id", { head: true }),
    ]);
    if (foundation.some((result) => result.error)) return { success: false, error: "Die Xeriamo-Kontoverwaltung ist noch nicht aktiviert. Es wurde kein Konto erstellt." };
    const supabase = await createServerSupabase();
    const destination = sanitizeXerianoAuthDestination(
      planIntent ? withXerianoPlanIntent("/app/credits", planIntent) : "/app",
    );
    const callback = `${getXerianoAppUrl()}/auth/callback?next=${encodeURIComponent(destination)}`;
    const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: callback } });
    if (error) return { success: false, error: "Das Konto konnte nicht erstellt werden. Prüfe deine Angaben oder versuche es später erneut." };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Die Registrierung ist gerade nicht verfügbar." };
  }
}
