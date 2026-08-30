import { z } from "zod";

import {
  printRegionSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";
import {
  normalizeProductShotKind,
  type ProductShotKind,
} from "@/lib/image/content-packs";

export const SEMANTIC_PRINT_PLACEMENT_VERSION =
  "semantic-print-placement-v1" as const;

export const printSideSchema = z.enum(["FRONT", "BACK", "BOTH"]);
export type PrintSide = z.infer<typeof printSideSchema>;

export const semanticPlacementPresetSchema = z.enum([
  "FRONT_LEFT_CHEST",
  "FRONT_CENTER_CHEST",
  "FRONT_LARGE",
  "BACK_UPPER",
  "BACK_CENTER",
  "BACK_LARGE",
  "LEFT_LEG",
  "RIGHT_LEG",
  "UPPER_LEFT_LEG",
  "UPPER_RIGHT_LEG",
  "HEADWEAR_FRONT",
  "HEADWEAR_SIDE",
]);
export type SemanticPlacementPreset = z.infer<
  typeof semanticPlacementPresetSchema
>;

export const bothSidePlacementPresetSchema = z.enum([
  "FRONT_LEFT_BACK_LARGE",
  "FRONT_CENTER_BACK_LARGE",
  "FRONT_SMALL_BACK_LARGE",
]);
export type BothSidePlacementPreset = z.infer<
  typeof bothSidePlacementPresetSchema
>;

type PlacementDefinition = {
  preset: SemanticPlacementPreset;
  side: Exclude<PrintSide, "BOTH">;
  label: string;
  compatibleProductKinds: readonly ProductShotKind[];
  regions: readonly z.infer<typeof printRegionSchema>[];
};

const UPPER_BODY_WITHOUT_ZIP: ProductShotKind[] = [
  "TSHIRT",
  "HOODIE",
  "JACKET",
];
const UPPER_BODY_WITH_ZIP: ProductShotKind[] = [
  ...UPPER_BODY_WITHOUT_ZIP,
  "ZIP_HOODIE",
];
const TROUSERS: ProductShotKind[] = ["JOGGER", "PANTS"];

export const SEMANTIC_PLACEMENT_DEFINITIONS: Readonly<
  Record<SemanticPlacementPreset, PlacementDefinition>
> = {
  FRONT_LEFT_CHEST: {
    preset: "FRONT_LEFT_CHEST",
    side: "FRONT",
    label: "Brust links",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
    regions: ["front_left_chest", "front_left"],
  },
  FRONT_CENTER_CHEST: {
    preset: "FRONT_CENTER_CHEST",
    side: "FRONT",
    label: "Brust mittig",
    compatibleProductKinds: UPPER_BODY_WITHOUT_ZIP,
    regions: ["front_center"],
  },
  FRONT_LARGE: {
    preset: "FRONT_LARGE",
    side: "FRONT",
    label: "Großer Frontprint",
    compatibleProductKinds: UPPER_BODY_WITHOUT_ZIP,
    regions: ["front_center"],
  },
  BACK_UPPER: {
    preset: "BACK_UPPER",
    side: "BACK",
    label: "Rücken oben",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
    regions: ["back_upper", "back_center"],
  },
  BACK_CENTER: {
    preset: "BACK_CENTER",
    side: "BACK",
    label: "Rücken mittig",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
    regions: ["back_center"],
  },
  BACK_LARGE: {
    preset: "BACK_LARGE",
    side: "BACK",
    label: "Großer Backprint",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
    regions: ["back_center"],
  },
  LEFT_LEG: {
    preset: "LEFT_LEG",
    side: "FRONT",
    label: "Linkes Bein",
    compatibleProductKinds: TROUSERS,
    regions: ["left_leg"],
  },
  RIGHT_LEG: {
    preset: "RIGHT_LEG",
    side: "FRONT",
    label: "Rechtes Bein",
    compatibleProductKinds: TROUSERS,
    regions: ["right_leg"],
  },
  UPPER_LEFT_LEG: {
    preset: "UPPER_LEFT_LEG",
    side: "FRONT",
    label: "Linker Oberschenkel",
    compatibleProductKinds: TROUSERS,
    regions: ["upper_left_leg"],
  },
  UPPER_RIGHT_LEG: {
    preset: "UPPER_RIGHT_LEG",
    side: "FRONT",
    label: "Rechter Oberschenkel",
    compatibleProductKinds: TROUSERS,
    regions: ["upper_right_leg"],
  },
  HEADWEAR_FRONT: {
    preset: "HEADWEAR_FRONT",
    side: "FRONT",
    label: "Frontpanel",
    compatibleProductKinds: ["HEADWEAR"],
    regions: ["front_panel"],
  },
  HEADWEAR_SIDE: {
    preset: "HEADWEAR_SIDE",
    side: "FRONT",
    label: "Seitlich",
    compatibleProductKinds: ["HEADWEAR"],
    regions: ["left_side", "right_side"],
  },
};

export const BOTH_SIDE_PLACEMENT_DEFINITIONS: Readonly<
  Record<
    BothSidePlacementPreset,
    {
      label: string;
      front: SemanticPlacementPreset;
      back: SemanticPlacementPreset;
      compatibleProductKinds: readonly ProductShotKind[];
    }
  >
> = {
  FRONT_LEFT_BACK_LARGE: {
    label: "Vorne Brust links + Hinten groß",
    front: "FRONT_LEFT_CHEST",
    back: "BACK_LARGE",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
  },
  FRONT_CENTER_BACK_LARGE: {
    label: "Vorne Brust mittig + Hinten groß",
    front: "FRONT_CENTER_CHEST",
    back: "BACK_LARGE",
    compatibleProductKinds: UPPER_BODY_WITHOUT_ZIP,
  },
  FRONT_SMALL_BACK_LARGE: {
    label: "Vorne klein + Hinten groß",
    front: "FRONT_LEFT_CHEST",
    back: "BACK_LARGE",
    compatibleProductKinds: UPPER_BODY_WITH_ZIP,
  },
};

export const semanticPrintPlacementSnapshotSchema = z
  .object({
    contractVersion: z.literal(SEMANTIC_PRINT_PLACEMENT_VERSION),
    printSide: z.enum(["FRONT", "BACK"]),
    placementPreset: semanticPlacementPresetSchema,
    displayLabel: z.string().min(1),
    resolvedPrintSurfaceId: z.string().min(1),
    resolvedPrintSurfaceVersion: z.number().int().positive(),
    resolvedRegion: printRegionSchema,
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const definition = SEMANTIC_PLACEMENT_DEFINITIONS[snapshot.placementPreset];
    if (definition.side !== snapshot.printSide) {
      ctx.addIssue({
        code: "custom",
        path: ["placementPreset"],
        message:
          "Semantic placement preset does not belong to the frozen print side.",
      });
    }
    if (!definition.regions.includes(snapshot.resolvedRegion)) {
      ctx.addIssue({
        code: "custom",
        path: ["resolvedRegion"],
        message:
          "Semantic placement does not resolve to the frozen PrintSurface region.",
      });
    }
  });
export type SemanticPrintPlacementSnapshot = z.infer<
  typeof semanticPrintPlacementSnapshotSchema
>;

export type SemanticPlacementResolution =
  | {
      ok: true;
      definition: PlacementDefinition;
      surface: PrintSurface;
    }
  | {
      ok: false;
      definition: PlacementDefinition;
      code:
        | "INCOMPATIBLE_PRODUCT"
        | "SIDE_MISMATCH"
        | "MISSING_SURFACE"
        | "SURFACE_REQUIRES_CALIBRATION"
        | "AMBIGUOUS_SURFACE";
      message: string;
    };

function variantMatches(
  surface: PrintSurface,
  variantId: string | null,
): boolean {
  return !surface.variantId || surface.variantId === variantId;
}

export function semanticPlacementOptions(input: {
  productType: string | null | undefined;
  side: Exclude<PrintSide, "BOTH">;
}): PlacementDefinition[] {
  const kind = normalizeProductShotKind(input.productType);
  return Object.values(SEMANTIC_PLACEMENT_DEFINITIONS).filter(
    (definition) =>
      definition.side === input.side &&
      definition.compatibleProductKinds.includes(kind),
  );
}

export function resolveSemanticPlacement(input: {
  productType: string | null | undefined;
  variantId: string | null;
  printSide: Exclude<PrintSide, "BOTH">;
  placementPreset: SemanticPlacementPreset;
  printSurfaces: readonly PrintSurface[];
}): SemanticPlacementResolution {
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  if (definition.side !== input.printSide) {
    return {
      ok: false,
      definition,
      code: "SIDE_MISMATCH",
      message: "Die Platzierung gehört nicht zur gewählten Druckseite.",
    };
  }
  const kind = normalizeProductShotKind(input.productType);
  if (!definition.compatibleProductKinds.includes(kind)) {
    return {
      ok: false,
      definition,
      code: "INCOMPATIBLE_PRODUCT",
      message: "Diese Platzierung passt nicht zum verifizierten Produkttyp.",
    };
  }
  const regionMatches = input.printSurfaces.filter(
    (surface) =>
      variantMatches(surface, input.variantId) &&
      definition.regions.includes(surface.region),
  );
  const ready = regionMatches.filter(
    (surface) =>
      surface.geometryStatus !== "REQUIRES_CALIBRATION" &&
      Boolean(surface.quad),
  );
  if (ready.length > 1) {
    return {
      ok: false,
      definition,
      code: "AMBIGUOUS_SURFACE",
      message:
        "Mehrere passende Druckflächen sind definiert. Wähle die genaue Fläche in der Produktbibliothek.",
    };
  }
  if (ready.length === 1) return { ok: true, definition, surface: ready[0]! };
  if (regionMatches.length > 0) {
    return {
      ok: false,
      definition,
      code: "SURFACE_REQUIRES_CALIBRATION",
      message: "Die passende Druckfläche benötigt noch eine Kalibrierung.",
    };
  }
  return {
    ok: false,
    definition,
    code: "MISSING_SURFACE",
    message:
      "Für dieses Produkt ist noch keine passende Druckfläche definiert.",
  };
}

export function semanticSurfaceIdentity(input: {
  placementPreset: SemanticPlacementPreset;
  variantId: string;
  physicalProductKey?: string;
}): { printSurfaceId: string; region: z.infer<typeof printRegionSchema> } {
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  const region = definition.regions[0]!;
  return {
    printSurfaceId: `${region.replaceAll("_", "-")}:${(
      input.physicalProductKey ?? input.variantId
    )
      .toLocaleLowerCase("de-DE")
      .replace(/[^a-z0-9:_-]+/g, "-")
      .slice(0, 120)}`,
    region,
  };
}

export function semanticPlacementSnapshot(input: {
  printSide: Exclude<PrintSide, "BOTH">;
  placementPreset: SemanticPlacementPreset;
  surface: PrintSurface;
}): SemanticPrintPlacementSnapshot {
  const definition = SEMANTIC_PLACEMENT_DEFINITIONS[input.placementPreset];
  return semanticPrintPlacementSnapshotSchema.parse({
    contractVersion: SEMANTIC_PRINT_PLACEMENT_VERSION,
    printSide: input.printSide,
    placementPreset: input.placementPreset,
    displayLabel: definition.label,
    resolvedPrintSurfaceId: input.surface.printSurfaceId,
    resolvedPrintSurfaceVersion: input.surface.version,
    resolvedRegion: input.surface.region,
  });
}

export function resolveBothSidePlan(input: {
  productType: string | null | undefined;
  variantId: string | null;
  preset: BothSidePlacementPreset;
  printSurfaces: readonly PrintSurface[];
}) {
  const definition = BOTH_SIDE_PLACEMENT_DEFINITIONS[input.preset];
  const kind = normalizeProductShotKind(input.productType);
  const compatible = definition.compatibleProductKinds.includes(kind);
  return {
    definition,
    compatible,
    front: compatible
      ? resolveSemanticPlacement({
          productType: input.productType,
          variantId: input.variantId,
          printSide: "FRONT",
          placementPreset: definition.front,
          printSurfaces: input.printSurfaces,
        })
      : null,
    back: compatible
      ? resolveSemanticPlacement({
          productType: input.productType,
          variantId: input.variantId,
          printSide: "BACK",
          placementPreset: definition.back,
          printSurfaces: input.printSurfaces,
        })
      : null,
  };
}

export const PRINT_SIDE_LABELS: Readonly<Record<PrintSide, string>> = {
  FRONT: "Vorne",
  BACK: "Hinten",
  BOTH: "Beidseitig",
};
