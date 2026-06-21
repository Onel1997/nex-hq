"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

interface ShopifyLiveProduct {
  id: string;
  title: string;
  status: string;
  inventory: number;
  imageUrl: string | null;
  price: string;
  currency: string;
  productType: string;
  collections: string[];
}

interface ShopifyLiveProductsProps {
  open: boolean;
}

export const ShopifyLiveProducts = memo(function ShopifyLiveProducts({
  open,
}: ShopifyLiveProductsProps) {
  const [products, setProducts] = useState<ShopifyLiveProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const grouped = products.reduce<Record<string, ShopifyLiveProduct[]>>(
      (acc, product) => {
        const type = product.productType?.trim() || "Uncategorized";
        (acc[type] ??= []).push(product);
        return acc;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([type, items]) => ({ type, products: items }))
      .sort((a, b) => b.products.length - a.products.length);
  }, [products]);

  useEffect(() => {
    if (!open) {
      setProducts([]);
      setLoading(false);
      setError(null);
      setOpenCategories({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch("/api/shopify/products")
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          products?: ShopifyLiveProduct[];
          error?: string;
        };

        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load Shopify products");
        }

        if (!cancelled) {
          setProducts(body.products ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProducts([]);
          setError(
            err instanceof Error ? err.message : "Failed to load Shopify products",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (categories.length === 0) {
      setOpenCategories({});
      return;
    }

    const initial: Record<string, boolean> = {};
    categories.forEach((category, index) => {
      initial[category.type] = index === 0;
    });
    setOpenCategories(initial);
  }, [categories]);

  if (loading) {
    return <p className="facility-inspector-empty">Loading products…</p>;
  }

  if (error) {
    return <p className="facility-inspector-error">{error}</p>;
  }

  if (products.length === 0) {
    return <p className="facility-inspector-empty">No products found in storefront</p>;
  }

  return (
    <>
      <p className="facility-shopify-summary">
        {products.length} products · {categories.length} categories
      </p>
      <div className="facility-shopify-product-list">
        {categories.map((category) => {
          const isOpen = openCategories[category.type] ?? false;

          return (
            <div key={category.type} className="facility-shopify-category">
              <button
                type="button"
                className="facility-shopify-category-header"
                onClick={() =>
                  setOpenCategories((prev) => ({
                    ...prev,
                    [category.type]: !prev[category.type],
                  }))
                }
                aria-expanded={isOpen}
              >
                <span className="facility-shopify-category-name">
                  {category.type}
                  <span className="facility-shopify-category-count">
                    {" "}
                    ({category.products.length})
                  </span>
                </span>
                <span
                  className={cn(
                    "facility-shopify-category-chevron",
                    isOpen && "facility-shopify-category-chevron-open",
                  )}
                  aria-hidden
                >
                  {isOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </span>
              </button>
              {isOpen ? (
                <div className="facility-shopify-category-products">
                  {category.products.map((product) => (
                    <div key={product.id} className="facility-shopify-product-card">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="facility-shopify-product-image"
                        />
                      ) : (
                        <div
                          className="facility-shopify-product-image facility-shopify-product-image-empty"
                          aria-hidden
                        />
                      )}
                      <div className="facility-shopify-product-body">
                        <p className="facility-shopify-product-title">{product.title}</p>
                        <p className="facility-shopify-product-price">
                          {product.price} {product.currency}
                        </p>
                        <span
                          className="facility-inspector-meta"
                          data-status={product.status}
                        >
                          {product.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
});
