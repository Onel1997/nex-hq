import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  runDesignLibraryPipeline,
  type LibraryEngineOptions,
} from "@/lib/design/design-library/pipeline";
import type { CommercialPipelineResult } from "@/lib/design/commercial-design-director";

export type { LibraryEngineOptions as VectorEngineOptions } from "@/lib/design/design-library/types";
export type { CommercialPipelineResult } from "@/lib/design/commercial-design-director";

/** Deterministic print-ready vector artwork from an active DesignStudioBrief. */
export function generateDesignSvg(
  brief: DesignStudioBrief,
  options?: LibraryEngineOptions,
): string {
  return runDesignLibraryPipeline(brief, options).svg;
}

/** Full pipeline result including commercial design director review. */
export function generateDesignSvgWithReview(
  brief: DesignStudioBrief,
  options?: LibraryEngineOptions,
): CommercialPipelineResult {
  return runDesignLibraryPipeline(brief, options);
}
