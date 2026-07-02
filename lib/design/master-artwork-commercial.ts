import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { composeFromBrief } from "@/lib/design/design-library/composition";
import {
  runCommercialDesignReview,
  buildImageStudioBlueprint,
  type CommercialDesignReview,
} from "@/lib/design/commercial-design-director";
import { COMMERCIAL_APPROVAL_THRESHOLD } from "@/lib/design/commercial-design-director/commercial-score";

export interface MasterArtworkCommercialReview {
  approved: boolean;
  score: number;
  iterations: number;
  critique: CommercialDesignReview["critique"];
  revisionTasks: CommercialDesignReview["revisionTasks"];
  imageStudioBlueprint: string;
  psychology: CommercialDesignReview["psychology"];
}

/** Commercial Design Director review for AI-generated master artwork. */
export function runMasterArtworkCommercialReview(input: {
  brief: DesignStudioBrief;
  concept: DesignConcept;
}): MasterArtworkCommercialReview {
  const spec = composeFromBrief(input.brief, { forceRich: true });
  const review = runCommercialDesignReview({
    brief: input.brief,
    spec,
    svg: "",
    iteration: 1,
  });

  const conceptBoost = Math.min(8, Math.round(input.concept.confidence / 20));
  const adjustedOverall = Math.min(100, review.score.overall + conceptBoost);

  const approved = adjustedOverall >= COMMERCIAL_APPROVAL_THRESHOLD;

  return {
    approved,
    score: adjustedOverall,
    iterations: 1,
    critique: review.critique,
    revisionTasks: review.revisionTasks,
    imageStudioBlueprint: buildImageStudioBlueprint(input.brief, {
      ...review,
      approved,
      score: { ...review.score, overall: adjustedOverall },
    }),
    psychology: review.psychology,
  };
}
