import { z } from "zod";
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { designStudioBriefSchema } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

export const masterArtworkRequestSchema = z.object({
  brief: designStudioBriefSchema,
  concept: z.record(z.string(), z.unknown()),
  designDirection: z.string().optional(),
  selectedConceptId: z.string().optional(),
});

export type MasterArtworkRequestInput = z.infer<typeof masterArtworkRequestSchema>;

export interface NormalizedMasterArtworkRequest {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection?: string;
  selectedConceptId?: string;
}

export function normalizeMasterArtworkRequest(
  input: MasterArtworkRequestInput,
): NormalizedMasterArtworkRequest {
  return {
    brief: input.brief,
    concept: input.concept as unknown as DesignConcept,
    designDirection: input.designDirection?.trim() || undefined,
    selectedConceptId: input.selectedConceptId?.trim() || undefined,
  };
}
