/** Permanent Milaene Brand DNA — every analysis is scored against this. */
export const MILAENE_DNA = {
  style: "premium minimalist streetwear",
  audience: "18-35",
  positioning: "editorial capsule brand",
  silhouettes: ["oversized", "relaxed", "boxy"],
  colors: ["obsidian black", "off white", "concrete grey", "signal green"],
  fulfillment: "POD",
  quality: "premium",
} as const;

export type MilaeneDna = typeof MILAENE_DNA;

export function formatMilaeneDnaForPrompt(): string {
  return [
    `Stil: ${MILAENE_DNA.style}`,
    `Zielgruppe: ${MILAENE_DNA.audience}`,
    `Positionierung: ${MILAENE_DNA.positioning}`,
    `Silhouetten: ${MILAENE_DNA.silhouettes.join(", ")}`,
    `Farben: ${MILAENE_DNA.colors.join(", ")}`,
    `Fulfillment: ${MILAENE_DNA.fulfillment}`,
    `Qualität: ${MILAENE_DNA.quality}`,
  ].join("\n");
}

/** Score how well a concept aligns with Milaene DNA (0–100). */
export function scoreDnaAlignment(factors: {
  styleMatch?: number;
  audienceMatch?: number;
  colorMatch?: number;
  silhouetteMatch?: number;
  qualityMatch?: number;
}): number {
  const weights = {
    styleMatch: 0.25,
    audienceMatch: 0.15,
    colorMatch: 0.2,
    silhouetteMatch: 0.25,
    qualityMatch: 0.15,
  };

  let total = 0;
  let weightSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const value = factors[key as keyof typeof factors];
    if (value != null) {
      total += value * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? Math.round(total / weightSum) : 70;
}
