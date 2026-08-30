import { z } from "zod";

import type { NormalizedQuad } from "@/lib/image/print-surface/types";
import type {
  ProductFamilyPlacementTemplate,
  ProductProfile,
  ProductVisualReference,
} from "@/lib/product-library/types";
import { resolveStrictContainFit } from "@/lib/image/artwork-compositing/strict-contain-fit";

export const productFamilySideSchema = z.enum(["FRONT", "BACK"]);
export type ProductFamilySide = z.infer<typeof productFamilySideSchema>;

export const normalizedPrintAreaSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine((box) => box.x + box.width <= 1 && box.y + box.height <= 1, {
    message: "Die Druckfläche muss im Bild liegen.",
  });
export type NormalizedPrintArea = z.infer<typeof normalizedPrintAreaSchema>;

export const ownerArtworkPlacementSchema = z
  .object({
    contractVersion: z.literal("owner-artwork-placement-v1"),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    uniformScale: z.number().min(0.1).max(1),
    offsetX: z.number().min(-1).max(1),
    offsetY: z.number().min(-1).max(1),
    aspectRatioPolicy: z.literal("LOCKED_UNIFORM_CONTAIN"),
  })
  .strict();
export type OwnerArtworkPlacement = z.infer<typeof ownerArtworkPlacementSchema>;

