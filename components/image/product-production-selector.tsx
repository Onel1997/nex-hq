"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProductProductionSelection } from "@/lib/image/product-production-context";

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
  onSelectionChange: (selection: ProductProductionSelection | null) => void;
}) {
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [status, setStatus] = useState("Checking live Shopify catalog…");

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
            ? "SHOPIFY_LIVE available. Select an exact product/variant, or keep the labeled Design handoff fallback."
            : "No active Shopify products returned; Design handoff remains non-authoritative.",
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(
            `${error instanceof Error ? error.message : "Shopify unavailable"}. Design handoff remains non-authoritative.`,
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

  function publish(nextProductId: string, nextVariantId: string) {
    if (!nextProductId) {
      onSelectionChange(null);
      return;
    }
    onSelectionChange({
      authority: "SHOPIFY_LIVE",
      productId: nextProductId,
      variantId: nextVariantId || null,
    });
  }

  return (
    <div>
      <label htmlFor="image-product-select">Product</label>
      <select
        id="image-product-select"
        value={productId}
        onChange={(event) => {
          const next = event.target.value;
          setProductId(next);
          setVariantId("");
          publish(next, "");
        }}
      >
        <option value="">Design handoff (non-authoritative)</option>
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
            onChange={(event) => {
              const next = event.target.value;
              setVariantId(next);
              publish(selectedProduct.id, next);
            }}
          >
            <option value="">Product level only (no exact variant)</option>
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
