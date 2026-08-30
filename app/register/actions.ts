"use server";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
import {
  parseXerianoPlanIntent,
  sanitizeXerianoAuthDestination,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";
import {
  logXeriamoRegistrationUnavailable,
  resolveXeriamoRegistrationEnvironment,
  resolveXeriamoRegistrationSchema,
} from "@/lib/xeriano/registration-readiness";

export type RegisterState = { success: boolean; error: string | null };

export async function registerCustomer(_state: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const planIntent = parseXerianoPlanIntent(formData.get("planIntent"));
  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || typeof password !== "string" || password.length < 8) {
    return { success: false, error: "Bitte gib einen Namen, eine gültige E-Mail und mindestens 8 Zeichen als Passwort ein." };
  }
  const runtime = resolveXeriamoRegistrationEnvironment(process.env);
  if (!runtime.ready) {
    logXeriamoRegistrationUnavailable({
      code: runtime.code,
      stage: "environment",
      flags: runtime.flags,
    });
    return { success: false, error: "Die Xeriamo-Kontoverwaltung ist noch nicht aktiviert. Es wurde kein Konto erstellt." };
  }
  try {
    const admin = createAdminClient();
    const foundation = await resolveXeriamoRegistrationSchema(({ table, column }) =>
      admin.from(table).select(column, { head: true }),
    );
    if (!foundation.ready) {
      logXeriamoRegistrationUnavailable({
        code: foundation.code,
        stage: "schema",
        flags: runtime.flags,
      });
      return { success: false, error: "Die Xeriamo-Kontoverwaltung ist noch nicht aktiviert. Es wurde kein Konto erstellt." };
    }
    const supabase = await createServerSupabase();
    const destination = sanitizeXerianoAuthDestination(
      planIntent ? withXerianoPlanIntent("/app/credits", planIntent) : "/app",
    );
    const callback = `${getXerianoAppUrl()}/auth/callback?next=${encodeURIComponent(destination)}`;
    const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: callback } });
    if (error) return { success: false, error: "Das Konto konnte nicht erstellt werden. Prüfe deine Angaben oder versuche es später erneut." };
    return { success: true, error: null };
  } catch {
    logXeriamoRegistrationUnavailable({
      code: "REGISTRATION_UNEXPECTED_FAILURE",
      stage: "unexpected",
      flags: runtime.flags,
    });
    return { success: false, error: "Die Registrierung ist gerade nicht verfügbar." };
  }
}
