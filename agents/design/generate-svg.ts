import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { generateDesignSvg } from "@/lib/design/generate-design-svg";
import { validateGeneratedSvg } from "@/lib/design/validate-svg";

export interface GenerateDesignSvgOptions {
  includeProductionGuides?: boolean;
}

export interface GenerateDesignSvgResult {
  svg: string;
}

export function runGenerateDesignSvg(
  brief: DesignStudioBrief,
  options?: GenerateDesignSvgOptions,
): GenerateDesignSvgResult {
  const includeProductionGuides = options?.includeProductionGuides ?? true;
  const svg = generateDesignSvg(brief, { includeProductionGuides });

  const validation = validateGeneratedSvg(svg, { includeProductionGuides });
  if (!validation.valid && validation.error) {
    throw new Error(validation.error);
  }

  return { svg };
}
