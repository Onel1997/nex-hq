export const SECURE_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BrowserCryptoSource = {
  randomUUID?: () => string;
  getRandomValues?: (target: Uint8Array) => Uint8Array;
};

export class SecureBrowserRandomUnavailableError extends Error {
  constructor() {
    super("SECURE_BROWSER_RANDOM_UNAVAILABLE");
    this.name = "SecureBrowserRandomUnavailableError";
  }
}

function resolveBrowserCrypto(): BrowserCryptoSource | null {
  try {
    return (globalThis.crypto as BrowserCryptoSource | undefined) ?? null;
  } catch {
    return null;
  }
}

function formatUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/**
 * Creates a cryptographically secure request identity in secure and
 * non-secure browser contexts. It intentionally has no non-secure fallback.
 */
export function createSecureBrowserUuid(
  source: BrowserCryptoSource | null = resolveBrowserCrypto(),
): string {
  if (typeof source?.randomUUID === "function") {
    try {
      const candidate = source.randomUUID.call(source);
      if (SECURE_UUID_V4_PATTERN.test(candidate)) return candidate;
    } catch {
      // iOS/private-LAN contexts can expose this method but reject the call.
    }
  }

  if (typeof source?.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      source.getRandomValues.call(source, bytes);
      return formatUuidV4(bytes);
    } catch {
      // Fail closed below; financial request IDs must not become predictable.
    }
  }

  throw new SecureBrowserRandomUnavailableError();
}
