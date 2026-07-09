import type {
  DepartmentHqDecision,
  DepartmentHqFeedItem,
  DepartmentHqMetric,
  DepartmentHqNeuralConfig,
  DepartmentHqSignal,
} from "@/components/department-hq/types";
import type { ShopifyOperationsData } from "@/components/shopify/use-shopify-operations";
import type { CommerceInsight } from "@/lib/shopify/operations";
import { formatPrice } from "@/lib/shopify/operations";
import {
  Box,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

export const SHOPIFY_STOREFRONT_NETWORK: DepartmentHqNeuralConfig = {
  centerLabel: "STOREFRONT CORE",
  nodes: [
    { id: "products", label: "Products", icon: Package, x: 260, y: 72, active: true },
    { id: "orders", label: "Orders", icon: ShoppingCart, x: 88, y: 210 },
    { id: "customers", label: "Customers", icon: Users, x: 432, y: 210 },
    { id: "inventory", label: "Inventory", icon: Box, x: 132, y: 348 },
    { id: "revenue", label: "Revenue", icon: CircleDollarSign, x: 388, y: 348, active: true },
  ],
  links: [
    { id: "products-orders", from: "products", to: "orders" },
    { id: "products-customers", from: "products", to: "customers" },
    { id: "orders-inventory", from: "orders", to: "inventory" },
    { id: "customers-revenue", from: "customers", to: "revenue" },
    { id: "inventory-revenue", from: "inventory", to: "revenue" },
    { id: "products-revenue", from: "products", to: "revenue" },
    { id: "orders-revenue", from: "orders", to: "revenue" },
  ],
};

function inventoryHealthScore(data: ShopifyOperationsData): number {
  const { activeProducts, supplierStatus } = data.kpis;
  if (activeProducts === 0) return 0;
  const healthyRatio = (activeProducts - supplierStatus) / activeProducts;
  return Math.max(0, Math.min(100, Math.round(healthyRatio * 100)));
}

function inventoryHealthLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Stable";
  if (score >= 45) return "Watch";
  return "At Risk";
}

function insightFeedKind(
  insight: CommerceInsight,
): DepartmentHqFeedItem["kind"] {
  if (insight.kind === "inventory" || insight.kind === "supplier") return "warning";
  if (insight.kind === "ceo") return "alert";
  if (insight.kind === "bestseller" || insight.kind === "expansion") return "success";
  return "info";
}

function insightSignalLabel(insight: CommerceInsight): string {
  switch (insight.kind) {
    case "bestseller":
      return "High performing product";
    case "inventory":
    case "supplier":
      return "Low inventory warning";
    case "expansion":
    case "category":
      return "Product opportunity";
    case "marketprint":
      return "MarketPrint signal";
    case "pricing":
      return "Pricing signal";
    case "ceo":
      return "CEO commerce signal";
    default:
      return "Commerce signal";
  }
}

function insightSignalStatus(
  insight: CommerceInsight,
): DepartmentHqSignal["status"] {
  if (insight.priority === "high") {
    return insight.kind === "bestseller" || insight.kind === "expansion"
      ? "opportunity"
      : "warning";
  }
  if (insight.priority === "medium") return "opportunity";
  return "neutral";
}

function insightToAgents(kind: CommerceInsight["kind"]): string[] {
  switch (kind) {
    case "bestseller":
    case "inventory":
    case "supplier":
    case "marketprint":
      return ["Shopify", "Commerce"];
    case "expansion":
    case "category":
      return ["Marketing", "Content"];
    case "ceo":
      return ["CEO", "Shopify"];
    case "pricing":
      return ["Commerce", "Marketing"];
    default:
      return ["Shopify"];
  }
}

function priorityToConfidence(
  priority: CommerceInsight["priority"],
  seed: string,
): number {
  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (priority === "high") return 84 + (hash % 8);
  if (priority === "medium") return 68 + (hash % 10);
  return 55 + (hash % 12);
}

