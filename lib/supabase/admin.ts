import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/config/env";

/** Typed table names for Brain persistence. */
export type BrainSupabaseClient = SupabaseClient;

let adminClient: BrainSupabaseClient | null = null;

/**
 * Service-role Supabase client for server-side Brain operations.
 * Bypasses RLS — use only in API routes and server actions.
 */
export function createAdminClient(): BrainSupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return adminClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
