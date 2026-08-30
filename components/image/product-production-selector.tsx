"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProductProductionSelection,
  ProductProductionContext,
} from "@/lib/image/product-production-context";
import {
  fetchImageProductProductionContext,
  toImageProductSelection,
  type ImageProductSelection,
} from "@/lib/image/product-production-client";
import {
  findGarmentFamily,
  formatGarmentFamilySecondaryLabel,
  groupShopifyProductsIntoGarmentFamilies,
  listSizesForGarmentFamilyColor,
  resolveShopifyVariantForGarmentSelection,
  type ShopifyGarmentCatalogProduct,
} from "@/lib/image/product-garment-family";
import { resolveDefaultGarmentSize } from "@/lib/image/product-size-default";
import type { ProductProfile } from "@/lib/product-library/types";
import {
  physicalProductFamilySelectionSchema,
  reusablePrintSurfacesForProduct,
} from "@/lib/product-library/print-surface-reuse";
import { loadCachedOwnerData } from "@/lib/image/client-owner-data-cache";

/* Owner-safe profile view; private paths are removed by the API. */
type ProfileView = Omit<ProductProfile, "references"> & {
  references: Array<{
    referenceId: string;
    role: string;
    contentChecksumSha256: string | null;
    previewUrl?: string | null;
    purpose?: "PRODUCT_REFERENCE" | "BLANK_PRODUCT" | "PRINT_AREA_CALIBRATION";
    familyColorKey?: string | null;
    productSide?: "FRONT" | "BACK" | null;
    width?: number | null;
    height?: number | null;
  }>;
};

function manualContext(
  profile: ProfileView,
  variantId: string,
): ProductProductionContext {
  const variant = profile.variants.find(
    (item) => item.variantId === variantId,
  )!;
  return {
    version: "product-production-context-v1",
    productId: profile.productProfileId,
    variantId,
    productName: profile.name,
    productType: profile.productType,
    color: variant.color,
    size: variant.size,
    material:
      profile.construction.primaryMaterial ?? profile.construction.material,
    fit: profile.construction.fit,
    collection: profile.collections[0] ?? null,
    availability: "UNKNOWN",
    active: null,
    authority: "MANUAL_PROFILE",
    authoritative: false,
    provenance: {
      source: profile.provenance.source,
      sourceRecordId: profile.productProfileId,
      capturedAt: profile.provenance.capturedAt,
      sourceVersion: `product-profile-v${profile.version}`,
    },
  };
}

