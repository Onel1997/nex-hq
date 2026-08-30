const XERIAMO_PRIVATE_BETA_PROJECT_REF = "wwfezmywxishfgwnijyd";
const XERIAMO_PRODUCTION_PROJECT_REF = "lggogmvpktedkimbpzix";

export const XERIAMO_REGISTRATION_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type XeriamoRegistrationReadinessCode =
  | "REGISTRATION_READY"
  | "REGISTRATION_SUPABASE_URL_MISSING"
  | "REGISTRATION_ANON_KEY_MISSING"
  | "REGISTRATION_SERVICE_AUTHORITY_MISSING"
  | "REGISTRATION_SUPABASE_URL_INVALID"
  | "REGISTRATION_PRODUCTION_SUPABASE_FORBIDDEN"
  | "REGISTRATION_PRIVATE_BETA_PROJECT_MISMATCH"
  | "REGISTRATION_SERVICE_AUTHORITY_REJECTED"
  | "REGISTRATION_SUPABASE_UNREACHABLE"
  | "REGISTRATION_SCHEMA_ACCOUNTS_UNAVAILABLE"
  | "REGISTRATION_SCHEMA_CREDIT_ACCOUNTS_UNAVAILABLE"
  | "REGISTRATION_SCHEMA_BILLING_UNAVAILABLE"
  | "REGISTRATION_SCHEMA_LIBRARY_UNAVAILABLE"
  | "REGISTRATION_UNEXPECTED_FAILURE";

type XeriamoRegistrationFlags = {
  supabaseUrlPresent: boolean;
  anonKeyPresent: boolean;
  serviceAuthorityPresent: boolean;
  privateBetaTarget: boolean;
};

export type XeriamoRegistrationEnvironmentReadiness =
  | { ready: true; code: "REGISTRATION_READY"; flags: XeriamoRegistrationFlags }
  | {
      ready: false;
      code: Exclude<XeriamoRegistrationReadinessCode, "REGISTRATION_READY">;
      flags: XeriamoRegistrationFlags;
    };

export const XERIAMO_REGISTRATION_SCHEMA_CHECKS = [
  { table: "xeriano_accounts", column: "id", code: "REGISTRATION_SCHEMA_ACCOUNTS_UNAVAILABLE" },
  { table: "xeriano_credit_accounts", column: "account_id", code: "REGISTRATION_SCHEMA_CREDIT_ACCOUNTS_UNAVAILABLE" },
  { table: "xeriano_billing_customers", column: "account_id", code: "REGISTRATION_SCHEMA_BILLING_UNAVAILABLE" },
  { table: "xeriano_library_assets", column: "id", code: "REGISTRATION_SCHEMA_LIBRARY_UNAVAILABLE" },
] as const;

function projectRefFromUrl(raw: string): string | null {
  try {
    const hostname = new URL(raw).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return "LOCAL";
    return hostname.endsWith(".supabase.co") ? hostname.slice(0, -".supabase.co".length) : null;
  } catch {
    return null;
  }
}

export function resolveXeriamoRegistrationEnvironment(
  env: Record<string, string | undefined>,
): XeriamoRegistrationEnvironmentReadiness {
  const supabaseUrlPresent = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anonKeyPresent = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const serviceAuthorityPresent = Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const projectRef = supabaseUrlPresent
    ? projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL!.trim())
    : null;
  const privateBetaTarget = projectRef === XERIAMO_PRIVATE_BETA_PROJECT_REF;
  const flags = {
    supabaseUrlPresent,
    anonKeyPresent,
    serviceAuthorityPresent,
    privateBetaTarget,
  };

  if (!supabaseUrlPresent) return { ready: false, code: "REGISTRATION_SUPABASE_URL_MISSING", flags };
  if (!anonKeyPresent) return { ready: false, code: "REGISTRATION_ANON_KEY_MISSING", flags };
  if (!serviceAuthorityPresent) return { ready: false, code: "REGISTRATION_SERVICE_AUTHORITY_MISSING", flags };
  if (!projectRef) return { ready: false, code: "REGISTRATION_SUPABASE_URL_INVALID", flags };
  if (projectRef === XERIAMO_PRODUCTION_PROJECT_REF) {
    return { ready: false, code: "REGISTRATION_PRODUCTION_SUPABASE_FORBIDDEN", flags };
  }

  // The public Vercel deployment intentionally targets the isolated staging
  // project during Private Beta. VERCEL_ENV=production must not override this
  // owner-approved project authority.
  if (env.VERCEL_ENV === "production" && !privateBetaTarget) {
    return { ready: false, code: "REGISTRATION_PRIVATE_BETA_PROJECT_MISMATCH", flags };
  }

  return { ready: true, code: "REGISTRATION_READY", flags };
}

export async function resolveXeriamoRegistrationSchema(
  probe: (input: { table: string; column: string }) => PromiseLike<{ error: unknown; status?: number }>,
): Promise<
  | { ready: true; code: "REGISTRATION_READY" }
  | { ready: false; code: Exclude<XeriamoRegistrationReadinessCode, "REGISTRATION_READY"> }
> {
  const results = await Promise.all(
    XERIAMO_REGISTRATION_SCHEMA_CHECKS.map(async (check) => ({
      check,
      result: await probe(check),
    })),
  );
  const failed = results.find(({ result }) => Boolean(result.error));
  if (failed?.result.status === 401 || failed?.result.status === 403) {
    return { ready: false, code: "REGISTRATION_SERVICE_AUTHORITY_REJECTED" };
  }
  if (failed?.result.status === 0) {
    return { ready: false, code: "REGISTRATION_SUPABASE_UNREACHABLE" };
  }
  if (failed) return { ready: false, code: failed.check.code };
  return { ready: true, code: "REGISTRATION_READY" };
}

export function logXeriamoRegistrationUnavailable(input: {
  code: Exclude<XeriamoRegistrationReadinessCode, "REGISTRATION_READY">;
  stage: "environment" | "schema" | "unexpected";
  flags: XeriamoRegistrationEnvironmentReadiness["flags"];
  logger?: Pick<Console, "error">;
}) {
  (input.logger ?? console).error("[xeriamo-register] registration unavailable", {
    code: input.code,
    stage: input.stage,
    ...input.flags,
  });
}
