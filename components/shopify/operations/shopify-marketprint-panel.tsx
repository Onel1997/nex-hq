"use client";

import type { MarketPrintIntelligence } from "@/lib/marketprint";
import { Factory, Star, Target, Zap } from "lucide-react";

interface ShopifyMarketPrintPanelProps {
  intelligence: MarketPrintIntelligence;
}

export function ShopifyMarketPrintPanel({
  intelligence,
}: ShopifyMarketPrintPanelProps) {
  const { summary, premiumProducts, embroideryProducts, campaignProducts } = intelligence;

  return (
    <section className="shopify-marketprint-panel" aria-label="MarketPrint Intelligence">
      <header className="shopify-marketprint-header">
        <Factory className="size-4 text-[#22c55e]" />
        <h2>MarketPrint Intelligence</h2>
      </header>

      <div className="shopify-marketprint-metrics">
        <div className="shopify-marketprint-metric-card">
          <Star className="size-3.5 shopify-marketprint-metric-icon" />
          <span className="shopify-marketprint-metric-value">{summary.premiumCount}</span>
          <span className="shopify-marketprint-metric-label">Premium Products</span>
        </div>
        <div className="shopify-marketprint-metric-card">
          <Target className="size-3.5 shopify-marketprint-metric-icon" />
          <span className="shopify-marketprint-metric-value">{summary.campaignCount}</span>
          <span className="shopify-marketprint-metric-label">Campaign Products</span>
        </div>
        <div className="shopify-marketprint-metric-card">
          <Zap className="size-3.5 shopify-marketprint-metric-icon" />
          <span className="shopify-marketprint-metric-value">{summary.embroideryCount}</span>
          <span className="shopify-marketprint-metric-label">Embroidery Products</span>
        </div>
        <div className="shopify-marketprint-metric-card">
          <span className="shopify-marketprint-metric-value">{summary.averageSuitability}%</span>
          <span className="shopify-marketprint-metric-label">Average Production Fit</span>
        </div>
        <div className="shopify-marketprint-metric-card shopify-marketprint-metric-card-score">
          <span className="shopify-marketprint-metric-value">{summary.averageSuitability}</span>
          <span className="shopify-marketprint-metric-label">MarketPrint Score</span>
        </div>
      </div>

      <MarketPrintList
        title="Premium Products"
        items={premiumProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `${p.match.suitability}% · ${p.match.capability.premiumScore}/10`,
        }))}
      />

      <MarketPrintList
        title="Campaign Products"
        items={campaignProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `streetwear ${p.match.capability.streetwearScore}/10`,
        }))}
      />

      <MarketPrintList
        title="Embroidery Products"
        items={embroideryProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `${p.match.suitability}% · ${p.match.capability.category}`,
        }))}
      />
    </section>
  );
}

function MarketPrintList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; meta: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="shopify-marketprint-list-block">
      <h3 className="shopify-marketprint-list-title">{title}</h3>
      <ul className="shopify-marketprint-list">
        {items.map((item) => (
          <li key={item.label} className="shopify-marketprint-list-item">
            <span>{item.label}</span>
            <span className="shopify-marketprint-list-meta">{item.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
