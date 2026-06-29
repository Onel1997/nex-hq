import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { generateDesignSvgWithReview } from "@/lib/design/generate-design-svg";
import { validateGeneratedSvg } from "@/lib/design/validate-svg";
import type { CommercialDesignReview } from "@/lib/design/commercial-design-director";

export interface GenerateDesignSvgOptions {
  includeProductionGuides?: boolean;
  skipCommercialGate?: boolean;
}

export interface GenerateDesignSvgResult {
  svg: string;
  commercialReview: CommercialDesignReview;
  approved: boolean;
  iterations: number;
  imageStudioBlueprint: string;
}

export function runGenerateDesignSvg(
  brief: DesignStudioBrief,
  options?: GenerateDesignSvgOptions,
): GenerateDesignSvgResult {
  const includeProductionGuides = options?.includeProductionGuides ?? true;
  const pipeline = generateDesignSvgWithReview(brief, {
    includeProductionGuides,
    skipCommercialGate: options?.skipCommercialGate,
  });

  const validation = validateGeneratedSvg(pipeline.svg, { includeProductionGuides });
  if (!validation.valid && validation.error) {
    throw new Error(validation.error);
  }

  if (!pipeline.approved) {
    console.log(
      `[COMMERCIAL DESIGN DIRECTOR] Design not approved (score ${pipeline.review.score.overall}) — returning best effort with revision tasks`,
    );
  }

  return {
    svg: pipeline.svg,
    commercialReview: pipeline.review,
    approved: pipeline.approved,
    iterations: pipeline.iterations,
    imageStudioBlueprint: pipeline.imageStudioBlueprint,
  };
}
