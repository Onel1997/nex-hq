import type { PrintSpec } from "@/lib/design/fashion-design-engine/types";
import type { VectorArtworkExportState } from "./types";

/** Prepare print-ready export metadata for SVG / PNG / future PDF. */
export function exportVectorArtworkState(input: {
  designId: string;
  printSpec: PrintSpec;
  svgString: string;
  dpi: number;
  label?: VectorArtworkExportState["label"];
  kittlBenchmarkScore?: number;
  textSafe?: boolean;
  printReadyDraft?: boolean;
}): VectorArtworkExportState {
  const { designId, printSpec, dpi } = input;

  return {
    formats: {
      svg: { ready: Boolean(input.svgString.trim()), mimeType: "image/svg+xml" },
      pngTransparent: { ready: false, placeholder: true },
      pdf: { ready: false, future: true },
    },
    printSizeMm: {
      width: printSpec.printDimensionsMm.width,
      height: printSpec.printDimensionsMm.height,
    },
    safeMarginsMm: { ...printSpec.safeMarginsMm },
    inkColors: [...printSpec.metadata.inkColors],
    dpi,
    designId,
    generatedAt: new Date().toISOString(),
    label: input.label ?? "Vector Artwork — Text Safe",
    kittlBenchmarkScore: input.kittlBenchmarkScore,
    textSafe: input.textSafe ?? true,
    printReadyDraft: input.printReadyDraft,
  };
}
