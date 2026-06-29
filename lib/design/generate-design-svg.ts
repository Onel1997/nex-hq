import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { runDesignEngine } from "@/lib/design/engine/pipeline";
import type { EngineOptions } from "@/lib/design/engine/types";

export type { EngineOptions as VectorEngineOptions } from "@/lib/design/engine/types";

/** Deterministic print-ready vector artwork from an active DesignStudioBrief. */
export function generateDesignSvg(
  brief: DesignStudioBrief,
  options?: EngineOptions,
): string {
  return runDesignEngine(brief, options);
}
