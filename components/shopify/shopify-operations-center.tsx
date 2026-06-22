"use client";

/**
 * Milaene Commerce Intelligence System — canonical production UI.
 * This page is the permanent baseline for NexHQ commerce intelligence.
 * @see docs/milaene-commerce-intelligence.md
 */

import { ShopifyOperationsCommerce } from "@/components/shopify/shopify-operations-commerce";
import { useShopifyOperations } from "@/components/shopify/use-shopify-operations";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

export function ShopifyOperationsCenter() {
  const { data, loading, error, refresh } = useShopifyOperations();

  return (
    <div className="shopify-operations-shell">
      <WorkspaceNav activeId="shopify" />
      <div className="shopify-operations">
        <div className="shopify-operations-header">
          <div className="shopify-operations-live">
            <span className="shopify-operations-live-dot" />
            Storefront intelligence online
          </div>
          <button
            type="button"
            className="shopify-operations-refresh"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Sync
          </button>
        </div>

        {loading && !data ? (
          <div className="shopify-operations-loading">
            <Loader2 className="size-8 animate-spin text-[#7cff7a]" />
            <p>Loading Shopify Operations intelligence…</p>
          </div>
        ) : error && !data ? (
          <div className="shopify-operations-error">
            <p>{error}</p>
            <button type="button" onClick={() => void refresh()}>
              Retry connection
            </button>
          </div>
        ) : data ? (
          <ShopifyOperationsCommerce data={data} />
        ) : null}
      </div>
    </div>
  );
}
