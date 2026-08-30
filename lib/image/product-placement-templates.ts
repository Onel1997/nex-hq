import { z } from "zod";

import {
  normalizeProductShotKind,
} from "@/lib/image/content-packs";
import {
  SEMANTIC_PLACEMENT_DEFINITIONS,
  semanticPlacementPresetSchema,
  type PrintSide,
  type SemanticPlacementPreset,
  type SemanticPlacementResolution,
} from "@/lib/image/semantic-print-placement";
import {
  printSurfaceSchema,
  type NormalizedQuad,
  type PrintSurface,
} from "@/lib/image/print-surface/types";

export const PRODUCT_PLACEMENT_TEMPLATE_VERSION =
  "product-placement-template-v1" as const;
export const PRODUCT_PLACEMENT_TEMPLATE_AUTHORITY =
  "NEXHQ_PRODUCT_TEMPLATE" as const;

export const productPlacementTemplateSchema = z
  .object({
    contractVersion: z.literal(PRODUCT_PLACEMENT_TEMPLATE_VERSION),
    templateId: z.string().min(1),
    version: z.number().int().positive(),
    authority: z.literal(PRODUCT_PLACEMENT_TEMPLATE_AUTHORITY),
    productKind: z.enum([
      "TSHIRT",
      "HOODIE",
      "ZIP_HOODIE",
      "JOGGER",
      "PANTS",
    ]),
    printSide: z.enum(["FRONT", "BACK"]),
    placementPreset: semanticPlacementPresetSchema,
    normalizedRegion: z.tuple([
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    ]),
  })
  .strict();

export type ProductPlacementTemplate = z.infer<
  typeof productPlacementTemplateSchema
>;

type SupportedProductKind = ProductPlacementTemplate["productKind"];

const quad = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): NormalizedQuad => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];

/**
 * Conservative normalized regions for known standard garment classes.
 * These are Product-family defaults, never Artwork-derived geometry. More
 * specific owner/Product surfaces always take precedence.
 */
const TEMPLATE_REGIONS: Readonly<
  Partial<Record<SupportedProductKind, Partial<Record<SemanticPlacementPreset, NormalizedQuad>>>>
> = {
  TSHIRT: {
    FRONT_LEFT_CHEST: quad(0.54, 0.24, 0.7, 0.39),
    FRONT_CENTER_CHEST: quad(0.4, 0.24, 0.6, 0.43),
    FRONT_LARGE: quad(0.3, 0.24, 0.7, 0.66),
    BACK_UPPER: quad(0.34, 0.2, 0.66, 0.43),
    BACK_CENTER: quad(0.32, 0.25, 0.68, 0.61),
    BACK_LARGE: quad(0.28, 0.22, 0.72, 0.68),
  },
  HOODIE: {
    FRONT_LEFT_CHEST: quad(0.54, 0.27, 0.7, 0.41),
    FRONT_CENTER_CHEST: quad(0.4, 0.27, 0.6, 0.44),
    FRONT_LARGE: quad(0.31, 0.27, 0.69, 0.58),
    BACK_UPPER: quad(0.34, 0.23, 0.66, 0.45),
    BACK_CENTER: quad(0.31, 0.27, 0.69, 0.62),
    BACK_LARGE: quad(0.28, 0.24, 0.72, 0.67),
  },
  ZIP_HOODIE: {
    FRONT_LEFT_CHEST: quad(0.55, 0.27, 0.71, 0.42),
    BACK_UPPER: quad(0.34, 0.23, 0.66, 0.45),
    BACK_CENTER: quad(0.31, 0.27, 0.69, 0.62),
    BACK_LARGE: quad(0.28, 0.24, 0.72, 0.67),
  },
  JOGGER: {
    LEFT_LEG: quad(0.27, 0.32, 0.43, 0.72),
    RIGHT_LEG: quad(0.57, 0.32, 0.73, 0.72),
    UPPER_LEFT_LEG: quad(0.25, 0.25, 0.44, 0.46),
    UPPER_RIGHT_LEG: quad(0.56, 0.25, 0.75, 0.46),
  },
  PANTS: {
    LEFT_LEG: quad(0.27, 0.32, 0.43, 0.72),
    RIGHT_LEG: quad(0.57, 0.32, 0.73, 0.72),
    UPPER_LEFT_LEG: quad(0.25, 0.25, 0.44, 0.46),
    UPPER_RIGHT_LEG: quad(0.56, 0.25, 0.75, 0.46),
  },
};

function supportedKind(productType: string | null | undefined): SupportedProductKind | null {
  const kind = normalizeProductShotKind(productType);
  return kind in TEMPLATE_REGIONS ? (kind as SupportedProductKind) : null;
}

export function resolveProductPlacementTemplate(input: {
  productType: string | null | undefined;
  printSide: Exclude<PrintSide, "BOTH">;
  placementPreset: SemanticPlacementPreset;
}): ProductPlacementTemplate | null {
  const productKind = supportedKind(input.productType);
  if (!productKind) return null;
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  if (
    definition.side !== input.printSide ||
    !definition.compatibleProductKinds.includes(productKind)
  )
    return null;
  const normalizedRegion = TEMPLATE_REGIONS[productKind]?.[input.placementPreset];
  if (!normalizedRegion) return null;
  return productPlacementTemplateSchema.parse({
    contractVersion: PRODUCT_PLACEMENT_TEMPLATE_VERSION,
    templateId: `nexhq:${productKind.toLocaleLowerCase("en-US")}:${input.placementPreset.toLocaleLowerCase("en-US")}`,
    version: 1,
    authority: PRODUCT_PLACEMENT_TEMPLATE_AUTHORITY,
    productKind,
    printSide: input.printSide,
    placementPreset: input.placementPreset,
    normalizedRegion,
  });
}

