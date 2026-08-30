// Internal technical namespace remains xeriano_*; only the public brand changed.
export const XERIANO_BRAND = "Xeriamo" as const;
export const XERIANO_DEFAULT_APP_URL = "https://xeriamo.com" as const;

export function getXerianoAppUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return XERIANO_DEFAULT_APP_URL;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return XERIANO_DEFAULT_APP_URL;
  }
}

export const XERIANO_FOUNDATION_STATUS = Object.freeze({
  migrationsRequired: true,
  customerPaidGenerationEnabled: false,
  message:
    "Die Xeriamo-Konto- und Credit-Datenbank ist noch nicht aktiviert. Es wurde keine kostenpflichtige Generierung gestartet.",
});
