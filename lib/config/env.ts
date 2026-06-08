import { z } from "zod";

/** Treat blank env values as unset so optional keys don't fail Zod at import time. */
function optionalEnvString() {
  return z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().min(1).optional(),
  );
}

const envSchema = z.object({
  /** Active workspace slug — server-side resolution. */
  NEXHQ_WORKSPACE_SLUG: optionalEnvString(),
  /** Active workspace slug — exposed to the client bundle. */
  NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG: optionalEnvString(),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().url().optional(),
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalEnvString(),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnvString(),
  OPENAI_API_KEY: optionalEnvString(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  return envSchema.parse({
    NEXHQ_WORKSPACE_SLUG: process.env.NEXHQ_WORKSPACE_SLUG,
    NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG:
      process.env.NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export const env = parseEnv();

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}
