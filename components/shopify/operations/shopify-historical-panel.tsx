"use client";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import { formatPrice } from "@/lib/shopify/operations";
import { cn } from "@/lib/utils";
import { ChevronDown, History, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "shopify-historical-intelligence-expanded";

interface ShopifyHistoricalPanelProps {
  historical: CommerceHistoryResponse | null;
}

function formatSaleYear(iso: string | null): string {
  if (!iso) return "—";
  try {
    return String(new Date(iso).getFullYear());
  } catch {
    return "—";
  }
}

function usePersistedExpanded(defaultExpanded = false) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setExpanded(stored === "true");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const toggle = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  return { expanded, toggle };
}

export function ShopifyHistoricalPanel({ historical }: ShopifyHistoricalPanelProps) {
  const { expanded, toggle } = usePersistedExpanded(false);

  if (!historical || historical.orders === 0) {
    return (
      <section className="shopify-historical-panel shopify-historical-panel-empty">
        <header className="shopify-historical-header">
          <History className="size-3.5 text-[#22c55e]" />
          <h2>Historical Intelligence</h2>
        </header>
        <p className="shopify-historical-empty">
          Place a Shopify orders export at{" "}
          <code>data/commerce/orders_export_1_2.csv</code> or set{" "}
          <code>COMMERCE_HISTORY_CSV_PATH</code>.
        </p>
      </section>
    );
  }

  const revenueRanked = [...historical.topProducts].sort((a, b) => b.revenue - a.revenue);

  return (
    <section
      className={cn(
        "shopify-historical-panel",
        expanded && "shopify-historical-panel-expanded",
      )}
      aria-label="Historical intelligence"
    >
      <div className="shopify-historical-summary-row">
        <button
          type="button"
          className="shopify-historical-toggle-header"
          onClick={toggle}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("size-3.5", expanded && "shopify-historical-toggle-open")} />
          <History className="size-3.5 text-[#22c55e]" />
          <span>Historical Intelligence</span>
        </button>

        <div className="shopify-historical-summary-stats">
          <span>
            {historical.orders} Orders · {historical.units} Units ·{" "}
            {formatPrice(historical.revenue, historical.currency)} Revenue
          </span>
          <span className="shopify-historical-summary-dates">
            First Sale {formatSaleYear(historical.firstSale)} · Last Sale{" "}
            {formatSaleYear(historical.lastSale)}
          </span>
        </div>

        <button
          type="button"
          className="shopify-historical-expand-btn"
          onClick={toggle}
          aria-expanded={expanded}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="shopify-historical-details-wrap">
        <div className="shopify-historical-details-inner">
          <div className="shopify-historical-details">
            <div className="shopify-historical-block">
              <header>
                <Trophy className="size-3 text-[#22c55e]" />
                <h3>All-time Bestseller</h3>
              </header>
              <ul>
                {historical.topProducts.slice(0, 5).map((product) => (
                  <li key={`bestseller-${product.productKey}`}>
                    <span>{product.title}</span>
                    <span>
                      {product.unitsSold} units · score {product.historicalScore}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shopify-historical-block">
              <header>
                <h3>Top Products</h3>
              </header>
              <ul>
                {historical.topProducts.slice(0, 8).map((product) => (
                  <li key={`${product.productKey}-detail`}>
                    <span>{product.title}</span>
                    <span>
                      {formatPrice(product.revenue, historical.currency)} · {product.orderCount}{" "}
                      orders
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shopify-historical-block">
              <header>
                <h3>Top Categories</h3>
              </header>
              <ul>
                {historical.topCategories.slice(0, 5).map((category) => (
                  <li key={category.category}>
                    <span>{category.category}</span>
                    <span>{category.unitsSold} units</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shopify-historical-block">
              <header>
                <h3>Historical Sales</h3>
              </header>
              <ul className="shopify-historical-sales-grid">
                <li>
                  <span>Orders</span>
                  <span>{historical.orders}</span>
                </li>
                <li>
                  <span>Units</span>
                  <span>{historical.units}</span>
                </li>
                <li>
                  <span>Revenue</span>
                  <span>{formatPrice(historical.revenue, historical.currency)}</span>
                </li>
                <li>
                  <span>Avg Order</span>
                  <span>{formatPrice(historical.averageOrderValue, historical.currency)}</span>
                </li>
              </ul>
            </div>

            <div className="shopify-historical-block">
              <header>
                <h3>Revenue Rankings</h3>
              </header>
              <ul>
                {revenueRanked.slice(0, 8).map((product, index) => (
                  <li key={`revenue-${product.productKey}`}>
                    <span>
                      #{index + 1} {product.title}
                    </span>
                    <span>{formatPrice(product.revenue, historical.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
