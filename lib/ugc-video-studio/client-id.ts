let fallbackCounter = 0;

export type UgcVideoClientIdEnvironment = {
  crypto?: {
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
  } | null;
  now?: () => number;
  random?: () => number;
};

function randomBytesFromCrypto(
  cryptoObject: UgcVideoClientIdEnvironment["crypto"],
): Uint8Array | null {
  try {
    if (!cryptoObject?.getRandomValues) return null;
    return cryptoObject.getRandomValues(new Uint8Array(16));
  } catch {
    return null;
  }
}

function bytesToUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function nonSecureUuidV4(environment: UgcVideoClientIdEnvironment): string {
  fallbackCounter = (fallbackCounter + 1) >>> 0;
  const source = `${(environment.now?.() ?? Date.now()).toString(16)}${fallbackCounter.toString(16).padStart(8, "0")}${(environment.random?.() ?? Math.random()).toString(16).slice(2)}`
    .padEnd(32, "0")
    .slice(0, 32)
    .split("");
  source[12] = "4";
  source[16] = ((Number.parseInt(source[16] ?? "0", 16) & 3) | 8).toString(16);
  return `${source.slice(0, 8).join("")}-${source.slice(8, 12).join("")}-${source.slice(12, 16).join("")}-${source.slice(16, 20).join("")}-${source.slice(20, 32).join("")}`;
}

/** Browser-only UI/request ID. It is not a credential or auth authority. */
export function createUgcVideoClientId(
  environment: UgcVideoClientIdEnvironment = { crypto: globalThis.crypto },
): string {
  const cryptoObject =
    environment.crypto === undefined ? globalThis.crypto : environment.crypto;
  try {
    if (typeof cryptoObject?.randomUUID === "function") {
      return cryptoObject.randomUUID();
    }
  } catch {
    // Continue through compatibility fallbacks.
  }
  const bytes = randomBytesFromCrypto(cryptoObject);
  return bytes ? bytesToUuidV4(bytes) : nonSecureUuidV4(environment);
}