export function printSurfaceFromProductTemplate(input: {
  template: ProductPlacementTemplate;
  productProfileId: string;
}): PrintSurface {
  const definition =
    SEMANTIC_PLACEMENT_DEFINITIONS[input.template.placementPreset];
  const [topLeft, topRight, bottomRight] = input.template.normalizedRegion;
  return printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: input.template.templateId,
    version: input.template.version,
    productProfileId: input.productProfileId,
    variantId: null,
    region: definition.regions[0],
    displayName: definition.label,
    surfaceKind: "PRINT",
    supportedPrintMethods: ["UNKNOWN"],
    geometryStatus: "CALIBRATED",
    quad: input.template.normalizedRegion,
    boundingBox: {
      x: topLeft.x,
      y: topLeft.y,
      width: topRight.x - topLeft.x,
      height: bottomRight.y - topRight.y,
    },
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "NONE",
    provenance: {
      source: PRODUCT_PLACEMENT_TEMPLATE_AUTHORITY,
      calibratedBy: null,
      calibratedAt: null,
    },
  });
}

export type AutomaticPlacementResolution = SemanticPlacementResolution & {
  authority?:
    | "OWNER_OR_PRODUCT_SURFACE"
    | "PRODUCT_FAMILY_SURFACE"
    | "NEXHQ_PRODUCT_TEMPLATE";
  template?: ProductPlacementTemplate;
};

function resolveTier(input: {
  productType: string | null | undefined;
  variantId: string | null;
  printSide: Exclude<PrintSide, "BOTH">;
  placementPreset: SemanticPlacementPreset;
  surfaces: readonly PrintSurface[];
}): SemanticPlacementResolution {
  // Imported lazily at module level would create a semantic-placement cycle;
  // use the stable definition rules directly for this narrow tier resolution.
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  const ready = input.surfaces.filter(
    (surface) =>
      (!surface.variantId || surface.variantId === input.variantId) &&
      definition.regions.includes(surface.region) &&
      surface.geometryStatus !== "REQUIRES_CALIBRATION" &&
      Boolean(surface.quad),
  );
  if (ready.length === 1)
    return { ok: true, definition, surface: ready[0]! };
  if (ready.length > 1)
    return {
      ok: false,
      definition,
      code: "AMBIGUOUS_SURFACE",
      message:
        "Mehrere passende Druckflächen sind definiert. Wähle die genaue Fläche in der Produktbibliothek.",
    };
  return {
    ok: false,
    definition,
    code: "MISSING_SURFACE",
    message: "Für dieses Produkt ist noch keine passende Druckfläche definiert.",
  };
}

/**
 * Resolve production geometry in strict precedence order:
 * exact Product surface → verified family surface → NexHQ standard template.
 */
export function resolveAutomaticProductPlacement(input: {
  productProfileId: string;
  productType: string | null | undefined;
  variantId: string | null;
  printSide: Exclude<PrintSide, "BOTH">;
  placementPreset: SemanticPlacementPreset;
  printSurfaces: readonly PrintSurface[];
}): AutomaticPlacementResolution {
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  const kind = normalizeProductShotKind(input.productType);
  if (definition.side !== input.printSide)
    return {
      ok: false,
      definition,
      code: "SIDE_MISMATCH",
      message: "Die Platzierung gehört nicht zur gewählten Druckseite.",
    };
  if (!definition.compatibleProductKinds.includes(kind))
    return {
      ok: false,
      definition,
      code: "INCOMPATIBLE_PRODUCT",
      message: "Diese Platzierung passt nicht zum verifizierten Produkttyp.",
    };

  const exact = resolveTier({
    ...input,
    surfaces: input.printSurfaces.filter(
      (surface) => surface.productProfileId === input.productProfileId,
    ),
  });
  if (exact.ok) return { ...exact, authority: "OWNER_OR_PRODUCT_SURFACE" };
  if (exact.code === "AMBIGUOUS_SURFACE") return exact;

  const family = resolveTier({
    ...input,
    surfaces: input.printSurfaces.filter(
      (surface) => surface.productProfileId !== input.productProfileId,
    ),
  });
  if (family.ok) return { ...family, authority: "PRODUCT_FAMILY_SURFACE" };
  if (family.code === "AMBIGUOUS_SURFACE") return family;

  const template = resolveProductPlacementTemplate(input);
  if (!template)
    return {
      ok: false,
      definition,
      code: "MISSING_SURFACE",
      message:
        "Für dieses Produkt ist keine sichere Standard-Platzierung verfügbar. Richte sie unter den technischen Produktdaten ein.",
    };
  return {
    ok: true,
    definition,
    surface: printSurfaceFromProductTemplate({
      template,
      productProfileId: input.productProfileId,
    }),
    authority: "NEXHQ_PRODUCT_TEMPLATE",
    template,
  };
}
