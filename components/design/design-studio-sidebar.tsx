"use client";

import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import { cn } from "@/lib/utils";
import { Sparkles, TrendingUp } from "lucide-react";

interface DesignStudioSidebarProps {
  studio: DesignStudioIntelligence;
}

export function DesignStudioSidebar({ studio }: DesignStudioSidebarProps) {
  const topProducts = studio.designIntelligence.topProducts.slice(0, 5);
  const opportunities = studio.scoredOpportunities.slice(0, 4);

  return (
    <aside className="design-studio-sidebar" aria-label="Design intelligence">
      <header className="design-studio-sidebar-header">
        <h2 className="design-studio-sidebar-title">Design Intelligence</h2>
      </header>

      <div className="design-studio-sidebar-body">
        <section className="design-studio-sidebar-block">
          <header className="design-studio-sidebar-block-head">
            <TrendingUp className="size-3.5 text-[#22d3ee]" />
            <h3>Top Products</h3>
          </header>
          <ul className="design-studio-sidebar-rank-list">
            {topProducts.map((product) => (
              <li key={product.productId}>
                <span className="design-studio-sidebar-rank-name">
                  {product.title}
                </span>
                <span
                  className={cn(
                    "design-studio-score-pill",
                    `design-intel-tier-${product.scoreTier}`,
                  )}
                >
                  {product.commerce?.unitsSold
                    ? `${product.commerce.unitsSold}u`
                    : `${product.heroProductScore}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="design-studio-sidebar-block">
          <header className="design-studio-sidebar-block-head">
            <Sparkles className="size-3.5 text-[#22d3ee]" />
            <h3>Collection Opportunities</h3>
          </header>
          <ul className="design-studio-sidebar-opportunities">
            {opportunities.map((item) => (
              <li key={item.id}>
                <div className="design-studio-sidebar-opportunity-head">
                  <span>{item.title}</span>
                  <span
                    className={cn(
                      "design-studio-score-pill",
                      item.confidence >= 90
                        ? "design-intel-tier-green"
                        : item.confidence >= 80
                          ? "design-intel-tier-blue"
                          : "design-intel-tier-orange",
                    )}
                  >
                    {item.confidence}%
                  </span>
                </div>
                <p>{item.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
