"use client";

/**
 * Milaene Commerce Intelligence System — catalog-first operations surface.
 * Product catalog, filters, AI commerce panel, MarketPrint, historical sales,
 * and activity feed. Must not be replaced by KPI dashboard shells.
 */

import { ShopifyActivityFeed } from "@/components/shopify/operations/shopify-activity-feed";
import { ShopifyAiPanel } from "@/components/shopify/operations/shopify-ai-panel";
import { ShopifyFilterPanel } from "@/components/shopify/operations/shopify-filter-panel";
import { ShopifyHistoricalPanel } from "@/components/shopify/operations/shopify-historical-panel";
import { ShopifyKpiBar } from "@/components/shopify/operations/shopify-kpi-bar";
import { ShopifyMarketPrintPanel } from "@/components/shopify/operations/shopify-marketprint-panel";
import { ShopifyProductDrawer } from "@/components/shopify/operations/shopify-product-drawer";
import { ShopifyProductGrid } from "@/components/shopify/operations/shopify-product-grid";
import type { ShopifyOperationsData } from "@/components/shopify/use-shopify-operations";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { useCallback, useMemo, useState } from "react";

function toggleSetValue(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function buildCountMap(
  items: Iterable<string>,
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

interface ShopifyOperationsCommerceProps {
  data: ShopifyOperationsData;
}

export function ShopifyOperationsCommerce({ data }: ShopifyOperationsCommerceProps) {
  const [selectedProduct, setSelectedProduct] =
    useState<ShopifyKnowledgeProduct | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const filterOptions = useMemo(() => {
    const { products, collections, categories, tags } = data.knowledge;

    const collectionCounts = new Map<string, number>();
    for (const col of collections) {
      collectionCounts.set(col.title, col.productCount);
    }
    for (const product of products) {
      for (const col of product.collections) {
        collectionCounts.set(col, (collectionCounts.get(col) ?? 0) + 1);
      }
    }

    return {
      collections: [...collectionCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      categories: buildCountMap(products.map((p) => p.productType)),
      tags: buildCountMap(products.flatMap((p) => p.tags)),
    };
  }, [data.knowledge]);

  const filteredProducts = useMemo(() => {
    return data.knowledge.products.filter((product) => {
      if (
        selectedCollections.size > 0 &&
        !product.collections.some((c) => selectedCollections.has(c))
      ) {
        return false;
      }
      if (
        selectedCategories.size > 0 &&
        !selectedCategories.has(product.productType)
      ) {
        return false;
      }
      if (
        selectedTags.size > 0 &&
        !product.tags.some((t) => selectedTags.has(t))
      ) {
        return false;
      }
      return true;
    });
  }, [data.knowledge.products, selectedCollections, selectedCategories, selectedTags]);

  const clearFilters = useCallback(() => {
    setSelectedCollections(new Set());
    setSelectedCategories(new Set());
    setSelectedTags(new Set());
  }, []);

  return (
    <>
      <div className="shopify-operations-meta" aria-label="Business model">
        <span className="shopify-operations-meta-item">
          <span className="shopify-operations-meta-label">Primary Supplier</span>
          <span className="shopify-operations-meta-value">
            {data.businessMeta.primarySupplier}
          </span>
        </span>
        <span className="shopify-operations-meta-item">
          <span className="shopify-operations-meta-label">Business Model</span>
          <span className="shopify-operations-meta-value">
            {data.businessMeta.businessModel}
          </span>
        </span>
        <span className="shopify-operations-meta-item">
          <span className="shopify-operations-meta-label">Fulfillment</span>
          <span className="shopify-operations-meta-value">
            {data.businessMeta.fulfillment}
          </span>
        </span>
      </div>

      <div className="shopify-operations-kpi-wrap">
        <ShopifyKpiBar kpis={data.kpis} historical={data.commerceHistory} />
      </div>

      <ShopifyHistoricalPanel historical={data.commerceHistory} />

      <div className="shopify-operations-body">
        <ShopifyFilterPanel
          collections={filterOptions.collections}
          categories={filterOptions.categories}
          tags={filterOptions.tags}
          selectedCollections={selectedCollections}
          selectedCategories={selectedCategories}
          selectedTags={selectedTags}
          onToggleCollection={(label) =>
            setSelectedCollections((s) => toggleSetValue(s, label))
          }
          onToggleCategory={(label) =>
            setSelectedCategories((s) => toggleSetValue(s, label))
          }
          onToggleTag={(label) => setSelectedTags((s) => toggleSetValue(s, label))}
          onClear={clearFilters}
        />

        <main className="shopify-operations-main">
          <div className="shopify-operations-main-header">
            <h1 className="shopify-operations-title">Product Catalog</h1>
            <span className="shopify-operations-count">
              {filteredProducts.length} of {data.knowledge.products.length}
            </span>
          </div>
          <ShopifyProductGrid
            products={filteredProducts}
            storeDomain={data.storeDomain}
            onOpenProduct={setSelectedProduct}
          />
        </main>

        <aside className="shopify-operations-sidebar">
          <ShopifyAiPanel
            insights={data.insights}
            agentConnections={data.agentConnections}
          />
          <ShopifyMarketPrintPanel intelligence={data.marketPrintIntelligence} />
        </aside>
      </div>

      <ShopifyActivityFeed events={data.activity} />

      <ShopifyProductDrawer
        product={selectedProduct}
        storeDomain={data.storeDomain}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}
