"use client";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import { formatPrice } from "@/lib/shopify/operations";
import { History, Trophy } from "lucide-react";

interface ShopifyHistoricalPanelProps {
  historical: CommerceHistoryResponse | null;
}

export function ShopifyHistoricalPanel({ historical }: ShopifyHistoricalPanelProps) {
  if (!historical || historical.orders === 0) {
    return (
      <section className="shopify-historical-panel shopify-historical-panel-empty">
        <header className="shopify-historical-header">
          <History className="size-3.5 text-[#22c55e]" />
          <h2>Historical Sales</h2>
        </header>
        <p className="shopify-historical-empty">
          Place a Shopify orders export at{" "}
          <code>data/commerce/orders_export_1_2.csv</code> or set{" "}
          <code>COMMERCE_HISTORY_CSV_PATH</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="shopify-historical-panel" aria-label="Historical sales">
      <header className="shopify-historical-header">
        <History className="size-3.5 text-[#22c55e]" />
        <h2>Historical Sales</h2>
        <span className="shopify-historical-meta">Shopify export · all-time</span>
      </header>

      <div className="shopify-historical-kpis">
        <div>
          <span className="shopify-historical-kpi-label">Orders</span>
          <span className="shopify-historical-kpi-value">{historical.orders}</span>
        </div>
        <div>
          <span className="shopify-historical-kpi-label">Units</span>
          <span className="shopify-historical-kpi-value">{historical.units}</span>
        </div>
        <div>
          <span className="shopify-historical-kpi-label">Revenue</span>
          <span className="shopify-historical-kpi-value">
            {formatPrice(historical.revenue, historical.currency)}
          </span>
        </div>
        <div>
          <span className="shopify-historical-kpi-label">First Sale</span>
          <span className="shopify-historical-kpi-value shopify-historical-kpi-date">
            {historical.firstSale
              ? new Date(historical.firstSale).toLocaleDateString()
              : "—"}
          </span>
        </div>
        <div>
          <span className="shopify-historical-kpi-label">Last Sale</span>
          <span className="shopify-historical-kpi-value shopify-historical-kpi-date">
            {historical.lastSale
              ? new Date(historical.lastSale).toLocaleDateString()
              : "—"}
          </span>
        </div>
      </div>

      <div className="shopify-historical-block">
        <header>
          <Trophy className="size-3 text-[#22c55e]" />
          <h3>All Time Bestsellers</h3>
        </header>
        <ul>
          {historical.topProducts.slice(0, 5).map((product) => (
            <li key={product.productKey}>
              <span>{product.title}</span>
              <span>{product.unitsSold} units · score {product.historicalScore}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shopify-historical-block">
        <header>
          <h3>Top Historical Products</h3>
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
    </section>
  );
}
