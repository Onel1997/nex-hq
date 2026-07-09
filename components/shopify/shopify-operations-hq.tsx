"use client";

/**
 * @deprecated KPI dashboard shell — NOT the Milaene Commerce Intelligence System.
 * The canonical production UI is ShopifyOperationsCommerce at /agents/shopify.
 * Do not mount this component as the default Shopify Operations experience.
 * @see docs/milaene-commerce-intelligence.md
 */

import {
  DepartmentHqDecisions,
  DepartmentHqFeed,
  DepartmentHqHeader,
  DepartmentHqMetrics,
  DepartmentHqNeuralNetwork,
  DepartmentHqPanel,
  DepartmentHqShell,
  DepartmentHqSignals,
  useRotatingFeed,
} from "@/components/department-hq";
import type { ShopifyOperationsData } from "@/components/shopify/use-shopify-operations";
import {
  buildShopifyHqDecisions,
  buildShopifyHqFeed,
  buildShopifyHqMetrics,
  buildShopifyHqSignals,
  SHOPIFY_STOREFRONT_NETWORK,
} from "@/lib/shopify/operations-hq-data";
import { Activity, Radio, Sparkles } from "lucide-react";
import { useMemo } from "react";

interface ShopifyOperationsHqProps {
  data: ShopifyOperationsData;
}

export function ShopifyOperationsHq({ data }: ShopifyOperationsHqProps) {
  const metrics = useMemo(() => buildShopifyHqMetrics(data), [data]);
  const feedPool = useMemo(() => buildShopifyHqFeed(data), [data]);
  const signals = useMemo(() => buildShopifyHqSignals(data), [data]);
  const decisions = useMemo(() => buildShopifyHqDecisions(data), [data]);
  const feedItems = useRotatingFeed(feedPool);

  return (
    <DepartmentHqShell className="shopify-hq-shell" accent="#7cff7a">
      <DepartmentHqHeader
        title="SHOPIFY OPERATIONS"
        subtitle="Storefront Intelligence Division"
        statusLabel="ACTIVE"
        statusLine="Monitoring products, orders, revenue and inventory."
      />

      <DepartmentHqMetrics metrics={metrics} />

      <div className="dhq-main">
        <DepartmentHqPanel title="Operational Feed" icon={Activity} side="left">
          <DepartmentHqFeed items={feedItems} />
        </DepartmentHqPanel>

        <div className="dhq-center">
          <header className="dhq-center-header">
            <Sparkles className="size-4" />
            <h2>Storefront Neural Network</h2>
          </header>
          <DepartmentHqNeuralNetwork config={SHOPIFY_STOREFRONT_NETWORK} />
        </div>

        <DepartmentHqPanel title="Commerce Signals" icon={Radio} side="right">
          <DepartmentHqSignals signals={signals} />
        </DepartmentHqPanel>
      </div>

      <DepartmentHqDecisions
        title="Shopify Decisions"
        decisions={decisions}
      />
    </DepartmentHqShell>
  );
}