export function buildShopifyHqMetrics(
  data: ShopifyOperationsData,
): DepartmentHqMetric[] {
  const history = data.commerceHistory;
  const inventoryScore = inventoryHealthScore(data);
  const currency =
    history?.currency ?? data.kpis.averagePriceCurrency;

  return [
    {
      id: "revenue",
      label: history ? "Historical Revenue" : "Catalog Avg Price",
      value: history
        ? formatPrice(history.revenue, history.currency)
        : formatPrice(data.kpis.averagePrice, currency),
      pulse: Boolean(history && history.revenue > 0),
      glow: Boolean(history && history.revenue > 0),
      trend: history && history.revenue > 0 ? "up" : "neutral",
    },
    {
      id: "orders",
      label: "Orders",
      value: history ? String(history.orders) : "—",
      pulse: Boolean(history && history.orders > 0),
      trend: history && history.orders > 0 ? "up" : "neutral",
    },
    {
      id: "aov",
      label: "Avg Order Value",
      value:
        history && history.orders > 0
          ? formatPrice(history.averageOrderValue, history.currency)
          : "—",
      trend: history && history.averageOrderValue > 0 ? "up" : "neutral",
    },
    {
      id: "inventory-health",
      label: "Inventory Health",
      value: `${inventoryHealthLabel(inventoryScore)} · ${inventoryScore}%`,
      glow: inventoryScore < 65,
      trend: inventoryScore >= 65 ? "up" : inventoryScore > 0 ? "down" : "neutral",
    },
  ];
}

export function buildShopifyHqFeed(
  data: ShopifyOperationsData,
): DepartmentHqFeedItem[] {
  const fromActivity: DepartmentHqFeedItem[] = data.activity.map((event) => ({
    id: event.id,
    message: event.meta ? `${event.label} · ${event.meta}` : event.label,
    timestamp: event.time,
    kind:
      event.type === "inventory"
        ? "warning"
        : event.type === "ceo"
          ? "alert"
          : event.type === "campaign"
            ? "success"
            : "info",
  }));

  const fromInsights: DepartmentHqFeedItem[] = data.insights.map((insight) => ({
    id: insight.id,
    message: insight.message,
    timestamp: new Date().toISOString(),
    kind: insightFeedKind(insight),
  }));

  return [...fromActivity, ...fromInsights];
}

export function buildShopifyHqSignals(
  data: ShopifyOperationsData,
): DepartmentHqSignal[] {
  const signals: DepartmentHqSignal[] = [];

  if (data.commerceHistory && data.commerceHistory.orders > 0) {
    signals.push({
      id: "historical-orders",
      label: "Historical orders loaded",
      detail: `${data.commerceHistory.orders} orders · ${formatPrice(data.commerceHistory.revenue, data.commerceHistory.currency)} revenue`,
      status: "positive",
    });

    const topProduct = data.commerceHistory.topProducts[0];
    if (topProduct) {
      signals.push({
        id: "historical-bestseller",
        label: "All-time bestseller",
        detail: `${topProduct.title} · ${topProduct.unitsSold} units`,
        status: "positive",
      });
    }
  }

  if (data.kpis.supplierStatus > 0) {
    signals.push({
      id: "supplier-status",
      label: "Supplier review required",
      detail: `${data.kpis.supplierStatus} products flagged for supplier verification`,
      status: "warning",
    });
  }

  if (data.kpis.bestSellerCandidate) {
    signals.push({
      id: "catalog-bestseller",
      label: "Catalog bestseller candidate",
      detail: `${data.kpis.bestSellerCandidate.title} · ${data.kpis.bestSellerCandidate.inventory} units`,
      status: "opportunity",
    });
  }

  const { marketPrintIntelligence } = data;
  if (marketPrintIntelligence.summary.campaignCount > 0) {
    signals.push({
      id: "marketprint-campaign",
      label: "Campaign-ready products",
      detail: `${marketPrintIntelligence.summary.campaignCount} products campaign-ready · avg suitability ${marketPrintIntelligence.summary.averageSuitability}%`,
      status: "positive",
    });
  }

  for (const insight of data.insights) {
    signals.push({
      id: `insight-${insight.id}`,
      label: insightSignalLabel(insight),
      detail: insight.message,
      status: insightSignalStatus(insight),
    });
  }

  const seen = new Set<string>();
  return signals.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function buildShopifyHqDecisions(
  data: ShopifyOperationsData,
): DepartmentHqDecision[] {
  return data.insights.map((insight) => ({
    id: insight.id,
    title: insight.message.split("—")[0]?.trim() || insight.message.slice(0, 96),
    confidence: priorityToConfidence(insight.priority, insight.id),
    priority: insight.priority,
    agents: insightToAgents(insight.kind),
  }));
}
