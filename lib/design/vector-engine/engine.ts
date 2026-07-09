import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { composeLayers } from "@/lib/design/vector-engine/compose";
import { interpretBrief } from "@/lib/design/vector-engine/interpret-brief";
import { serializeVectorSvg } from "@/lib/design/vector-engine/serialize";
import type { VectorEngineOptions } from "@/lib/design/vector-engine/types";

/** Main entry — interpret brief, compose layers, serialize production SVG. */
export function runVectorEngine(
  brief: DesignStudioBrief,
  options: VectorEngineOptions = {},
): string {
  const spec = interpretBrief(brief);
  const { layers, defs } = composeLayers(spec);
  return serializeVectorSvg({
    title: brief.title,
    designId: brief.designId,
    artboard: spec.artboard,
    layers,
    defs,
    includeProductionGuides: options.includeProductionGuides ?? true,
  });
}
