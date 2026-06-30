type LoosePayload = Record<string, unknown> & {
  svg?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  output?: unknown;
  result?: {
    svg?: unknown;
    content?: unknown;
    output?: unknown;
    url?: unknown;
    imageUrl?: unknown;
  };
  assets?: Array<{ imageUrl?: unknown; url?: unknown }>;
  productionAssets?: Array<{ imageUrl?: unknown; url?: unknown }>;
};

function asPayload(payload: unknown): LoosePayload | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as LoosePayload;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function imageUrlFromAssets(
  assets: Array<{ imageUrl?: unknown; url?: unknown }> | undefined,
): string | undefined {
  if (!assets?.length) return undefined;
  for (const asset of assets) {
    const url = firstString(asset?.imageUrl, asset?.url);
    if (url) return url;
  }
  return undefined;
}

/** Normalize /api/design/generate-svg payloads (current + legacy shapes). */
export function extractGeneratedSvg(payload: unknown): string {
  console.log("[DESIGN STUDIO] generation response", payload);

  const data = asPayload(payload);
  const output = data?.output;
  const outputRecord =
    output && typeof output === "object" ? (output as Record<string, unknown>) : undefined;

  const svg =
    data?.svg ??
    data?.result?.svg ??
    data?.result?.content ??
    data?.result?.output ??
    outputRecord?.svg ??
    output;

  if (
    typeof svg !== "string" ||
    (!svg.trim().startsWith("<svg") && !svg.trim().startsWith("<?xml"))
  ) {
    const message =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : "SVG generation failed: missing svg output";
    throw new Error(message);
  }

  return svg;
}

/** Normalize /api/image/run and legacy image generation payloads. */
export function extractGeneratedImageUrl(payload: unknown): string {
  console.log("[DESIGN STUDIO] generation response", payload);

  const data = asPayload(payload);
  const output = data?.output;
  const outputRecord =
    output && typeof output === "object" ? (output as Record<string, unknown>) : undefined;

  const url =
    data?.url ??
    data?.imageUrl ??
    data?.mockupUrl ??
    data?.renderUrl ??
    data?.result?.url ??
    data?.result?.imageUrl ??
    data?.result?.output ??
    outputRecord?.url ??
    outputRecord?.imageUrl ??
    (typeof output === "string" ? output : undefined) ??
    imageUrlFromAssets(data?.assets) ??
    imageUrlFromAssets(data?.productionAssets);

  if (typeof url !== "string" || !url.trim()) {
    const message =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : "Image generation failed: missing image URL";
    throw new Error(message);
  }

  return url;
}

export async function readGenerationPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
