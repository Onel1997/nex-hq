"use client";

import type { ProductKnowledge } from "@/lib/shopify/types";
import { useEffect, useState } from "react";

interface ShopifyKnowledgeResponse {
  ok?: boolean;
  productKnowledge?: ProductKnowledge;
  error?: string;
}

export function useShopifyCatalog(open: boolean) {
  const [productKnowledge, setProductKnowledge] = useState<ProductKnowledge | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProductKnowledge(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch("/api/shopify/knowledge")
      .then(async (response) => {
        const body = (await response.json()) as ShopifyKnowledgeResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load Shopify knowledge");
        }

        if (!cancelled) {
          setProductKnowledge(body.productKnowledge ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProductKnowledge(null);
          setError(
            err instanceof Error ? err.message : "Failed to load Shopify knowledge",
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

  return { productKnowledge, loading, error };
}
