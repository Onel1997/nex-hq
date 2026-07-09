import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";
import type { CompositionLanguageProfile } from "@/lib/design/ai-designer/types";

/** Build composition language — focal hierarchy, not SVG layout. */
export function buildCompositionLanguage(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  wearability?: WearabilityDirectorDecision,
): CompositionLanguageProfile {
  const comp = creativeDirector.composition;
  const layout = creativeDirector.layout;

  const focalStrategy =
    comp.focalStrategy === "single-dominant"
      ? "one dominant focal point — scroll-stop hierarchy"
      : comp.focalStrategy === "dual-hierarchy"
        ? "dual hierarchy with primary/secondary tension"
        : "scattered accent with controlled focal pull";

  const balance = comp.overlapRequired ? "asymmetric editorial tension" : "optical balance with restraint";
  const movement = comp.movementRequired ? "editorial flow with diagonal/cascade energy" : "still luxury composition";

  const placement = wearability
    ? `${wearability.placement.id.replace(/-/g, " ")} — ${brief.placement}`
    : `${brief.printArea} — ${brief.placement}`;

  return {
    pattern: `${comp.meta.family} (${comp.meta.name})`,
    focalStrategy,
    balance,
    movement,
    depthLayers: comp.depthLayers,
    overlap: comp.overlapRequired,
    hierarchy: layout.meta.family.includes("Editorial")
      ? "typography-led editorial artwork"
      : "geometry-type interleaved hierarchy",
    placement,
  };
}
