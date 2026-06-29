import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { generateDesignSvg } from "@/lib/design/generate-design-svg";

export interface GenerateDesignSvgOptions {
  includeProductionGuides?: boolean;
}

export interface GenerateDesignSvgResult {
  svg: string;
}

const FORBIDDEN_MARKERS = [
  "Print area",
  "placeholder",
  "geometry note",
  "missing geometry",
  "debug",
  "palette",
  "Quick Spec",
];

export function runGenerateDesignSvg(
  brief: DesignStudioBrief,
  options?: GenerateDesignSvgOptions,
): GenerateDesignSvgResult {
  const svg = generateDesignSvg(brief, {
    includeProductionGuides: options?.includeProductionGuides ?? true,
  });
  const trimmed = svg.trimStart();

  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<svg")) {
    throw new Error("SVG generation produced invalid markup");
  }
  if (!svg.includes("<title>")) {
    throw new Error("SVG generation missing title element");
  }
  if (!svg.includes('id="print-area"') && (options?.includeProductionGuides ?? true)) {
    throw new Error("SVG generation missing print-area guide");
  }
  if (!svg.includes('id="layer-base-geometry"')) {
    throw new Error("SVG generation missing base geometry layer");
  }

  const lower = svg.toLowerCase();
  for (const marker of FORBIDDEN_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      throw new Error(`SVG generation contains forbidden marker: ${marker}`);
    }
  }

  return { svg };
}
