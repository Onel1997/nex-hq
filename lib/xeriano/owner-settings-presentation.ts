export type OwnerIntegrationPresentation = {
  id: "supabase" | "fal" | "stripe" | "openai";
  name: string;
  description: string;
  configured: boolean;
};

export type OwnerSettingsPresentation = {
  environmentLabel: string;
  integrations: OwnerIntegrationPresentation[];
};

const PRIVATE_BETA_PROJECT_REF = "wwfezmywxishfgwnijyd";

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isPrivateBetaTarget(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === `${PRIVATE_BETA_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

/**
 * Returns booleans and customer-safe labels only. Secret values and variable
 * names never cross the Server Component boundary into Owner UI.
 */
export function resolveOwnerSettingsPresentation(
  env: Record<string, string | undefined>,
): OwnerSettingsPresentation {
  const privateBeta = isPrivateBetaTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const environmentLabel = privateBeta
    ? "Private Beta · Staging"
    : env.VERCEL_ENV === "production"
      ? "Production"
      : "Lokale Entwicklung";

  return {
    environmentLabel,
    integrations: [
      {
        id: "supabase",
        name: "Supabase",
        description: "Authentifizierung, Datenbank und privater Speicher",
        configured:
          isPresent(env.NEXT_PUBLIC_SUPABASE_URL) &&
          isPresent(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
          isPresent(env.SUPABASE_SERVICE_ROLE_KEY),
      },
      {
        id: "fal",
        name: "fal.ai",
        description: "Bild- und Video-Provider für aktive Studio-Workflows",
        configured: isPresent(env.FAL_KEY),
      },
      {
        id: "stripe",
        name: "Stripe",
        description: "Abonnements, Top-ups und sichere Zahlungsabwicklung",
        configured:
          isPresent(env.STRIPE_SECRET_KEY) &&
          isPresent(env.STRIPE_WEBHOOK_SECRET),
      },
      {
        id: "openai",
        name: "OpenAI",
        description: "KI-Unterstützung für interne Xeriamo-Workflows",
        configured: isPresent(env.OPENAI_API_KEY),
      },
    ],
  };
}
