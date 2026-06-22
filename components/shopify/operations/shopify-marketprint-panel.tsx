"use client";

import type { MarketPrintIntelligence } from "@/lib/marketprint";
import { Factory, Sparkles, Star, Target, Zap } from "lucide-react";

interface ShopifyMarketPrintPanelProps {
  intelligence: MarketPrintIntelligence;
}

export function ShopifyMarketPrintPanel({
  intelligence,
}: ShopifyMarketPrintPanelProps) {
  const { summary, premiumProducts, embroideryProducts, campaignProducts, topStreetwear } =
    intelligence;

  return (
    <section className="shopify-marketprint-panel" aria-label="MarketPrint Intelligence">
      <header className="shopify-marketprint-header">
        <Factory className="size-4 text-[#22c55e]" />
        <h2>MarketPrint Intelligence</h2>
      </header>

      <div className="shopify-marketprint-summary">
        <div className="shopify-marketprint-stat">
          <span className="shopify-marketprint-stat-value">{summary.premiumCount}</span>
          <span className="shopify-marketprint-stat-label">Premium</span>
        </div>
        <div className="shopify-marketprint-stat">
          <span className="shopify-marketprint-stat-value">{summary.embroideryCount}</span>
          <span className="shopify-marketprint-stat-label">Embroidery</span>
        </div>
        <div className="shopify-marketprint-stat">
          <span className="shopify-marketprint-stat-value">{summary.campaignCount}</span>
          <span className="shopify-marketprint-stat-label">Campaign</span>
        </div>
        <div className="shopify-marketprint-stat">
          <span className="shopify-marketprint-stat-value">
            {summary.averageSuitability}%
          </span>
          <span className="shopify-marketprint-stat-label">Avg Fit</span>
        </div>
      </div>

      <MarketPrintList
        title="Premium Products"
        icon={Star}
        items={premiumProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `${p.match.suitability}% · ${p.match.capability.premiumScore}/10`,
        }))}
      />

      <MarketPrintList
        title="Embroidery Products"
        icon={Zap}
        items={embroideryProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `${p.match.suitability}% · ${p.match.capability.category}`,
        }))}
      />

      <MarketPrintList
        title="Campaign Products"
        icon={Target}
        items={campaignProducts.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `streetwear ${p.match.capability.streetwearScore}/10`,
        }))}
      />

      <MarketPrintList
        title="Top Streetwear Fit"
        icon={Sparkles}
        items={topStreetwear.slice(0, 4).map((p) => ({
          label: p.title,
          meta: `MarketPrint ${p.match.suitability}%`,
        }))}
      />

      <div className="shopify-marketprint-examples">
        {intelligence.commerceExamples.map((ex) => (
          <p key={ex.label} className="shopify-marketprint-example">
            <span>{ex.label}:</span> {ex.message}
          </p>
        ))}
      </div>
    </section>
  );
}

function MarketPrintList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Star;
  items: Array<{ label: string; meta: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="shopify-marketprint-list-block">
      <h3 className="shopify-marketprint-list-title">
        <Icon className="size-3.5 opacity-70" />
        {title}
      </h3>
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
