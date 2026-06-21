"use client";

import type { ShopifyOperationsKpis } from "@/lib/shopify/operations";
import { formatPrice } from "@/lib/shopify/operations";

interface ShopifyKpiBarProps {
  kpis: ShopifyOperationsKpis;
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

export function ShopifyKpiBar({ kpis }: ShopifyKpiBarProps) {
  return (
    <div className="shopify-kpi-bar">
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
