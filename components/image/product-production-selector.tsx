"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductProductionSelection } from "@/lib/image/product-production-context";
import {
  fetchImageProductProductionContext,
  toImageProductSelection,
  type ImageProductSelection,
} from "@/lib/image/product-production-client";

type LiveVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  updatedAt: string;
};

type LiveProduct = {
  id: string;
  title: string;
  productType: string;
  status: string;
  active: boolean;
  collections: string[];
  updatedAt: string;
  variants: LiveVariant[];
};

export function ProductProductionSelector({
  onSelectionChange,
}: {
  onSelectionChange: (selection: ImageProductSelection | null) => void;
}) {
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [status, setStatus] = useState("Checking live Shopify catalog…");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/image/product-context", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          products?: LiveProduct[];
          error?: string;
        };
        if (!response.ok || !payload.products) {
          throw new Error(payload.error ?? "Shopify catalog unavailable");
        }
        if (cancelled) return;
        const active = payload.products.filter((product) => product.active);
        setProducts(active);
        setStatus(
          active.length
            ? "Select a live Shopify product and exact variant before Prepare / Estimate."
            : "No active Shopify products returned. Paid preparation stays blocked until a product is available.",
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(
            `${error instanceof Error ? error.message : "Shopify unavailable"}. Paid preparation stays blocked until a live product can be selected.`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [productId, products],
  );

  const resolveSelection = useCallback(
    async (nextProductId: string, nextVariantId: string) => {
      if (!nextProductId) {
        onSelectionChange(null);
        setStatus(
          products.length
            ? "Select a live Shopify product and exact variant before Prepare / Estimate."
            : "No active Shopify products returned. Paid preparation stays blocked until a product is available.",
        );
        return;
      }

      const product = products.find((item) => item.id === nextProductId);
      if (!product) {
        onSelectionChange(null);
        setStatus("Selected product is no longer in the live Shopify catalog.");
        return;
      }

      if (!nextVariantId) {
        onSelectionChange(null);
        setStatus(`Select an exact variant for ${product.title} before Prepare / Estimate.`);
        return;
      }

      const variant = product.variants.find((item) => item.id === nextVariantId);
      if (!variant) {
        onSelectionChange(null);
        setStatus("Selected variant is no longer on the live Shopify product.");
        return;
      }

      const selection: Extract<ProductProductionSelection, { authority: "SHOPIFY_LIVE" }> = {
        authority: "SHOPIFY_LIVE",
        productId: nextProductId,
        variantId: nextVariantId,
      };

      setResolving(true);
      setStatus("Verifying live Shopify product + variant…");
      try {
        const productionContext = await fetchImageProductProductionContext(selection);
        onSelectionChange(toImageProductSelection(selection, productionContext));
        setStatus(
          `Verified ${productionContext.productName} · ${productionContext.color ?? variant.title} · ${productionContext.size ?? "variant"} (${productionContext.availability.toLowerCase()}).`,
        );
      } catch (error) {
        onSelectionChange(null);
        setStatus(
          error instanceof Error
            ? error.message
            : "Live Shopify product context could not be verified.",
        );
      } finally {
        setResolving(false);
      }
    },
    [onSelectionChange, products],
  );

  return (
    <div>
      <label htmlFor="image-product-select">Product</label>
      <select
        id="image-product-select"
        value={productId}
        disabled={resolving}
        onChange={(event) => {
          const next = event.target.value;
          setProductId(next);
          setVariantId("");
          void resolveSelection(next, "");
        }}
      >
        <option value="">No product selected</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.title} · {product.productType}
          </option>
        ))}
      </select>
      {selectedProduct ? (
        <>
          <label htmlFor="image-variant-select">Variant</label>
          <select
            id="image-variant-select"
            value={variantId}
            disabled={resolving}
            onChange={(event) => {
              const next = event.target.value;
              setVariantId(next);
              void resolveSelection(selectedProduct.id, next);
            }}
          >
            <option value="">Select exact variant</option>
            {selectedProduct.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.title} · {variant.availableForSale ? "available" : "unavailable"}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <p>{status}</p>
    </div>
  );
}
