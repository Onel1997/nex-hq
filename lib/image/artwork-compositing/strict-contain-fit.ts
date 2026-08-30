export const STRICT_CONTAIN_FIT_VERSION =
  "nexhq-strict-artwork-contain-fit-v1" as const;
export const STRICT_CONTAIN_OWNER_ERROR =
  "Das Artwork konnte in dieser Druckfläche nicht ohne Verzerrung oder Beschnitt platziert werden." as const;

export type StrictContainOwnerPlacement = {
  uniformScale: number;
  offsetX: number;
  offsetY: number;
};

export type StrictContainFitDiagnostics = {
  contractVersion: typeof STRICT_CONTAIN_FIT_VERSION;
  fitMode: "CONTAIN";
  originalArtworkWidth: number;
  originalArtworkHeight: number;
  originalArtworkAspectRatio: number;
  targetPrintableArea: { x: number; y: number; width: number; height: number };
  targetPrintableAreaAspectRatio: number;
  baseContainScale: number;
  effectiveUniformScale: number;
  unusedHorizontalSpace: number;
  unusedVerticalSpace: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  ownerScale: number;
  ratioPreserved: true;
  cropApplied: false;
  distortionApplied: false;
};

export type StrictContainFit = {
  rect: { x: number; y: number; width: number; height: number };
  diagnostics: StrictContainFitDiagnostics;
};

const DEFAULT_OWNER_PLACEMENT: StrictContainOwnerPlacement = {
  uniformScale: 1,
  offsetX: 0,
  offsetY: 0,
};

/**
 * One canonical, unit-agnostic contain calculation for preview and production.
 * Owner translation uses only the space left after contain + uniform scaling,
 * so the complete immutable Artwork can never leave the printable rectangle.
 */
export function resolveStrictContainFit(input: {
  sourceWidth: number;
  sourceHeight: number;
  target: { x: number; y: number; width: number; height: number };
  ownerPlacement?: StrictContainOwnerPlacement;
}): StrictContainFit {
  const owner = input.ownerPlacement ?? DEFAULT_OWNER_PLACEMENT;
  const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
  if (
    !finitePositive(input.sourceWidth) ||
    !finitePositive(input.sourceHeight) ||
    !finitePositive(input.target.width) ||
    !finitePositive(input.target.height) ||
    !Number.isFinite(input.target.x) ||
    !Number.isFinite(input.target.y) ||
    !finitePositive(owner.uniformScale) ||
    owner.uniformScale > 1 ||
    !Number.isFinite(owner.offsetX) ||
    !Number.isFinite(owner.offsetY) ||
    Math.abs(owner.offsetX) > 1 ||
    Math.abs(owner.offsetY) > 1
  ) {
    throw new Error(STRICT_CONTAIN_OWNER_ERROR);
  }

  const baseContainScale = Math.min(
    input.target.width / input.sourceWidth,
    input.target.height / input.sourceHeight,
  );
  const effectiveUniformScale = baseContainScale * owner.uniformScale;
  const width = input.sourceWidth * effectiveUniformScale;
  const height = input.sourceHeight * effectiveUniformScale;
  const unusedHorizontalSpace = Math.max(0, input.target.width - width);
  const unusedVerticalSpace = Math.max(0, input.target.height - height);
  const x =
    input.target.x +
    unusedHorizontalSpace / 2 +
    owner.offsetX * (unusedHorizontalSpace / 2);
  const y =
    input.target.y +
    unusedVerticalSpace / 2 +
    owner.offsetY * (unusedVerticalSpace / 2);
  const epsilon = 1e-7;
  if (
    x < input.target.x - epsilon ||
    y < input.target.y - epsilon ||
    x + width > input.target.x + input.target.width + epsilon ||
    y + height > input.target.y + input.target.height + epsilon ||
    Math.abs(width / height - input.sourceWidth / input.sourceHeight) > epsilon
  ) {
    throw new Error(STRICT_CONTAIN_OWNER_ERROR);
  }

  return {
    rect: { x, y, width, height },
    diagnostics: {
      contractVersion: STRICT_CONTAIN_FIT_VERSION,
      fitMode: "CONTAIN",
      originalArtworkWidth: input.sourceWidth,
      originalArtworkHeight: input.sourceHeight,
      originalArtworkAspectRatio: input.sourceWidth / input.sourceHeight,
      targetPrintableArea: { ...input.target },
      targetPrintableAreaAspectRatio:
        input.target.width / input.target.height,
      baseContainScale,
      effectiveUniformScale,
      unusedHorizontalSpace,
      unusedVerticalSpace,
      ownerOffsetX: owner.offsetX,
      ownerOffsetY: owner.offsetY,
      ownerScale: owner.uniformScale,
      ratioPreserved: true,
      cropApplied: false,
      distortionApplied: false,
    },
  };
}
