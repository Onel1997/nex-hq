import { createCanvas, loadImage } from "canvas";

import type { PrintSurface } from "@/lib/image/print-surface/types";

export const BASE_PRINT_PURITY_CONTRACT_VERSION =
  "base-print-purity-v2" as const;

export const BASE_PRINT_PURITY_THRESHOLDS = Object.freeze({
  colorDistance: 70,
  localEdgeDelta: 35,
  outlierFraction: 0.08,
  sharpOutlierFraction: 0.02,
  largestSharpComponentFraction: 0.003,
  horizontalAnalysisInsetFraction: 0.06,
  centerRegionTopAnalysisInsetFraction: 0.28,
  defaultTopAnalysisInsetFraction: 0.06,
  bottomAnalysisInsetFraction: 0.06,
});

export type BasePrintPurityAssessment = {
  contractVersion: typeof BASE_PRINT_PURITY_CONTRACT_VERSION;
  status: "PASS" | "SUSPECTED_CONTAMINATION";
  reason: "CLEAR" | "GRAPHIC_PATTERN" | "UNREADABLE_BASE" | "INVALID_REGION";
  assessedRegion: { x: number; y: number; width: number; height: number };
  analysisRegion: { x: number; y: number; width: number; height: number };
  medianColor: { red: number; green: number; blue: number } | null;
  outlierFraction: number;
  sharpOutlierFraction: number;
  largestSharpComponentFraction: number;
  thresholds: typeof BASE_PRINT_PURITY_THRESHOLDS;
};

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function invalidAssessment(
  reason: "UNREADABLE_BASE" | "INVALID_REGION",
): BasePrintPurityAssessment {
  return {
    contractVersion: BASE_PRINT_PURITY_CONTRACT_VERSION,
    status: "SUSPECTED_CONTAMINATION",
    reason,
    assessedRegion: { x: 0, y: 0, width: 0, height: 0 },
    analysisRegion: { x: 0, y: 0, width: 0, height: 0 },
    medianColor: null,
    outlierFraction: 1,
    sharpOutlierFraction: 1,
    largestSharpComponentFraction: 1,
    thresholds: BASE_PRINT_PURITY_THRESHOLDS,
  };
}

function insetAnalysisRegion(input: {
  assessedRegion: { x: number; y: number; width: number; height: number };
  region: PrintSurface["region"];
}): { x: number; y: number; width: number; height: number } {
  const horizontalInset = Math.round(
    input.assessedRegion.width *
      BASE_PRINT_PURITY_THRESHOLDS.horizontalAnalysisInsetFraction,
  );
  const topInset = Math.round(
    input.assessedRegion.height *
      (input.region === "front_center" || input.region === "back_center"
        ? BASE_PRINT_PURITY_THRESHOLDS.centerRegionTopAnalysisInsetFraction
        : BASE_PRINT_PURITY_THRESHOLDS.defaultTopAnalysisInsetFraction),
  );
  const bottomInset = Math.round(
    input.assessedRegion.height *
      BASE_PRINT_PURITY_THRESHOLDS.bottomAnalysisInsetFraction,
  );
  return {
    x: input.assessedRegion.x + horizontalInset,
    y: input.assessedRegion.y + topInset,
    width: input.assessedRegion.width - horizontalInset * 2,
    height: input.assessedRegion.height - topInset - bottomInset,
  };
}

/**
 * Conservative local guard for obvious graphics in the frozen target region.
 * V2 preserves the exact frozen placement as `assessedRegion`, but measures a
 * bounded inner print core so collars, skin, seams, and placement-boundary
 * shadows cannot masquerade as garment graphics. It does not claim semantic
 * computer-vision certainty; it fails closed when a coherent, high-contrast
 * pattern is present in that usable print core or the region cannot be assessed.
 */
