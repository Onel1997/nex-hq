import type { ImportedCreativeBlueprint } from "@/lib/image/image-studio-mission";
import type {
  ProductProductionContext,
  ProductProductionSelection,
} from "@/lib/image/product-production-context";

export function isAuthoritativeProductContext(
  context: ProductProductionContext | null | undefined,
): context is ProductProductionContext & {
  authority: "SHOPIFY_LIVE";
  authoritative: true;
  productId: string;
  variantId: string;
} {
  return (
    context?.authoritative === true &&
    context.authority === "SHOPIFY_LIVE" &&
    Boolean(context.productId) &&
    Boolean(context.variantId)
  );
}

export function isAuthoritativeProductSelection(
  selection: ProductProductionSelection | null | undefined,
): selection is Extract<ProductProductionSelection, { authority: "SHOPIFY_LIVE" }> {
  return (
    selection?.authority === "SHOPIFY_LIVE" &&
    Boolean(selection.productId) &&
    Boolean(selection.variantId)
  );
}

export function resolveImageStudioProductHeader(input: {
  productContext: ProductProductionContext | null;
  selectedProductLabel: string | null;
}): {
  value: string;
  authoritative: boolean;
  authorityLabel: string;
} {
  if (isAuthoritativeProductContext(input.productContext)) {
    return {
      value:
        input.selectedProductLabel ??
        `${input.productContext.productName} · ${input.productContext.color ?? "Variante"}`,
      authoritative: true,
      authorityLabel: "SHOPIFY_LIVE",
    };
  }

  return {
    value: "Kein Produkt ausgewählt",
    authoritative: false,
    authorityLabel: "UNSET",
  };
}

export function resolveDesignMissionHints(
  blueprint: ImportedCreativeBlueprint | null,
): {
  collection: string;
  garment: string;
  colorway: string;
} | null {
  if (!blueprint) return null;
  if (
    blueprint.collection === "—" &&
    blueprint.garment === "—" &&
    blueprint.colorway === "—"
  ) {
    return null;
  }
  return {
    collection: blueprint.collection,
    garment: blueprint.garment,
    colorway: blueprint.colorway,
  };
}

export function canPreparePaidImageEstimate(input: {
  briefReady: boolean;
  productContext: ProductProductionContext | null;
  masterArtworkApproved: boolean;
  hasBrandModel: boolean;
}): boolean {
  return (
    input.briefReady &&
    isAuthoritativeProductContext(input.productContext) &&
    input.masterArtworkApproved &&
    input.hasBrandModel
  );
}

export function resolvePrepareEstimateBlocker(input: {
  briefReady: boolean;
  productContext: ProductProductionContext | null;
  masterArtworkApproved: boolean;
  hasBrandModel: boolean;
}): string | null {
  if (!input.briefReady) {
    return "Übernimm zuerst ein kreatives Briefing, bevor du die Generierung vorbereitest.";
  }
  if (!input.masterArtworkApproved) {
    return "Ein freigegebenes Master Artwork ist erforderlich, bevor du die Generierung vorbereitest.";
  }
  if (!input.hasBrandModel) {
    return "Wähle ein für Bilder freigegebenes Markenmodel aus, bevor du die Generierung vorbereitest.";
  }
  if (!isAuthoritativeProductContext(input.productContext)) {
    return "Wähle ein Live-Shopify-Produkt aus, bevor du vorbereitest. Design-Hinweise sind keine Produktionswahrheit.";
  }
  return null;
}

export function isImageStudioHandoffDebugEnabled(
  search: string | null | undefined,
): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return params.get("handoffDebug") === "1";
}
