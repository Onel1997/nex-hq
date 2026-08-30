import "server-only";

import { headers } from "next/headers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  resolveValidatedNexhqActor,
  type NexhqAuthenticationResult,
} from "./authentication";
import {
  NEXHQ_VERIFIED_USER_EMAIL_HEADER,
  NEXHQ_VERIFIED_USER_ID_HEADER,
} from "./verified-request";

/** Resolve the current cookie-backed caller without privileged credentials. */
export async function resolveServerNexhqAuthentication(): Promise<NexhqAuthenticationResult> {
  try {
    const requestHeaders = await headers();
    const verifiedUserId = requestHeaders.get(NEXHQ_VERIFIED_USER_ID_HEADER);
    if (verifiedUserId) {
      return {
        authenticated: true,
        actor: {
          userId: verifiedUserId,
          email: requestHeaders.get(NEXHQ_VERIFIED_USER_EMAIL_HEADER),
          authenticationSource: "supabase_auth",
        },
      };
    }
  } catch {
    // Route middleware is not present in every server execution context.
  }
  try {
    const supabase = await createServerSupabase();
    return resolveValidatedNexhqActor(() => supabase.auth.getUser());
  } catch {
    return { authenticated: false, reason: "validation_failed" };
  }
}
