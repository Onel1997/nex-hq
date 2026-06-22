"use client";

import type { ResearchBrainSnapshot } from "@/lib/research/research-brain-intelligence";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Brain,
  Lightbulb,
  Loader2,
  Package,
  Radar,
  Swords,
  TrendingUp,
} from "lucide-react";

interface ResearchIntelligenceBrainProps {
  snapshot: ResearchBrainSnapshot | null;
  loading?: boolean;
}

function IntelList({ items }: { items: string[] }) {
  return (
    <ul className="research-brain-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ResearchIntelligenceBrain({
  snapshot,
  loading = false,
}: ResearchIntelligenceBrainProps) {
  const t = useT();

  if (loading && !snapshot) {
    return (
      <div className="research-brain-loading">
        <Loader2 className="size-4 animate-spin" />
        <span>{t("research.brain.loading")}</span>
      </div>
    );
  }

  if (!snapshot) return null;

  const featured =
    snapshot.opportunities.find((o) => o.featured) ?? snapshot.opportunities[0];
  const otherOpportunities = snapshot.opportunities.filter(
    (o) => o.id !== featured?.id,
  );

  return (
    <div className="research-intelligence-brain" aria-label={t("research.brain.label")}>
      <header className="research-brain-header">
        <Brain className="research-brain-header-icon size-4" aria-hidden />
        <div>
          <h3 className="research-brain-title">{t("research.brain.label")}</h3>
          <p className="research-brain-subtitle">{t("research.brain.subtitle")}</p>
        </div>
      </header>

      {/* Brand DNA strip */}
      <div className="research-brand-dna">
        <div className="research-brand-dna-item">
          <span className="research-brand-dna-label">{t("research.brain.brand.style")}</span>
          <span className="research-brand-dna-value">{snapshot.brand.style}</span>
        </div>
        <div className="research-brand-dna-row">
          <div className="research-brand-dna-chip">
            <span className="research-brand-dna-chip-label">
              {t("research.brain.brand.audience")}
            </span>
            <span className="research-brand-dna-chip-value">
              {snapshot.brand.audience}
            </span>
          </div>
          <div className="research-brand-dna-colors">
            {snapshot.brand.colors.map((color) => (
              <span key={color} className="research-brand-color-tag">
                {color}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="research-brain-grid">
        {/* Market Intelligence */}
        <section className="research-brain-panel">
          <header className="research-brain-panel-head">
            <Radar className="research-brain-panel-icon size-4" aria-hidden />
            <h4>{t("research.brain.marketIntelligence")}</h4>
          </header>
          <div className="research-brain-quad">
            <div className="research-brain-quad-cell">
              <p className="research-brain-quad-label">{t("research.brain.market.trends")}</p>
              <IntelList items={snapshot.market.trends.slice(0, 4)} />
            </div>
            <div className="research-brain-quad-cell">
              <p className="research-brain-quad-label">{t("research.brain.market.demand")}</p>
              <IntelList items={snapshot.market.demand.slice(0, 4)} />
            </div>
            <div className="research-brain-quad-cell">
              <p className="research-brain-quad-label">{t("research.brain.market.colors")}</p>
              <IntelList items={snapshot.market.colors.slice(0, 5)} />
            </div>
            <div className="research-brain-quad-cell">
              <p className="research-brain-quad-label">
                {t("research.brain.market.categories")}
              </p>
              <IntelList items={snapshot.market.categories.slice(0, 5)} />
            </div>
          </div>
          <div className="research-brain-sources">
            {snapshot.market.sources.map((source) => (
              <span key={source} className="research-brain-source-tag">
                {source}
              </span>
            ))}
          </div>
        </section>

        {/* Competitor Intelligence */}
        <section className="research-brain-panel">
          <header className="research-brain-panel-head">
            <Swords className="research-brain-panel-icon size-4" aria-hidden />
            <h4>{t("research.brain.competitorIntelligence")}</h4>
          </header>
          <ul className="research-brain-competitors">
            {snapshot.competitors.map((competitor) => (
              <li key={competitor.name} className="research-brain-competitor">
                <div className="research-brain-competitor-head">
                  <span className="research-brain-competitor-name">
                    {competitor.name}
                  </span>
                  <span
                    className={cn(
                      "research-status-badge",
                      `research-status-badge-${competitor.status}`,
                    )}
                  >
                    {t(`research.dashboard.competitorStatus.${competitor.status}`)}
                  </span>
                </div>
                <div className="research-brain-competitor-meta">
                  <span className="research-brain-competitor-trend">
                    {competitor.trendChange}
                  </span>
                  <span className="research-brain-competitor-signal">
                    {competitor.signal}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Product Intelligence */}
        <section className="research-brain-panel">
          <header className="research-brain-panel-head">
            <Package className="research-brain-panel-icon size-4" aria-hidden />
            <h4>{t("research.brain.productIntelligence")}</h4>
          </header>
          <div className="research-brain-product-cols">
            <div>
              <p className="research-brain-quad-label">
                {t("research.brain.products.bestsellers")}
              </p>
              <IntelList items={snapshot.products.bestsellers} />
            </div>
            <div>
              <p className="research-brain-quad-label">
                {t("research.brain.products.weak")}
              </p>
              <IntelList items={snapshot.products.weakProducts} />
            </div>
            <div>
              <p className="research-brain-quad-label">
                {t("research.brain.products.opportunities")}
              </p>
              <IntelList items={snapshot.products.opportunities} />
            </div>
          </div>
          <div className="research-brain-pod-strip">
            <span className="research-brain-pod-label">POD</span>
            <span>{snapshot.pod.primarySupplier}</span>
            <span className="research-brain-pod-meta">
              {snapshot.pod.availableProducts} {t("research.brain.pod.products")}
              · {snapshot.pod.marketPrintMatches} MarketPrint
            </span>
          </div>
        </section>

        {/* Opportunity Engine */}
        <section className="research-brain-panel research-brain-panel-opportunity">
          <header className="research-brain-panel-head">
            <Lightbulb className="research-brain-panel-icon size-4" aria-hidden />
            <h4>{t("research.brain.opportunityEngine")}</h4>
          </header>

          {featured ? (
            <article className="research-opportunity-featured">
              <div className="research-opportunity-featured-head">
                <TrendingUp
                  className="research-opportunity-featured-icon size-4"
                  aria-hidden
                />
                <h5>{featured.title}</h5>
              </div>
              <ul className="research-opportunity-highlights">
                <li>
                  {featured.productCount} {t("research.brain.opportunity.products")}
                </li>
                {featured.themes.map((theme) => (
                  <li key={theme}>{theme}</li>
                ))}
                {featured.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="research-opportunity-confidence">
                {t("research.brain.opportunity.confidence")}:{" "}
                <span>{featured.confidence}%</span>
              </p>
            </article>
          ) : null}

          {otherOpportunities.length > 0 ? (
            <ul className="research-opportunity-list">
              {otherOpportunities.map((opp) => (
                <li key={opp.id} className="research-opportunity-item">
                  <span className="research-opportunity-name">{opp.title}</span>
                  <span className="research-opportunity-score">{opp.confidence}%</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
