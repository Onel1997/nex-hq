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
  Sparkles,
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
  const rec = snapshot.recommendation;

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

      {/* AI Strategic Advice */}
      {rec ? (
        <section className="research-ai-recommendation" aria-label={t("research.brain.aiRecommendation.label")}>
          <header className="research-ai-recommendation-head">
            <Sparkles className="research-ai-recommendation-icon size-4" aria-hidden />
            <h4>{t("research.brain.aiRecommendation.label")}</h4>
          </header>
          <div className="research-ai-recommendation-body">
            <div className="research-ai-recommendation-main">
              <p className="research-ai-recommendation-label">
                {t("research.brain.aiRecommendation.nextCollection")}
              </p>
              <p className="research-ai-recommendation-value">{rec.nextCollection}</p>
            </div>
            <div className="research-ai-recommendation-metrics">
              <div>
                <span className="research-ai-metric-label">
                  {t("research.brain.aiRecommendation.fit")}
                </span>
                <span className="research-ai-metric-value">{rec.fitScore}%</span>
              </div>
              <div>
                <span className="research-ai-metric-label">
                  {t("research.brain.aiRecommendation.demand")}
                </span>
                <span className="research-ai-metric-value">
                  +{rec.demandChange}%
                </span>
              </div>
            </div>
            <div>
              <p className="research-brain-quad-label">
                {t("research.brain.aiRecommendation.products")}
              </p>
              <IntelList items={rec.recommendedProducts} />
            </div>
          </div>
        </section>
      ) : null}

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
          <div className="research-brain-connectors">
            <p className="research-brain-quad-label">
              {t("research.brain.market.connectors")}
            </p>
            <ul className="research-brain-connector-list">
              {snapshot.connectorIntelligence.connectors.map((connector) => (
                <li key={connector.id} className="research-brain-connector-item">
                  <span className="research-brain-connector-name">
                    {connector.label}
                  </span>
                  <span
                    className={cn(
                      "research-status-badge",
                      connector.mode === "live"
                        ? "research-status-badge-watching"
                        : "research-status-badge-stable",
                    )}
                  >
                    {connector.mode === "live"
                      ? t("research.brain.market.live")
                      : t("research.brain.market.simulated")}
                  </span>
                  <span className="research-brain-connector-scores">
                    {t("research.brain.opportunity.social")} {connector.socialScore}% ·{" "}
                    {t("research.brain.opportunity.demand")} {connector.demandScore}% ·{" "}
                    {t("research.brain.opportunity.trend")} {connector.trendScore}%
                  </span>
                </li>
              ))}
            </ul>
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
                  {featured.scores.estimatedPotential}%{" "}
                  {t("research.brain.opportunity.potential")} ·{" "}
                  {featured.decisions.priority.toUpperCase()}
                </li>
                <li>
                  {t("research.brain.opportunity.productsLabel")}:{" "}
                  {featured.products.join(", ")}
                </li>
                <li>
                  {t("research.brain.opportunity.colorsLabel")}:{" "}
                  {featured.colors.join(", ")}
                </li>
                <li>
                  {t("research.brain.opportunity.demand")}: {featured.scores.demandScore}%
                  · {t("research.brain.opportunity.social")}: {featured.scores.socialScore}%
                  · {t("research.brain.opportunity.trend")}: {featured.scores.trendScore}%
                  · {t("research.brain.opportunity.dna")}: {featured.scores.dnaMatch}%
                </li>
                <li>{featured.rationale}</li>
              </ul>
              <p className="research-opportunity-confidence">
                {t("research.brain.opportunity.confidence")}:{" "}
                <span>{featured.scores.estimatedPotential}%</span>
              </p>
            </article>
          ) : null}

          {otherOpportunities.length > 0 ? (
            <ul className="research-opportunity-list">
              {otherOpportunities.map((opp) => (
                <li key={opp.id} className="research-opportunity-item">
                  <span className="research-opportunity-name">{opp.title}</span>
                  <span className="research-opportunity-score">
                    {opp.scores.estimatedPotential}%
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
