import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type {
  CompositionSpec,
  GraphicSpec,
  LayoutSpec,
  PrintSpec,
  TypographySpec,
} from "../types";

export interface PrintProductionAgentInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  layoutSpec: LayoutSpec;
  typographySpec: TypographySpec;
  graphicSpec: GraphicSpec;
  compositionSpec: CompositionSpec;
  generationMode?: "draft" | "production";
}

/**
 * Print Production Agent — prepares future SVG/vector production metadata.
 * SVG export not implemented yet — interfaces only.
 */
export function runPrintProductionAgent(
  input: PrintProductionAgentInput,
): PrintSpec {
  const {
    brief,
    concept,
    layoutSpec,
    typographySpec,
    graphicSpec,
    generationMode = "draft",
  } = input;

  const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;
  const dpi = generationMode === "production" ? 300 : 150;
  const inkColors = graphicSpec.colorApplication.map((c) => c.color).slice(0, 4);

  const printDimensionsMm = panel?.boundingBoxMm ?? { width: 280, height: 180 };
  const safeMarginsMm = {
    top: panel?.safeMarginMm ?? 25,
    right: panel?.safeMarginMm ?? 25,
    bottom: panel?.safeMarginMm ?? 25,
    left: panel?.safeMarginMm ?? 25,
  };

  return {
    futureSvgPath: undefined,
    printDimensionsMm,
    safeMarginsMm,
    transparentAsset: true,
    productionMethod: brief.productionMethod,
    colorCount: Math.max(1, inkColors.length),
    dpi,
    metadata: {
      designId: brief.designId,
      product: concept.product || brief.product,
      color: concept.color || brief.color,
      printArea: brief.printArea,
      inkColors: inkColors.length > 0 ? inkColors : ["Off-White"],
      bleedMm: 3,
      registrationNotes: [
        "Center on spine axis for back prints",
        "Maintain 25 mm safe margin from garment seams",
        `Typography blocks: ${typographySpec.blocks.map((b) => b.id).join(", ")}`,
        "Vector export pipeline pending — specs ready for Phase 3 SVG generation",
      ],
    },
    vectorPipelineReady: false,
  };
}
