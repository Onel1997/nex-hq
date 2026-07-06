"use client";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import { buildMockDesignStudioData } from "@/lib/design/studio-mock-data";
import {
  activateMockModeFromFailure,
  activateMockModeFromNetworkFailure,
  getMockModeActive,
  refreshMockModeState,
  setMockModeActive,
} from "@/lib/design/studio-mock-mode";
import type { ProductKnowledge } from "@/lib/shopify/types";
import { useCallback, useEffect, useState } from "react";

export interface DesignStudioData {
  studio: DesignStudioIntelligence;
  productKnowledge: ProductKnowledge;
  commerceHistory: CommerceHistoryResponse | null;
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

    const online = await refreshMockModeState();
    if (!online) {
      setData(buildMockDesignStudioData());
      setLoading(false);
      return;
    }

    try {
      const studioResponse = await fetch("/api/design/studio");
      const body = (await studioResponse.json()) as DesignStudioResponse;

      const studio = body.studio;
      const productKnowledge = body.productKnowledge;
      const businessMeta = body.businessMeta;
      let commerceHistory: CommerceHistoryResponse | null = null;

      if (!studioResponse.ok || !body.ok || !studio || !productKnowledge) {
        if (activateMockModeFromFailure(studioResponse.status, body)) {
          setData(buildMockDesignStudioData());
          setError(null);
          return;
        }

        setData(null);
        setError(body.error ?? "Failed to load Design Studio");
        return;
      }

      try {
        const historyResponse = await fetch("/api/commerce/history");
        const historyBody = (await historyResponse.json()) as CommerceHistoryResponse & {
          error?: string;
        };
        if (historyResponse.ok) {
          commerceHistory =
            historyBody.orders > 0 || historyBody.topProducts.length > 0
              ? historyBody
              : null;
        }
      } catch {
        // Commerce history is optional — never block studio intelligence
      }

      setData({
        studio,
        productKnowledge,
        commerceHistory,
        businessMeta: businessMeta ?? {
          primarySupplier: "MarketPrint Print On Demand",
          businessModel: "Print On Demand",
          fulfillment: "Supplier Managed",
        },
      });
      setMockModeActive(false);
    } catch (err) {
      if (activateMockModeFromNetworkFailure(err) || getMockModeActive()) {
        setData(buildMockDesignStudioData());
        setError(null);
      } else {
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load Design Studio");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
