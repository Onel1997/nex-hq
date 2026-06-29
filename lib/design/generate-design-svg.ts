import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { runDesignLibrary } from "@/lib/design/design-library/pipeline";
import type { LibraryEngineOptions } from "@/lib/design/design-library/types";

export type { LibraryEngineOptions as VectorEngineOptions } from "@/lib/design/design-library/types";

/** Deterministic print-ready vector artwork from an active DesignStudioBrief. */
export function generateDesignSvg(
  brief: DesignStudioBrief,
  options?: LibraryEngineOptions,
): string {
  return runDesignLibrary(brief, options);
}