export async function inspectBasePrintPurity(input: {
  bytes: Buffer;
  printSurface: PrintSurface;
}): Promise<BasePrintPurityAssessment> {
  let image: Awaited<ReturnType<typeof loadImage>>;
  try {
    image = await loadImage(input.bytes);
  } catch {
    return invalidAssessment("UNREADABLE_BASE");
  }
  const quad = input.printSurface.quad;
  if (!quad || image.width < 2 || image.height < 2)
    return invalidAssessment("INVALID_REGION");

  const xs = quad.map((point) => point.x * image.width);
  const ys = quad.map((point) => point.y * image.height);
  const x = Math.max(0, Math.floor(Math.min(...xs)));
  const y = Math.max(0, Math.floor(Math.min(...ys)));
  const right = Math.min(image.width, Math.ceil(Math.max(...xs)));
  const bottom = Math.min(image.height, Math.ceil(Math.max(...ys)));
  const assessedRegion = {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
  if (assessedRegion.width < 8 || assessedRegion.height < 8)
    return invalidAssessment("INVALID_REGION");
  const analysisRegion = insetAnalysisRegion({
    assessedRegion,
    region: input.printSurface.region,
  });
  if (analysisRegion.width < 8 || analysisRegion.height < 8)
    return invalidAssessment("INVALID_REGION");

  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(
    analysisRegion.x,
    analysisRegion.y,
    analysisRegion.width,
    analysisRegion.height,
  ).data;
  const width = analysisRegion.width;
  const height = analysisRegion.height;
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    red.push(pixels[index]!);
    green.push(pixels[index + 1]!);
    blue.push(pixels[index + 2]!);
  }
  const medianColor = {
    red: median(red),
    green: median(green),
    blue: median(blue),
  };
  const count = width * height;
  const outliers = new Uint8Array(count);
  const sharpOutliers = new Uint8Array(count);
  const colorDistanceSquared = BASE_PRINT_PURITY_THRESHOLDS.colorDistance ** 2;
  let outlierCount = 0;
  let sharpOutlierCount = 0;

  const channelDelta = (first: number, second: number) =>
    Math.max(
      Math.abs(pixels[first]! - pixels[second]!),
      Math.abs(pixels[first + 1]! - pixels[second + 1]!),
      Math.abs(pixels[first + 2]! - pixels[second + 2]!),
    );

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const pixelIndex = row * width + column;
      const offset = pixelIndex * 4;
      const dr = pixels[offset]! - medianColor.red;
      const dg = pixels[offset + 1]! - medianColor.green;
      const db = pixels[offset + 2]! - medianColor.blue;
      if (dr * dr + dg * dg + db * db <= colorDistanceSquared) continue;
      outliers[pixelIndex] = 1;
      outlierCount += 1;
      if (row === 0 || column === 0 || row === height - 1 || column === width - 1)
        continue;
      const localEdge = Math.max(
        channelDelta(offset, offset - 4),
        channelDelta(offset, offset + 4),
        channelDelta(offset, offset - width * 4),
        channelDelta(offset, offset + width * 4),
      );
      if (localEdge >= BASE_PRINT_PURITY_THRESHOLDS.localEdgeDelta) {
        sharpOutliers[pixelIndex] = 1;
        sharpOutlierCount += 1;
      }
    }
  }

  let largestComponent = 0;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start += 1) {
    if (!sharpOutliers[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let componentSize = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++]!;
      componentSize += 1;
      const row = Math.floor(current / width);
      const column = current % width;
      const neighbors = [
        column > 0 ? current - 1 : -1,
        column < width - 1 ? current + 1 : -1,
        row > 0 ? current - width : -1,
        row < height - 1 ? current + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          sharpOutliers[neighbor] &&
          !visited[neighbor]
        ) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    largestComponent = Math.max(largestComponent, componentSize);
  }

  const outlierFraction = outlierCount / count;
  const sharpOutlierFraction = sharpOutlierCount / count;
  const largestSharpComponentFraction = largestComponent / count;
  const suspected =
    outlierFraction >= BASE_PRINT_PURITY_THRESHOLDS.outlierFraction &&
    sharpOutlierFraction >=
      BASE_PRINT_PURITY_THRESHOLDS.sharpOutlierFraction &&
    largestSharpComponentFraction >=
      BASE_PRINT_PURITY_THRESHOLDS.largestSharpComponentFraction;

  return {
    contractVersion: BASE_PRINT_PURITY_CONTRACT_VERSION,
    status: suspected ? "SUSPECTED_CONTAMINATION" : "PASS",
    reason: suspected ? "GRAPHIC_PATTERN" : "CLEAR",
    assessedRegion,
    analysisRegion,
    medianColor,
    outlierFraction,
    sharpOutlierFraction,
    largestSharpComponentFraction,
    thresholds: BASE_PRINT_PURITY_THRESHOLDS,
  };
}
