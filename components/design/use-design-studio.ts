"use client";

import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import type { ProductKnowledge } from "@/lib/shopify/types";
import { useCallback, useEffect, useState } from "react";

export interface DesignStudioData {
  studio: DesignStudioIntelligence;
  productKnowledge: ProductKnowledge;
  businessMeta: {
    primarySupplier: string;
    businessModel: string;
    fulfillment: string;
  };
}

interface DesignStudioResponse {
  ok?: boolean;
  error?: string;
  studio?: DesignStudioIntelligence;
  productKnowledge?: ProductKnowledge;
  businessMeta?: DesignStudioData["businessMeta"];
}

export function useDesignStudio() {
  const [data, setData] = useState<DesignStudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/design/studio");
      const body = (await response.json()) as DesignStudioResponse;

      if (!response.ok || !body.ok || !body.studio || !body.productKnowledge) {
        throw new Error(body.error ?? "Failed to load Design Studio");
      }

      setData({
        studio: body.studio,
        productKnowledge: body.productKnowledge,
        businessMeta: body.businessMeta ?? {
          primarySupplier: "MarketPrint Print On Demand",
          businessModel: "Print On Demand",
          fulfillment: "Supplier Managed",
        },
      });
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load Design Studio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