export function ProductProductionSelector({
  onSelectionChange,
}: {
  onSelectionChange: (selection: ImageProductSelection | null) => void;
}) {
  const [source, setSource] = useState<"shopify" | "manual">("manual");
  const [products, setProducts] = useState<ShopifyGarmentCatalogProduct[]>([]);
  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [familyKey, setFamilyKey] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [status, setStatus] = useState("Produktwissen wird geladen…");
  const [resolving, setResolving] = useState(false);
  const [manualLoading, setManualLoading] = useState(true);
  const [shopifyLoading, setShopifyLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Product Families are the normal owner path and must not wait for the
    // independent live Shopify catalog. Each source settles as soon as its own
    // authority responds; concurrent mounts share the stable read request.
    void loadCachedOwnerData<{ profiles?: ProfileView[] }>({
      key: "image:product-family-production-v1",
      ttlMs: 60_000,
      load: async () => {
        const response = await fetch(
          "/api/product-library/profiles?view=image-production",
          { cache: "no-store" },
        );
        const payload = (await response.json()) as { profiles?: ProfileView[] };
        if (!response.ok) throw new Error("Produktfamilien nicht verfügbar");
        return payload;
      },
    })
      .then((library) => {
        if (cancelled) return;
        setProfiles(library.profiles ?? []);
        setStatus("Als Nächstes: Wähle Produkt, Farbe und Größe aus.");
      })
      .catch(() => {
        if (!cancelled) setStatus("Produktfamilien konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setManualLoading(false);
      });

    void loadCachedOwnerData<{ products?: ShopifyGarmentCatalogProduct[] }>({
      key: "image:shopify-garment-catalog-v1",
      ttlMs: 30_000,
      load: async () => {
        const response = await fetch("/api/image/product-context", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          products?: ShopifyGarmentCatalogProduct[];
        };
        if (!response.ok) throw new Error("Shopify-Katalog nicht verfügbar");
        return payload;
      },
    })
      .then((catalog) => {
        if (cancelled) return;
        setProducts(
          (catalog.products ?? []).filter((product) => product.active !== false),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setShopifyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const garmentFamilies = useMemo(
    () => groupShopifyProductsIntoGarmentFamilies(products),
    [products],
  );
  const selectedFamily = useMemo(
    () => findGarmentFamily(garmentFamilies, familyKey),
    [garmentFamilies, familyKey],
  );
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.productProfileId === productId) ?? null,
    [profiles, productId],
  );
  const manualProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.authority === "MANUAL_PROFILE" &&
          profile.productFamily?.active !== false,
      ),
    [profiles],
  );
  const availableSizes = useMemo(() => {
    if (!selectedFamily || !color) return [];
    return listSizesForGarmentFamilyColor(products, selectedFamily, color);
  }, [products, selectedFamily, color]);

  const reset = (next: "shopify" | "manual") => {
    setSource(next);
    setFamilyKey("");
    setColor("");
    setSize("");
    setProductId("");
    setVariantId("");
    onSelectionChange(null);
    setStatus(
      next === "shopify"
        ? "Als Nächstes: Wähle Produkt, Farbe und Größe aus."
        : "Wähle ein produktionsbereites manuelles Produkt.",
    );
  };

  const resolveShopify = useCallback(
    async (input: {
      familyKey: string;
      color: string;
      size: string;
      productId: string;
      variantId: string;
      garmentFamilyLabel: string;
      familyProductIds: string[];
      familySourceLabel: string | null;
    }) => {
      if (!input.productId || !input.variantId) {
        onSelectionChange(null);
        setStatus("Wähle Produkt, Farbe und Größe aus.");
        return;
      }
      setResolving(true);
      try {
        const selection = {
          authority: "SHOPIFY_LIVE",
          productId: input.productId,
          variantId: input.variantId,
        } as const;
        const context = await fetchImageProductProductionContext(selection);
        const profile = profiles.find(
          (candidate) =>
            candidate.authority === "SHOPIFY_LIVE" &&
            candidate.shopifyProductId === input.productId,
        );
        const physicalProductFamily =
          physicalProductFamilySelectionSchema.parse({
            key: input.familyKey,
            label: input.garmentFamilyLabel,
            memberShopifyProductIds: input.familyProductIds,
            sourceLabel: input.familySourceLabel,
          });
        const reusablePrintSurfaces = reusablePrintSurfacesForProduct({
          profiles,
          selectedProfile: profile ?? null,
          selectedShopifyProductId: input.productId,
          physicalFamily: physicalProductFamily,
        });
        onSelectionChange(
          toImageProductSelection(selection, context, {
            garmentFamilyLabel: input.garmentFamilyLabel,
            physicalProductFamily,
            reusablePrintSurfaces,
            productProfile: profile
              ? {
                  profileKey: profile.productProfileId,
                  version: profile.version,
                  variantId: input.variantId,
                  authority: "SHOPIFY_LIVE",
                  printSurface: null,
                  printSurfaces: reusablePrintSurfaces.map(
                    (candidate) => candidate.surface,
                  ),
                  reusablePrintSurfaces,
                  physicalProductFamily,
                }
              : null,
          }),
        );
        setStatus(
          `Shopify verifiziert · ${input.garmentFamilyLabel} · ${input.color} · ${input.size}`,
        );
      } catch (e) {
        onSelectionChange(null);
        setStatus(
          e instanceof Error ? e.message : "Shopify-Prüfung fehlgeschlagen.",
        );
      } finally {
        setResolving(false);
      }
    },
    [onSelectionChange, profiles],
  );

  const resolveManual = (pid: string, vid: string) => {
    const profile = profiles.find((p) => p.productProfileId === pid);
    const variant = profile?.variants.find((v) => v.variantId === vid);
    const blockers: string[] = [];
    if (!profile) blockers.push("Manuelles Produkt auswählen.");
    if (profile && ["DRAFT", "ARCHIVED"].includes(profile.status))
      blockers.push("Produktstatus muss Muster, Geplant oder Aktiv sein.");
    if (!variant) blockers.push("Genaue Variante auswählen.");
    if (
      profile &&
      !profile.references.some(
        (r) =>
          ["FEATURED", "FRONT"].includes(r.role) && r.contentChecksumSha256,
      )
    )
      blockers.push("Privates Haupt- oder Vorderseitenbild fehlt.");
    if (!profile || !variant) {
      onSelectionChange(null);
      setStatus(blockers.join(" "));
      return;
    }
    const selection: Extract<
      ProductProductionSelection,
      { authority: "MANUAL_PROFILE" }
    > = {
      authority: "MANUAL_PROFILE",
      productProfileId: profile.productProfileId,
      profileVersion: profile.version,
      variantId: variant.variantId,
    };
    onSelectionChange({
      selection,
      productionContext: manualContext(profile, vid),
      garmentFamilyLabel: profile.productType,
      productProfile: {
        profileKey: profile.productProfileId,
        version: profile.version,
        variantId: vid,
        authority: "MANUAL_PROFILE",
        printSurface: null,
        printSurfaces: profile.printSurfaces,
        productFamily: profile.productFamily,
        blankReferences: (() => {
          const selectedColor = profile.productFamily?.colors.find(
            (entry) => entry.colorName === variant.color,
          );
          return profile.references.filter(
            (entry) =>
              entry.purpose === "BLANK_PRODUCT" &&
              entry.familyColorKey === selectedColor?.colorKey,
          ).flatMap((reference) =>
            reference.productSide && selectedColor
              ? [{
                  referenceId: reference.referenceId,
                  previewUrl: reference.previewUrl ?? null,
                  width: reference.width ?? null,
                  height: reference.height ?? null,
                  side: reference.productSide,
                  colorKey: selectedColor.colorKey,
                }]
              : [],
          );
        })(),
      },
      readiness: { eligible: blockers.length === 0, blockers },
    });
    setStatus(
      blockers.length
        ? `Manuelles Produkt ausgewählt · ${blockers.join(" ")}`
        : `Manuelles Produkt · ${profile.name} · Produktwissen bereit`,
    );
  };

  const applyShopifySelection = useCallback(
    async (nextFamilyKey: string, nextColor: string, nextSize: string) => {
      const family = findGarmentFamily(garmentFamilies, nextFamilyKey);
      if (!family || !nextColor || !nextSize) {
        onSelectionChange(null);
        setStatus(
          family && nextColor
            ? "Wähle eine Größe aus."
            : family
              ? "Wähle eine Farbe aus."
              : "Wähle ein Produkt aus.",
        );
        return;
      }
      const resolved = resolveShopifyVariantForGarmentSelection({
        products,
        family,
        color: nextColor,
        size: nextSize,
      });
      if (!resolved) {
        onSelectionChange(null);
        setStatus(
          "Für diese Kombination ist keine exakte Shopify-Variante verfügbar.",
        );
        return;
      }
      setProductId(resolved.productId);
      setVariantId(resolved.variantId);
      await resolveShopify({
        familyKey: nextFamilyKey,
        color: nextColor,
        size: nextSize,
        productId: resolved.productId,
        variantId: resolved.variantId,
        garmentFamilyLabel: family.label,
        familyProductIds: family.productIds,
        familySourceLabel: family.sourceLabel,
      });
    },
    [garmentFamilies, onSelectionChange, products, resolveShopify],
  );

  return (
    <div className="is-owner-selector">
      <div
        className="is-owner-selector__sources"
        role="tablist"
        aria-label="Produktquelle"
      >
        <button
          type="button"
          className={source === "shopify" ? "is-active" : ""}
          onClick={() => reset("shopify")}
        >
          Shopify-Familien
        </button>
        <button
          type="button"
          className={source === "manual" ? "is-active" : ""}
          onClick={() => reset("manual")}
        >
          Produktfamilien
        </button>
      </div>
      <div className="is-owner-selector__head">
        <span
          className={`nx-status ${source === "shopify" ? "nx-status--success" : ""}`}
        >
          {source === "shopify" ? "Shopify verifiziert" : "Produktfamilie"}
        </span>
      </div>
      {source === "shopify" ? (
        <>
          <label htmlFor="image-product-family-select">Produkt</label>
          <select
            id="image-product-family-select"
            value={familyKey}
            disabled={resolving || shopifyLoading}
            onChange={(e) => {
              const nextFamilyKey = e.target.value;
              setFamilyKey(nextFamilyKey);
              setColor("");
              setSize("");
              setProductId("");
              setVariantId("");
              onSelectionChange(null);
              setStatus(
                nextFamilyKey
                  ? "Wähle eine Farbe aus."
                  : "Als Nächstes: Wähle Produkt, Farbe und Größe aus.",
              );
            }}
          >
            <option value="">
              {shopifyLoading
                ? "Verfügbarkeit wird geprüft …"
                : "Kein Produkt ausgewählt"}
            </option>
            {garmentFamilies.map((family) => (
              <option key={family.key} value={family.key}>
                {family.label}
              </option>
            ))}
          </select>
          {selectedFamily ? (
            <p className="is-owner-selector__meta">
              {formatGarmentFamilySecondaryLabel(selectedFamily)}
            </p>
          ) : null}
          {selectedFamily ? (
            <>
              <label htmlFor="image-color-select">Farbe</label>
              <select
                id="image-color-select"
                value={color}
                disabled={resolving}
                onChange={(e) => {
                  const nextColor = e.target.value;
                  const nextSizes = nextColor
                    ? listSizesForGarmentFamilyColor(
                        products,
                        selectedFamily,
                        nextColor,
                      )
                    : [];
                  const nextSize = nextColor
                    ? (resolveDefaultGarmentSize({
                        availableSizes: nextSizes,
                        garmentFamilyLabel: selectedFamily.label,
                        productType: selectedFamily.productType,
                      }) ?? "")
                    : "";
                  setColor(nextColor);
                  setSize(nextSize);
                  setProductId("");
                  setVariantId("");
                  onSelectionChange(null);
                  if (!nextColor) {
                    setStatus("Wähle eine Farbe aus.");
                    return;
                  }
                  if (!nextSize) {
                    setStatus("Für diese Farbe ist keine Größe verfügbar.");
                    return;
                  }
                  void applyShopifySelection(
                    selectedFamily.key,
                    nextColor,
                    nextSize,
                  );
                }}
              >
                <option value="">Farbe auswählen</option>
                {selectedFamily.colors.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {selectedFamily && color ? (
            <>
              <label htmlFor="image-size-select">Größe</label>
              <select
                id="image-size-select"
                value={size}
                disabled={resolving}
                onChange={(e) => {
                  const nextSize = e.target.value;
                  setSize(nextSize);
                  setProductId("");
                  setVariantId("");
                  onSelectionChange(null);
                  if (!nextSize) {
                    setStatus("Wähle eine Größe aus.");
                    return;
                  }
                  void applyShopifySelection(
                    selectedFamily.key,
                    color,
                    nextSize,
                  );
                }}
              >
                <option value="">Größe auswählen</option>
                {availableSizes.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </>
      ) : (
        <>
          <label htmlFor="image-product-select">Produktfamilie</label>
          <select
            id="image-product-select"
            value={productId}
            disabled={resolving || manualLoading}
            onChange={(e) => {
              setProductId(e.target.value);
              setVariantId("");
              setColor("");
              setSize("");
              onSelectionChange(null);
            }}
          >
            <option value="">
              {manualLoading
                ? "Produktfamilien werden geladen …"
                : "Produktfamilie auswählen"}
            </option>
            {manualProfiles.map((p) => (
              <option key={p.productProfileId} value={p.productProfileId}>
                {p.name} · {p.productType}
              </option>
            ))}
          </select>
          {selectedProfile ? (
            <>
              <label htmlFor="image-variant-select">Farbe</label>
              <select
                id="image-variant-select"
                value={color}
                disabled={resolving}
                onChange={(e) => {
                  const nextColor = e.target.value;
                  const nextSize = selectedProfile.sizes[0] ?? null;
                  const next = selectedProfile.variants.find(
                    (variant) =>
                      variant.color === nextColor &&
                      (!nextSize || variant.size === nextSize),
                  );
                  setColor(nextColor);
                  setSize(nextSize ?? "");
                  setVariantId(next?.variantId ?? "");
                  if (next) resolveManual(productId, next.variantId);
                  else onSelectionChange(null);
                }}
              >
                <option value="">Farbe auswählen</option>
                {(selectedProfile.productFamily?.colors ?? selectedProfile.colorways.map((colorName, index) => ({ colorId: `legacy:${index}`, colorName }))).map((entry) => (
                  <option key={entry.colorId} value={entry.colorName}>
                    {entry.colorName}
                  </option>
                ))}
              </select>
              {color && selectedProfile.sizes.length ? (
                <>
                  <label htmlFor="image-manual-size-select">Größe</label>
                  <select
                    id="image-manual-size-select"
                    value={size}
                    disabled={resolving}
                    onChange={(event) => {
                      const nextSize = event.target.value;
                      const next = selectedProfile.variants.find(
                        (variant) =>
                          variant.color === color && variant.size === nextSize,
                      );
                      setSize(nextSize);
                      setVariantId(next?.variantId ?? "");
                      if (next) resolveManual(productId, next.variantId);
                      else onSelectionChange(null);
                    }}
                  >
                    {selectedProfile.sizes.map((entry) => (
                      <option key={entry}>{entry}</option>
                    ))}
                  </select>
                </>
              ) : null}
            </>
          ) : null}
          {variantId && selectedProfile ? (
            <p className="nx-help">
              {selectedProfile.construction.primaryMaterial ??
                "Material unbekannt"}
              {selectedProfile.construction.gsm
                ? ` · ${selectedProfile.construction.gsm} GSM`
                : ""}
              {selectedProfile.construction.fit
                ? ` · ${selectedProfile.construction.fit}`
                : ""}
            </p>
          ) : null}
        </>
      )}
      <p className="is-owner-selector__status" role="status" aria-live="polite">
        {resolving ? "Wird geprüft… " : ""}
        {status}
      </p>
    </div>
  );
}
