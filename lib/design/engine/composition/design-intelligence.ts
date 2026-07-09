import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  AssetId,
  CreativeComposition,
  DesignIntelligence,
  StyleFamily,
  VisualHierarchy,
} from "@/lib/design/engine/types";

function selectAssets(
  brief: DesignStudioBrief,
  composition: CreativeComposition,
  hierarchy: VisualHierarchy,
): Pick<DesignIntelligence, "primaryAssets" | "secondaryAssets" | "accentAssets"> {
  const geo = brief.geometry.toLowerCase();
  const elements = brief.visualElements.map((e) => e.toLowerCase()).join(" ");
  const material = `${brief.materialEffects} ${brief.productionMethod}`.toLowerCase();

  const primary: AssetId[] = ["dual-interrupted-arc", "missing-center-void"];

  if (geo.includes("broken") || geo.includes("interrupted") || elements.includes("orbital")) {
    primary.unshift("broken-circle");
  }
  if (composition.styleFamily === "architectural" || geo.includes("frame")) {
    primary.push("architectural-frame");
  }
  if (composition.styleFamily === "faith" || elements.includes("sacred")) {
    primary.push("sacred-geometry");
  }
  if (composition.styleFamily === "technical-streetwear") {
    primary.push("technical-schematic");
  }

  const secondary: AssetId[] = ["editorial-lines", "flank-strikes", "minimal-cross"];

  if (hierarchy !== "typography-primary") {
    secondary.push("luxury-divider");
  }
  if (material.includes("grid") || composition.styleFamily === "swiss-typography") {
    secondary.push("grid-system");
  }

  const accent: AssetId[] = [
    "coordinate-marks",
    "capsule-code",
    "vertical-rules",
  ];

  if (material.includes("grain") || material.includes("noise")) accent.push("noise-mask");
  if (material.includes("halftone")) accent.push("halftone-field");
  if (material.includes("vintage") || material.includes("distress")) accent.push("vintage-distress");
  if (composition.styleFamily === "architectural") accent.push("textured-frame");

  return {
    primaryAssets: [...new Set(primary)].slice(0, 4),
    secondaryAssets: [...new Set(secondary)].slice(0, 4),
    accentAssets: [...new Set(accent)].slice(0, 5),
  };
}

function weightForStyle(style: StyleFamily, hierarchy: VisualHierarchy) {
  const typeBias =
    style === "swiss-typography" || style === "editorial-fashion"
      ? 0.72
      : style === "architectural" || style === "technical-streetwear"
        ? 0.38
        : 0.55;
  const geoBias = 1 - typeBias;

  if (hierarchy === "typography-primary") return { typographyWeight: 0.75, geometryWeight: 0.35 };
  if (hierarchy === "geometry-primary") return { typographyWeight: 0.35, geometryWeight: 0.78 };
  return { typographyWeight: typeBias, geometryWeight: geoBias };
}

/** Decides how much type vs geometry and the emotional feel of the artwork. */
export function buildDesignIntelligence(
  brief: DesignStudioBrief,
  composition: CreativeComposition,
): DesignIntelligence {
  const weights = weightForStyle(composition.styleFamily, composition.visualHierarchy);
  const assets = selectAssets(brief, composition, composition.visualHierarchy);

  const feelQuiet =
    composition.emotionalDirection === "quiet" ||
    composition.emotionalDirection === "spiritual" ||
    composition.styleFamily === "silent-luxury" ||
    composition.styleFamily === "japanese-minimalism";

  return {
    ...weights,
    decorativeWeight: feelQuiet ? 0.35 : 0.55,
    feelQuiet,
    feelLuxury: composition.luxuryLevel >= 3,
    feelEmotional: composition.emotionalDirection === "spiritual" || composition.emotionalDirection === "rebellious",
    feelTechnical:
      composition.emotionalDirection === "technical" ||
      composition.styleFamily === "technical-streetwear",
    breatheWithNegativeSpace: composition.negativeSpaceRatio > 0.22,
    ...assets,
  };
}
