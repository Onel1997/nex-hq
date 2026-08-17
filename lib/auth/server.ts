import "server-only";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  resolveValidatedNexhqActor,
  type NexhqAuthenticationResult,
} from "./authentication";

/** Resolve the current cookie-backed caller without privileged credentials. */
export async function resolveServerNexhqAuthentication(): Promise<NexhqAuthenticationResult> {
  try {
    const supabase = await createServerSupabase();
    return resolveValidatedNexhqActor(() => supabase.auth.getUser());
  } catch {
    return { authenticated: false, reason: "validation_failed" };
  }
}

