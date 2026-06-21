"use client";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import type { MarketPrintIntelligence } from "@/lib/marketprint";
import type {
  AgentConnectionStatus,
  CommerceActivityEvent,
  CommerceInsight,
  ShopifyOperationsKpis,
} from "@/lib/shopify/operations";
import type { ProductKnowledge, ShopifyKnowledge } from "@/lib/shopify/types";
import { useCallback, useEffect, useState } from "react";

export interface ShopifyOperationsData {
  storeDomain: string;
  knowledge: ShopifyKnowledge;
  productKnowledge: ProductKnowledge;
  kpis: ShopifyOperationsKpis;
  insights: CommerceInsight[];
  activity: CommerceActivityEvent[];
  agentConnections: AgentConnectionStatus;
  businessMeta: {
    primarySupplier: string;
    businessModel: string;
    fulfillment: string;
  };
  marketPrintIntelligence: MarketPrintIntelligence;
  commerceHistory: CommerceHistoryResponse | null;
}

interface OperationsResponse {
  ok?: boolean;
  error?: string;
  storeDomain?: string;
  knowledge?: ShopifyKnowledge;
  productKnowledge?: ProductKnowledge;
  kpis?: ShopifyOperationsKpis;
  insights?: CommerceInsight[];
  activity?: CommerceActivityEvent[];
  agentConnections?: AgentConnectionStatus;
  businessMeta?: {
    primarySupplier: string;
    businessModel: string;
    fulfillment: string;
  };
  marketPrintIntelligence?: MarketPrintIntelligence;
}

export function useShopifyOperations() {
  const [data, setData] = useState<ShopifyOperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [operationsResponse, historyResponse] = await Promise.all([
        fetch("/api/shopify/operations"),
        fetch("/api/commerce/history"),
      ]);

      const body = (await operationsResponse.json()) as OperationsResponse;
      const historyBody = (await historyResponse.json()) as CommerceHistoryResponse & {
        error?: string;
      };

      if (
        !operationsResponse.ok ||
        !body.ok ||
        !body.knowledge ||
        !body.kpis ||
        !body.marketPrintIntelligence
      ) {
        throw new Error(body.error ?? "Failed to load Shopify operations");
      }

      if (!historyResponse.ok) {
        throw new Error(historyBody.error ?? "Failed to load commerce history");
      }

      setData({
        storeDomain: body.storeDomain ?? "",
        knowledge: body.knowledge,
        productKnowledge: body.productKnowledge!,
        kpis: body.kpis,
        insights: body.insights ?? [],
        activity: body.activity ?? [],
        agentConnections: body.agentConnections ?? {
          design: false,
          image: false,
          marketing: false,
          content: false,
          ceo: false,
        },
        businessMeta: body.businessMeta ?? {
          primarySupplier: "MarketPrint Print On Demand",
          businessModel: "Print On Demand",
          fulfillment: "Supplier Managed",
        },
        marketPrintIntelligence: body.marketPrintIntelligence,
        commerceHistory:
          historyBody.orders > 0 || historyBody.topProducts.length > 0
            ? historyBody
            : null,
      });
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load operations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