export function printAreaQuad(area: NormalizedPrintArea): NormalizedQuad {
  const box = normalizedPrintAreaSchema.parse(area);
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

export function defaultOwnerArtworkPlacement(
  template: Pick<ProductFamilyPlacementTemplate, "templateId" | "version">,
): OwnerArtworkPlacement {
  return ownerArtworkPlacementSchema.parse({
    contractVersion: "owner-artwork-placement-v1",
    templateId: template.templateId,
    templateVersion: template.version,
    uniformScale: 0.9,
    offsetX: 0,
    offsetY: 0,
    aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN",
  });
}

/** Resolve uniform scale + translation only; the approved Artwork ratio is immutable. */
export function resolveOwnerArtworkQuad(input: {
  printableArea: NormalizedPrintArea;
  artworkWidth: number;
  artworkHeight: number;
  referenceWidth: number;
  referenceHeight: number;
  placement: OwnerArtworkPlacement;
}): NormalizedQuad {
  const area = normalizedPrintAreaSchema.parse(input.printableArea);
  const placement = ownerArtworkPlacementSchema.parse(input.placement);
  if (
    input.artworkWidth <= 0 ||
    input.artworkHeight <= 0 ||
    input.referenceWidth <= 0 ||
    input.referenceHeight <= 0
  ) throw new Error("Artwork- und Produktbildmaße müssen positiv sein.");

  const fit = resolveStrictContainFit({
    sourceWidth: input.artworkWidth,
    sourceHeight: input.artworkHeight,
    target: {
      x: area.x * input.referenceWidth,
      y: area.y * input.referenceHeight,
      width: area.width * input.referenceWidth,
      height: area.height * input.referenceHeight,
    },
    ownerPlacement: placement,
  });
  const x = fit.rect.x / input.referenceWidth;
  const y = fit.rect.y / input.referenceHeight;
  const width = fit.rect.width / input.referenceWidth;
  const height = fit.rect.height / input.referenceHeight;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function garmentKind(productType: string): "TSHIRT" | "HOODIE" | "ZIP_HOODIE" | "JOGGER" | "OTHER" {
  const value = productType.toLocaleLowerCase("de-DE");
  if (/zip/.test(value) && /hood/.test(value)) return "ZIP_HOODIE";
  if (/hood/.test(value)) return "HOODIE";
  if (/jogger|pants|hose/.test(value)) return "JOGGER";
  if (/shirt|tee/.test(value)) return "TSHIRT";
  return "OTHER";
}

export type ProductFamilyReadiness = {
  ready: boolean;
  missing: string[];
};

/** Owner readiness means at least one color/side can complete a real path. */
export function resolveProductFamilyReadiness(
  profile: Omit<ProductProfile, "references"> & {
    references: Array<
      Omit<ProductVisualReference, "privateStoragePath"> & {
        privateStoragePath?: string | null;
      }
    >;
  },
): ProductFamilyReadiness {
  const family = profile.productFamily;
  const missing: string[] = [];
  if (
    !family?.active ||
    !["SAMPLE", "UPCOMING", "ACTIVE"].includes(profile.status)
  ) missing.push("Aktive Produktfamilie");
  const activeColors = family?.colors.filter((color) => color.active) ?? [];
  if (!activeColors.length) missing.push("Mindestens eine aktive Farbe");
  if (garmentKind(profile.productType) === "OTHER")
    missing.push("Unterstützter Bekleidungstyp");

  const readySides = new Set(
    family?.placementTemplates
      .filter((template) => template.status === "READY")
      .map((template) => template.side) ?? [],
  );
  const hasUsablePath = activeColors.some((color) =>
    profile.references.some(
      (reference) =>
        reference.purpose === "BLANK_PRODUCT" &&
        reference.providerEligible !== false &&
        reference.familyColorKey === color.colorKey &&
        reference.productSide != null &&
        readySides.has(reference.productSide) &&
        Boolean(reference.contentChecksumSha256) &&
        Boolean(reference.mimeType) &&
        Boolean(reference.byteLength),
    ),
  );
  if (!hasUsablePath)
    missing.push("Blank-Produktbild und gespeicherte Druckfläche für dieselbe Seite");
  return { ready: missing.length === 0, missing };
}

/**
 * Maps physical print intent into a conservative generated-garment anchor.
 * Calibration-image screen coordinates are deliberately not copied into a
 * lifestyle canvas. The Base purity guard remains the final fail-closed check.
 */
export function resolveGeneratedGarmentRelativeQuad(input: {
  productType: string;
  side: ProductFamilySide;
  placement: OwnerArtworkPlacement;
}): NormalizedQuad | null {
  const kind = garmentKind(input.productType);
  const anchors: Record<Exclude<ReturnType<typeof garmentKind>, "OTHER">, Record<ProductFamilySide, NormalizedPrintArea>> = {
    TSHIRT: {
      FRONT: { x: 0.33, y: 0.36, width: 0.34, height: 0.34 },
      BACK: { x: 0.32, y: 0.34, width: 0.36, height: 0.37 },
    },
    HOODIE: {
      FRONT: { x: 0.34, y: 0.37, width: 0.32, height: 0.27 },
      BACK: { x: 0.31, y: 0.36, width: 0.38, height: 0.34 },
    },
    ZIP_HOODIE: {
      FRONT: { x: 0.34, y: 0.38, width: 0.14, height: 0.23 },
      BACK: { x: 0.31, y: 0.36, width: 0.38, height: 0.34 },
    },
    JOGGER: {
      FRONT: { x: 0.28, y: 0.43, width: 0.16, height: 0.32 },
      BACK: { x: 0.56, y: 0.43, width: 0.16, height: 0.32 },
    },
  };
  if (kind === "OTHER") return null;
  const anchor = anchors[kind][input.side];
  const placement = ownerArtworkPlacementSchema.parse(input.placement);
  const width = anchor.width * placement.uniformScale;
  const height = anchor.height * placement.uniformScale;
  const travelX = (anchor.width - width) / 2;
  const travelY = (anchor.height - height) / 2;
  return printAreaQuad({
    x: anchor.x + travelX + placement.offsetX * travelX,
    y: anchor.y + travelY + placement.offsetY * travelY,
    width,
    height,
  });
}

export function selectStageAProductReferences(input: {
  profile: ProductProfile;
  color: string | null;
  side: ProductFamilySide | null;
}): ProductVisualReference[] {
  const colorKey = input.profile.productFamily?.colors.find(
    (color) => color.colorName.toLocaleLowerCase("de-DE") === input.color?.toLocaleLowerCase("de-DE"),
  )?.colorKey ?? null;
  const eligible = input.profile.references.filter(
    (reference) =>
      reference.providerEligible !== false &&
      reference.purpose !== "PRINT_AREA_CALIBRATION",
  );
  const exactBlank = eligible.filter(
    (reference) =>
      reference.purpose === "BLANK_PRODUCT" &&
      (!colorKey || reference.familyColorKey === colorKey) &&
      (!input.side || reference.productSide === input.side),
  );
  if (exactBlank.length) return exactBlank;
  const colorBlank = eligible.filter(
    (reference) =>
      reference.purpose === "BLANK_PRODUCT" &&
      (!colorKey || reference.familyColorKey === colorKey),
  );
  if (colorBlank.length) return colorBlank;
  const anyBlank = eligible.filter((reference) => reference.purpose === "BLANK_PRODUCT");
  return anyBlank.length ? anyBlank : eligible;
}
