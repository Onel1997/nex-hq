"use client";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import type { ShopifyOperationsKpis } from "@/lib/shopify/operations";
import { formatPrice } from "@/lib/shopify/operations";

interface ShopifyKpiBarProps {
  kpis: ShopifyOperationsKpis;
  historical?: CommerceHistoryResponse | null;
}

const KPI_ITEMS: Array<{
  key: keyof ShopifyOperationsKpis;
  label: string;
  format?: (kpis: ShopifyOperationsKpis) => string;
}> = [
  { key: "products", label: "Products", format: (k) => String(k.products) },
  { key: "collections", label: "Collections", format: (k) => String(k.collections) },
  { key: "categories", label: "Categories", format: (k) => String(k.categories) },
  { key: "activeProducts", label: "Active", format: (k) => String(k.activeProducts) },
  {
    key: "supplierStatus",
    label: "Supplier Status",
    format: (k) => String(k.supplierStatus),
  },
  {
    key: "averagePrice",
    label: "Avg Price",
    format: (k) => formatPrice(k.averagePrice, k.averagePriceCurrency),
  },
  {
    key: "highestPriceProduct",
    label: "Top Price",
    format: (k) =>
      k.highestPriceProduct
        ? formatPrice(k.highestPriceProduct.price, k.highestPriceProduct.currency)
        : "—",
  },
  {
    key: "bestSellerCandidate",
    label: "Best Seller",
    format: (k) => k.bestSellerCandidate?.title ?? "—",
  },
];

export function ShopifyKpiBar({ kpis, historical }: ShopifyKpiBarProps) {
  const historicalItems = historical
    ? [
        {
          label: "Historical Orders",
          value: String(historical.orders),
        },
        {
          label: "All Time Bestseller",
          value: historical.topProducts[0]?.title ?? "—",
        },
        {
          label: "First Sale",
          value: historical.firstSale
            ? new Date(historical.firstSale).toLocaleDateString()
            : "—",
        },
        {
          label: "Last Sale",
          value: historical.lastSale
            ? new Date(historical.lastSale).toLocaleDateString()
            : "—",
        },
        {
          label: "Historical Revenue",
          value: formatPrice(historical.revenue, historical.currency),
        },
      ]
    : [];

  return (
    <div className="shopify-kpi-bar">
      {historicalItems.map((item) => (
        <div key={item.label} className="shopify-kpi-item shopify-kpi-item-historical">
          <span className="shopify-kpi-value">{item.value}</span>
          <span className="shopify-kpi-label">{item.label}</span>
        </div>
      ))}
      {KPI_ITEMS.map((item) => (
        <div key={item.key} className="shopify-kpi-item">
          <span className="shopify-kpi-value">
            {item.format ? item.format(kpis) : String(kpis[item.key])}
          </span>
          <span className="shopify-kpi-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
