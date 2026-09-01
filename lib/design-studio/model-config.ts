import type { DesignGenerationSetup } from "@/lib/design-studio/contracts";

export const DESIGN_ENDPOINTS = Object.freeze({
  IDEOGRAM_TEXT: "ideogram/v4",
  IDEOGRAM_REFERENCE: "ideogram/v4/image-to-image",
  RECRAFT_RASTER: "fal-ai/recraft/v4/text-to-image",
  RECRAFT_VECTOR: "fal-ai/recraft/v4/text-to-vector",
  RECRAFT_REFERENCE_RASTER: "recraft/v4/style/text-to-image",
  RECRAFT_REFERENCE_VECTOR: "recraft/v4/style/text-to-vector",
} as const);
export type DesignEndpoint = (typeof DESIGN_ENDPOINTS)[keyof typeof DESIGN_ENDPOINTS];

export function resolveDesignEndpoint(setup: DesignGenerationSetup): DesignEndpoint {
  const referenced = setup.reference !== null;
  if (setup.model === "IDEOGRAM_4") {
    if (setup.outputMode !== "RASTER") throw new Error("DESIGN_OUTPUT_UNSUPPORTED");
    return referenced ? DESIGN_ENDPOINTS.IDEOGRAM_REFERENCE : DESIGN_ENDPOINTS.IDEOGRAM_TEXT;
  }
  if (setup.outputMode === "VECTOR") {
    return referenced ? DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR : DESIGN_ENDPOINTS.RECRAFT_VECTOR;
  }
  return referenced ? DESIGN_ENDPOINTS.RECRAFT_REFERENCE_RASTER : DESIGN_ENDPOINTS.RECRAFT_RASTER;
}

export const IDEOGRAM_RENDERING_SPEED = Object.freeze({
  FAST: "TURBO",
  STANDARD: "BALANCED",
  HIGH: "QUALITY",
} as const);

export const DESIGN_VECTOR_ARTBOARDS = Object.freeze({
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "3:4": { width: 1024, height: 1365 },
  "2:3": { width: 1024, height: 1536 },
} as const);

/** Exact-ratio, 64px-aligned product sizes. Long edges intentionally stay at
 * or just below the 2K/4K product boundary accepted by both provider adapters. */
export const DESIGN_RASTER_DIMENSIONS = Object.freeze({
  "2K": Object.freeze({
    "1:1": { width: 2048, height: 2048 },
    "4:5": { width: 1536, height: 1920 },
    "3:4": { width: 1536, height: 2048 },
    "2:3": { width: 1280, height: 1920 },
  }),
  "4K": Object.freeze({
    "1:1": { width: 4096, height: 4096 },
    "4:5": { width: 3072, height: 3840 },
    "3:4": { width: 3072, height: 4096 },
    "2:3": { width: 2560, height: 3840 },
  }),
} as const);

export function resolveDesignOutputDimensions(setup: DesignGenerationSetup) {
  return setup.outputMode === "VECTOR"
    ? DESIGN_VECTOR_ARTBOARDS[setup.aspectRatio]
    : DESIGN_RASTER_DIMENSIONS[setup.resolution][setup.aspectRatio];
}

export function mapDesignRatio(setup: DesignGenerationSetup) {
  return { image_size: resolveDesignOutputDimensions(setup) };
}

export const DESIGN_STYLE_DIRECTIONS: Record<DesignGenerationSetup["stylePreset"], string | null> = {
  NONE: null,
  STREETWEAR: "Contemporary premium streetwear graphic direction; bold hierarchy and print impact.",
  VINTAGE: "Authentic vintage print character, considered aging and timeless composition.",
  TYPOGRAPHY: "Typography-led composition with exceptional legibility and deliberate letter hierarchy.",
  EDITORIAL: "Refined editorial art direction, sophisticated spacing and confident visual hierarchy.",
  ILLUSTRATION: "Distinctive authored illustration with clean shapes and production-ready detail.",
  MINIMAL: "Restrained minimal composition with intentional negative space and precise forms.",
};

export function extractQuotedText(prompt: string): string[] {
  const matches = prompt.matchAll(/["“„]([^"“”„]+)["“”]/g);
  return [...matches].map((match) => match[1]!.trim()).filter(Boolean).slice(0, 8);
}

export function buildDesignProviderPrompt(setup: DesignGenerationSetup): string {
  const exactText = extractQuotedText(setup.prompt);
  const style = DESIGN_STYLE_DIRECTIONS[setup.stylePreset];
  return [
    "CUSTOMER CREATIVE DIRECTION (PRIMARY AUTHORITY):",
    setup.prompt,
    exactText.length
      ? `EXACT VISIBLE WORDING — reproduce verbatim, without translation, paraphrase or added words: ${exactText.map((text) => `\"${text}\"`).join(", ")}`
      : null,
    style ? `OPTIONAL STYLE DIRECTION: ${style}` : null,
    "Create standalone graphic artwork only. The output is the artwork itself.",
    "No garment. No T-shirt. No hoodie. No mockup. No person wearing the artwork.",
    "No product photography. No lifestyle or campaign photography. No UI. No watermark.",
    "Do not present the artwork printed on a physical product.",
    "Prioritize strong composition, visual hierarchy, print readability and a clean hero visual.",
  ].filter(Boolean).join("\n\n");
}

export function buildDesignProviderInput(input: {
  setup: DesignGenerationSetup;
  providerPrompt: string;
  referenceUrl: string | null;
}): { endpoint: DesignEndpoint; payload: Record<string, unknown> } {
  const endpoint = resolveDesignEndpoint(input.setup);
  const common = { prompt: input.providerPrompt, ...mapDesignRatio(input.setup) };
  if (input.setup.model === "IDEOGRAM_4") {
    return {
      endpoint,
      payload: {
        ...common,
        num_images: input.setup.count,
        rendering_speed: IDEOGRAM_RENDERING_SPEED[input.setup.quality],
        ...(input.referenceUrl ? { image_url: input.referenceUrl, strength: 0.65 } : {}),
      },
    };
  }
  return {
    endpoint,
    payload: {
      ...common,
      ...(input.referenceUrl ? { image_urls: [input.referenceUrl] } : {}),
    },
  };
}
