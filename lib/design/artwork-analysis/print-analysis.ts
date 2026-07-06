import type { ArtworkFileMetadata } from "@/lib/design/artwork-validation";
import type { CompositionAnalysis, PrintAnalysis, PrintPlacement } from "./types";

function inferPlacement(
  aspectRatio: number,
  coveragePercent: number,
  height: number,
  width: number,
): PrintPlacement {
  if (coveragePercent > 65 && aspectRatio > 0.7 && aspectRatio < 1.4) return "Oversized front";
  if (aspectRatio > 1.35 && height > width) return "Back panel";
  if (aspectRatio > 1.8) return "Full back";
  if (aspectRatio < 0.55 && coveragePercent < 25) return "Pocket";
  if (aspectRatio < 0.75 && coveragePercent < 35) return "Sleeve";
  if (coveragePercent > 45) return "Center chest";
  return "Center chest";
}

export function analyzePrint(input: {
  metadata: ArtworkFileMetadata;
  composition: CompositionAnalysis;
}): PrintAnalysis {
  const { metadata, composition } = input;
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const aspectRatio = metadata.aspectRatio ?? (width && height ? width / height : 1);
  const coveragePercent = Math.max(0, 100 - composition.negativeSpacePercent);

  const placement = inferPlacement(aspectRatio, coveragePercent, height, width);
  const coverageLabel =
    coveragePercent > 65 ? "Oversized"
    : coveragePercent > 35 ? "High"
    : coveragePercent > 15 ? "Medium"
    : "Low";

  const maxPrintSize =
    metadata.printSizeAt300Dpi ??
    (width && height ? `${width} × ${height} px` : "Scalable vector");

  return {
    placement,
    coveragePercent,
    maxPrintSize,
    coverageLabel,
    summary: `${coverageLabel} coverage (${coveragePercent}%) suited for ${placement.toLowerCase()} — max ${maxPrintSize}.`,
  };
}
