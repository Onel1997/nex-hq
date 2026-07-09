import { computeOpaqueBounds, forEachOpaquePixel, luminance } from "./pixel-source";
import type { ArtworkPixelData, CompositionAnalysis } from "./types";

export function analyzeComposition(pixels: ArtworkPixelData): CompositionAnalysis {
  const { width, height, imageData } = pixels;
  const bounds = computeOpaqueBounds(imageData);

  if (!bounds) {
    return {
      balanceScore: 0,
      negativeSpacePercent: 100,
      visualWeight: "Light",
      focalPoint: { x: 50, y: 50, label: "No artwork mass" },
      readingDirection: "Center-out",
      alignment: "Centered",
      symmetryScore: 0,
      qualityScore: 0,
      summary: "No opaque artwork mass detected.",
    };
  }

  const totalPixels = width * height;
  const artworkPixels = bounds.opaqueCount;
  const negativeSpacePercent = Math.round(((totalPixels - artworkPixels) / totalPixels) * 100);

  let sumX = 0;
  let sumY = 0;
  let leftMass = 0;
  let rightMass = 0;
  let topMass = 0;
  let bottomMass = 0;
  const midX = width / 2;
  const midY = height / 2;

  forEachOpaquePixel(imageData, (x, y, r, g, b, a) => {
    const weight = (a / 255) * (1 - luminance(r, g, b) * 0.15);
    sumX += x * weight;
    sumY += y * weight;
    if (x < midX) leftMass += weight;
    else rightMass += weight;
    if (y < midY) topMass += weight;
    else bottomMass += weight;
  });

  const totalWeight = leftMass + rightMass || 1;
  const balanceDelta = Math.abs(leftMass - rightMass) / totalWeight;
  const balanceScore = Math.round((1 - balanceDelta) * 100);

  const focalX = Math.round((sumX / totalWeight / width) * 100);
  const focalY = Math.round((sumY / totalWeight / height) * 100);

  let leftMirror = 0;
  let rightMirror = 0;
  const sampleStep = Math.max(1, Math.floor(width / 120));
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < midX; x += sampleStep) {
      const li = (y * width + x) * 4;
      const ri = (y * width + (width - 1 - x)) * 4;
      const la = imageData.data[li + 3];
      const ra = imageData.data[ri + 3];
      if (la > 20) leftMirror += 1;
      if (ra > 20) rightMirror += 1;
      if (la > 20 && ra > 20) {
        const lLum = luminance(imageData.data[li], imageData.data[li + 1], imageData.data[li + 2]);
        const rLum = luminance(imageData.data[ri], imageData.data[ri + 1], imageData.data[ri + 2]);
        if (Math.abs(lLum - rLum) < 0.15) {
          /* symmetric pixel */
        }
      }
    }
  }

  const symmetryScore = Math.round(
    (1 - Math.abs(leftMirror - rightMirror) / Math.max(leftMirror, rightMirror, 1)) * 100,
  );

  const coverage = artworkPixels / totalPixels;
  const visualWeight =
    coverage > 0.55 ? "Heavy" : coverage > 0.25 ? "Balanced" : "Light";

  const verticalBias = Math.abs(topMass - bottomMass) / totalWeight;
  const readingDirection =
    verticalBias > 0.25 ? "Top-down"
    : symmetryScore > 70 ? "Radial"
    : balanceDelta < 0.15 ? "Center-out"
    : "Left-right";

  const alignment =
    symmetryScore > 75 ? "Symmetric"
    : Math.abs(focalX - 50) < 12 && Math.abs(focalY - 50) < 12 ? "Centered"
    : "Asymmetric";

  const qualityScore = Math.round(
    balanceScore * 0.3 +
      symmetryScore * 0.2 +
      Math.min(negativeSpacePercent, 60) * 0.5 +
      (visualWeight === "Balanced" ? 15 : visualWeight === "Light" ? 10 : 5),
  );

  const focalLabel =
    focalY < 40 ? "Upper field"
    : focalY > 60 ? "Lower field"
    : focalX < 40 ? "Left weighted"
    : focalX > 60 ? "Right weighted"
    : "Center mass";

  return {
    balanceScore,
    negativeSpacePercent,
    visualWeight,
    focalPoint: { x: focalX, y: focalY, label: focalLabel },
    readingDirection,
    alignment,
    symmetryScore,
    qualityScore: Math.min(100, qualityScore),
    summary: `${negativeSpacePercent}% negative space with ${alignment.toLowerCase()} ${visualWeight.toLowerCase()} composition — focal ${focalLabel.toLowerCase()}.`,
  };
}

export function computeEdgeDensity(pixels: ArtworkPixelData): number {
  const { width, height, imageData } = pixels;
  const data = imageData.data;
  let edges = 0;
  let samples = 0;
  const step = Math.max(1, Math.floor(width / 200));

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      const right = (y * width + (x + step)) * 4;
      const down = ((y + step) * width + x) * 4;
      if (data[right + 3] < 20 || data[down + 3] < 20) continue;
      const lumR = luminance(data[right], data[right + 1], data[right + 2]);
      const lumD = luminance(data[down], data[down + 1], data[down + 2]);
      if (Math.abs(lum - lumR) > 0.18 || Math.abs(lum - lumD) > 0.18) edges += 1;
      samples += 1;
    }
  }

  return samples > 0 ? edges / samples : 0;
}
