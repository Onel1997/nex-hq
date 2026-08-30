const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreativeClientCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (target: Uint8Array) => Uint8Array;
};

export type CreativeClientIdOptions = {
  crypto?: CreativeClientCrypto | null;
  now?: () => number;
  random?: () => number;
};

let fallbackSequence = 0;

function formatUuidV4(bytes: Uint8Array) {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  );
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function browserCrypto(): CreativeClientCrypto | null {
  try {
    return (globalThis.crypto as CreativeClientCrypto | undefined) ?? null;
  } catch {
    return null;
  }
}

function nonSecurityFallbackBytes(
  now: () => number,
  random: () => number,
) {
  const bytes = new Uint8Array(16);
  fallbackSequence = (fallbackSequence + 1) >>> 0;

  let timestamp = 0;
  try {
    timestamp = Math.trunc(now());
  } catch {
    timestamp = Date.now();
  }

  let state = (timestamp ^ Math.imul(fallbackSequence, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    let entropy = 0;
    try {
      entropy = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 256);
    } catch {
      entropy = (index * 47 + fallbackSequence) & 0xff;
    }
    bytes[index] = (state ^ entropy ^ (timestamp >>> ((index % 4) * 8))) & 0xff;
  }
  return bytes;
}

/**
 * Creates browser-side Creative Studio identifiers without assuming a secure
 * context. The last branch is deliberately non-cryptographic and must never be
 * used for credentials, authentication, or any other secret authority.
 */
export function createCreativeClientId(options: CreativeClientIdOptions = {}) {
  const cryptoSource =
    options.crypto === undefined ? browserCrypto() : options.crypto;

  if (typeof cryptoSource?.randomUUID === "function") {
    try {
      const candidate = cryptoSource.randomUUID.call(cryptoSource);
      if (UUID_V4_PATTERN.test(candidate)) return candidate;
    } catch {
      // Some non-secure mobile contexts expose the method but reject the call.
    }
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      cryptoSource.getRandomValues.call(cryptoSource, bytes);
      return formatUuidV4(bytes);
    } catch {
      // Continue with the UI-only fallback below.
    }
  }

  return formatUuidV4(
    nonSecurityFallbackBytes(
      options.now ?? Date.now,
      options.random ?? Math.random,
    ),
  );
}

export function isCreativeClientId(value: string) {
  return UUID_V4_PATTERN.test(value);
}
