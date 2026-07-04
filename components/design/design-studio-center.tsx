"use client";

import {
  DesignMissionEmptyState,
  DesignMissionPanel,
} from "@/components/design/design-mission-panel";
import { DesignStudioSidebar } from "@/components/design/design-studio-sidebar";
import { useDesignStudio } from "@/components/design/use-design-studio";
import { useDesignMission } from "@/lib/design/design-mission-store";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import type { ProductIntelligence } from "@/lib/design/product-intelligence";
import { formatCommerceCurrency, formatHistoricalPlaceholder, isCommerceHistoryActive } from "@/lib/shopify/commerce-shared";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  DollarSign,
  Factory,
  Home,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const PRIMARY_BASES = ["T-Shirts", "Hoodies", "Beanies", "Accessories"] as const;

const SUPPLIER_CAPABILITY_CHIPS = [
  "DTG",
  "Embroidery",
  "Oversized",
  "POD",
  "Premium blanks",
] as const;

export function DesignStudioCenter() {
  const { data, loading, error, refresh } = useDesignStudio();
  const { mission, hydrated, selectBrief, markSaved, patchMission } = useDesignMission();

  const renderCommerceSection = () => {
    if (loading) {
      return (
        <div className="design-studio-supporting-loading">
          <Loader2 className="size-6 animate-spin text-[#22d3ee]" />
          <p>Loading commerce intelligence…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="design-studio-supporting-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      );
    }

    if (!data) return null;

    return (
      <>
        <div className="design-studio-row-1">
          <ProductEcosystemColumn studio={data.studio} />
          <CollectionOpportunitiesColumn studio={data.studio} />
          <SupplierCapabilitiesColumn studio={data.studio} />
        </div>
        <CommerceIntelligenceSection studio={data.studio} />
        <DesignIntelligenceSection studio={data.studio} />
        <ProductIntelligenceGrid studio={data.studio} />
      </>
    );
  };

  return (
    <WorkspaceShell
      agentId="designer"
      className="design-studio-shell"
      hideHeader
      collapsibleContext
      contextPanel={
        data && !mission ? <DesignStudioSidebar studio={data.studio} /> : undefined
      }
    >
      <div className="design-studio design-studio-lab">
        <header className="design-studio-topbar design-studio-topbar-lab">
          <nav className="design-studio-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="design-studio-crumb">
              <Home className="size-3.5" />
              Facility
            </Link>
            <ChevronRight className="size-3.5 design-studio-crumb-sep" aria-hidden />
            <span className="design-studio-crumb design-studio-crumb-current">
              <Palette className="size-3.5" />
              Creative Director
            </span>
            {mission ? (
              <>
                <ChevronRight className="size-3.5 design-studio-crumb-sep" aria-hidden />
                <span className="design-studio-crumb design-studio-crumb-design">
                  {mission.brief.title}
                </span>
              </>
            ) : null}
          </nav>

          <div className="design-studio-topbar-meta">
            <button
              type="button"
              className="design-studio-refresh design-studio-refresh-subtle"
              onClick={() => void refresh()}
              disabled={loading}
              title="Sync commerce data"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="design-studio-body design-studio-body-workspace">
          {!hydrated ? (
            <DesignMissionEmptyState />
          ) : mission ? (
            <DesignMissionPanel
              mission={mission}
              onSelectBrief={selectBrief}
              onSaveDraft={markSaved}
              onPatchMission={patchMission}
              renderCommerceSection={renderCommerceSection}
            />
          ) : (
            <DesignMissionEmptyState />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

function PanelHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Layers;
}) {
  return (
    <header className="design-studio-panel-header">
      <Icon className="size-3.5 text-[#22d3ee]" />
      <h2>{title}</h2>
    </header>
  );
}

function ProductEcosystemColumn({ studio }: { studio: DesignStudioIntelligence }) {
  const bases = studio.productEcosystem.filter((row) =>
    PRIMARY_BASES.includes(row.category as (typeof PRIMARY_BASES)[number]),
  );

  return (
    <section className="design-studio-panel design-studio-panel-ecosystem">
      <PanelHeader title="Product Ecosystem" icon={Layers} />
      <div className="design-studio-ecosystem-list">
        {bases.map((row) => (
          <article key={row.category} className="design-studio-ecosystem-row">
            <div className="design-studio-ecosystem-row-main">
              <span className="design-studio-ecosystem-name">{row.category}</span>
              <span className="design-studio-ecosystem-count">
                {row.productCount}
              </span>
            </div>
            <span className="design-studio-ecosystem-meta">{row.priceRange}</span>
          </article>
        ))}
      </div>
      <div className="design-studio-ecosystem-collections">
        <p className="design-studio-ecosystem-collections-label">Collections</p>
        {studio.existingCollections.length > 0 ? (
          <ul className="design-studio-collection-list">
            {studio.existingCollections.slice(0, 5).map((col) => (
              <li key={col.title}>
                <span>{col.title}</span>
                <span>{col.productCount}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="design-studio-empty">No collections</p>
        )}
      </div>
    </section>
  );
}

function CollectionOpportunitiesColumn({
  studio,
}: {
  studio: DesignStudioIntelligence;
}) {
  const featured = studio.scoredOpportunities.slice(0, 4);

  return (
    <section className="design-studio-panel design-studio-panel-opportunities">
      <PanelHeader title="Collection Opportunities" icon={Sparkles} />
      <div className="design-studio-opportunity-list">
        {featured.map((item) => (
          <article key={item.id} className="design-studio-opportunity-row">
            <div className="design-studio-opportunity-row-head">
              <h3>{item.title}</h3>
              <ScorePill score={item.confidence} />
            </div>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SupplierCapabilitiesColumn({
  studio,
}: {
  studio: DesignStudioIntelligence;
}) {
  return (
    <section className="design-studio-panel design-studio-panel-supplier">
      <PanelHeader title="Supplier Capabilities" icon={Factory} />
      <p className="design-studio-supplier-name">
        {studio.supplierCapabilities.primarySupplier}
      </p>
      <div className="design-studio-chip-row">
        {SUPPLIER_CAPABILITY_CHIPS.map((cap) => (
          <span key={cap} className="design-studio-chip design-studio-chip-cap">
            {cap}
          </span>
        ))}
      </div>
      <ul className="design-studio-supplier-notes">
        {studio.supplierCapabilities.limitations.slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function CommerceIntelligenceSection({ studio }: { studio: DesignStudioIntelligence }) {
  const commerce = studio.commerceIntelligence;
  if (!commerce) return null;

  const historyActive =
    isCommerceHistoryActive(commerce.historical) ||
    Boolean(commerce.import?.summary.totalOrders);
  const placeholders = commerce.historical?.placeholders;
  const debug = commerce.debug;

  return (
    <section className="design-studio-commerce" aria-label="Commerce Intelligence">
      <header className="design-studio-intelligence-header">
        <BarChart3 className="size-4 text-[#22d3ee]" />
        <h2>Commerce Intelligence</h2>
        <span className="design-studio-intelligence-meta">
          {historyActive
            ? `${commerce.summary.totalOrders} orders · all-time history`
            : "Catalog mode · products & collections active"}
        </span>
      </header>

      {!historyActive ? (
        <div className="design-studio-commerce-historical-mode">
          <p className="design-studio-commerce-mode-label">Historical Commerce Mode</p>
          {commerce.loadError ? (
            <p className="design-studio-commerce-error">
              <strong>Orders API error:</strong> {commerce.loadError}
            </p>
          ) : null}
          {commerce.historical?.warning ? (
            <p className="design-studio-commerce-warning">{commerce.historical.warning}</p>
          ) : null}
          <div className="design-studio-commerce-summary design-studio-commerce-summary-historical">
            <CommerceStat
              label="Historical Revenue"
              value={formatHistoricalPlaceholder(
                placeholders?.historicalRevenue ?? "unavailable",
                commerce.summary.currency,
              )}
              muted={placeholders?.historicalRevenue === "unavailable"}
            />
            <CommerceStat
              label="Historical Units"
              value={formatHistoricalPlaceholder(
                placeholders?.historicalUnits ?? "unavailable",
              )}
              muted={placeholders?.historicalUnits === "unavailable"}
            />
            <CommerceStat
              label="Historical Bestseller"
              value={placeholders?.historicalBestseller ?? "unavailable"}
              muted={placeholders?.historicalBestseller === "unavailable"}
            />
            <CommerceStat
              label="Catalog Products"
              value={String(studio.summary.activeProducts)}
            />
          </div>
          <p className="design-studio-commerce-mode-note">
            Live catalog, collections, and supplier capabilities remain active. Historical
            intelligence activates automatically when Shopify read_all_orders or an import
            provider connects.
          </p>
          {debug ? (
            <details className="design-studio-commerce-raw">
              <summary>Integration diagnostics</summary>
              <dl className="design-studio-commerce-debug">
                <div>
                  <dt>read_orders</dt>
                  <dd>{debug.hasReadOrders ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt>read_all_orders</dt>
                  <dd>{debug.hasReadAllOrders ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt>Shopify ordersCount</dt>
                  <dd>{debug.ordersCountFromApi ?? "—"}</dd>
                </div>
              </dl>
            </details>
          ) : null}
        </div>
      ) : (
        <>
          <div className="design-studio-commerce-summary">
            <CommerceStat
              label="Historical Revenue"
              value={formatCommerceCurrency(
                commerce.summary.totalRevenue,
                commerce.summary.currency,
              )}
            />
            <CommerceStat
              label="Historical Units"
              value={String(commerce.summary.totalUnits)}
            />
            <CommerceStat
              label="Historical Bestseller"
              value={commerce.allTimeBestseller?.title ?? "—"}
            />
            <CommerceStat
              label="AOV"
              value={formatCommerceCurrency(
                commerce.summary.averageOrderValue,
                commerce.summary.currency,
              )}
            />
          </div>

          <div className="design-studio-intelligence-grid design-studio-intelligence-grid-performance">
            <CommerceLeaderColumn
              title="Top Units"
              icon={Trophy}
              rows={commerce.topUnits.slice(0, 5).map((p) => ({
                id: p.productId,
                name: p.title,
                primary: `${p.unitsSold} units`,
                secondary: formatCommerceCurrency(p.revenue, p.currency),
              }))}
            />
            <CommerceLeaderColumn
              title="Top Revenue"
              icon={DollarSign}
              rows={commerce.topRevenue.slice(0, 5).map((p) => ({
                id: p.productId,
                name: p.title,
                primary: formatCommerceCurrency(p.revenue, p.currency),
                secondary: `${p.unitsSold} units`,
              }))}
            />
            <CommerceLeaderColumn
              title="Top Categories"
              icon={Layers}
              rows={commerce.topCategories.slice(0, 5).map((c) => ({
                id: c.category,
                name: c.category,
                primary: `${c.unitsSold} units`,
                secondary: formatCommerceCurrency(c.revenue, commerce.summary.currency),
              }))}
            />
            <CommerceLeaderColumn
              title="Strongest Collections"
              icon={Sparkles}
              rows={commerce.topCollections.slice(0, 5).map((c) => ({
                id: c.title,
                name: c.title,
                primary: `${c.unitsSold} units`,
                secondary: formatCommerceCurrency(c.revenue, commerce.summary.currency),
              }))}
            />
            <CommerceLeaderColumn
              title="Seasonality"
              icon={TrendingUp}
              rows={commerce.seasonality.slice(0, 5).map((s) => ({
                id: String(s.month),
                name: s.monthLabel,
                primary: `${s.unitsSold} units`,
                secondary: `${s.orderCount} orders`,
              }))}
            />
          </div>
        </>
      )}
    </section>
  );
}

function CommerceStat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="design-studio-commerce-stat">
      <span className="design-studio-commerce-stat-label">{label}</span>
      <span
        className={cn(
          "design-studio-commerce-stat-value",
          muted && "design-studio-commerce-stat-unavailable",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CommerceLeaderColumn({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Trophy;
  rows: Array<{ id: string; name: string; primary: string; secondary: string }>;
}) {
  return (
    <article className="design-studio-intel-column">
      <header className="design-studio-intel-column-head">
        <Icon className="size-3 text-[#22d3ee]" />
        <h3>{title}</h3>
      </header>
      <ul className="design-studio-intel-list">
        {rows.length > 0 ? (
          rows.map((row) => (
            <li key={row.id}>
              <span className="design-studio-intel-name">{row.name}</span>
              <span className="design-studio-intel-meta">
                <span className="design-studio-intel-primary">{row.primary}</span>
                <span className="design-studio-intel-suffix">{row.secondary}</span>
              </span>
            </li>
          ))
        ) : (
          <li className="design-studio-empty">No data</li>
        )}
      </ul>
    </article>
  );
}

function DesignIntelligenceSection({ studio }: { studio: DesignStudioIntelligence }) {
  const { designIntelligence } = studio;

  return (
    <section className="design-studio-intelligence" aria-label="Design Intelligence">
      <header className="design-studio-intelligence-header">
        <Brain className="size-4 text-[#22d3ee]" />
        <h2>Design Intelligence</h2>
        <span className="design-studio-intelligence-meta">
          {designIntelligence.scoredProducts.length} products
          {designIntelligence.hasCommerceHistory ? " · commerce-weighted" : ""}
        </span>
      </header>

      <div className="design-studio-intelligence-grid design-studio-intelligence-grid-performance">
        <IntelligenceLeaderColumn
          title="Top Sellers"
          icon={Trophy}
          products={designIntelligence.topSellers}
          metric="heroProductScore"
          suffix={(p) =>
            p.historical
              ? `${p.historical.unitsSold} units · score ${p.historical.historicalScore}`
              : p.commerce
                ? `${p.commerce.unitsSold} units`
                : p.performance
                  ? `${p.performance.unitsSold} units`
                  : "No sales"
          }
        />
        <IntelligenceLeaderColumn
          title="Most Revenue"
          icon={DollarSign}
          products={designIntelligence.mostRevenue}
          metric="heroProductScore"
          suffix={(p) =>
            p.commerce
              ? formatCommerceCurrency(p.commerce.revenue, p.commerce.currency)
              : p.performance
                ? formatCommerceCurrency(p.performance.revenue, p.performance.currency)
                : "—"
          }
        />
        <IntelligenceLeaderColumn
          title="Fastest Growing"
          icon={ArrowUpRight}
          products={designIntelligence.fastestGrowing}
          metric="heroProductScore"
          suffix={(p) =>
            p.performance ? `trend ${p.performance.trendScore}%` : "—"
          }
        />
        <IntelligenceLeaderColumn
          title="Lowest Performing"
          icon={ArrowDownRight}
          products={designIntelligence.lowestPerforming}
          metric="heroProductScore"
          suffix={(p) =>
            p.performance ? `#${p.performance.salesRank}` : "—"
          }
        />
        <IntelligenceLeaderColumn
          title="Highest Potential"
          icon={Sparkles}
          products={designIntelligence.highestPotential}
          metric="launchPotential"
        />
      </div>

      <div className="design-studio-intelligence-grid design-studio-intelligence-grid-design">
        <IntelligenceLeaderColumn
          title="Top Hero Products"
          icon={Star}
          products={designIntelligence.topHeroProducts}
          metric="heroProductScore"
        />
        <IntelligenceLeaderColumn
          title="Campaign Potential"
          icon={TrendingUp}
          products={designIntelligence.highestCampaignPotential}
          metric="campaignScore"
        />
        <IntelligenceLeaderColumn
          title="Embroidery Candidates"
          icon={Factory}
          products={designIntelligence.bestEmbroideryCandidates}
          metric="heroProductScore"
          suffix={(p) => p.embroideryPotential}
        />
      </div>
    </section>
  );
}


function IntelligenceLeaderColumn({
  title,
  icon: Icon,
  products,
  metric,
  suffix,
}: {
  title: string;
  icon: typeof Star;
  products: ProductIntelligence[];
  metric: "compositeScore" | "premiumScore" | "campaignScore" | "streetwearScore" | "heroProductScore" | "launchPotential";
  suffix?: (product: ProductIntelligence) => string;
}) {
  return (
    <article className="design-studio-intel-column">
      <header className="design-studio-intel-column-head">
        <Icon className="size-3 text-[#22d3ee]" />
        <h3>{title}</h3>
      </header>
      <ul className="design-studio-intel-list">
        {products.length > 0 ? (
          products.map((product) => (
            <li key={product.productId}>
              <span className="design-studio-intel-name">{product.title}</span>
              <span className="design-studio-intel-meta">
                <ScorePill score={product[metric]} />
                {suffix ? (
                  <span className="design-studio-intel-suffix">{suffix(product)}</span>
                ) : null}
              </span>
            </li>
          ))
        ) : (
          <li className="design-studio-empty">No matches</li>
        )}
      </ul>
    </article>
  );
}

function ProductIntelligenceGrid({ studio }: { studio: DesignStudioIntelligence }) {
  const products = studio.designIntelligence.scoredProducts.slice(0, 12);

  return (
    <section className="design-studio-products" aria-label="Product intelligence cards">
      <header className="design-studio-products-header">
        <h2>Catalog Intelligence</h2>
        <span>{products.length} scored products</span>
      </header>
      <div className="design-studio-product-grid">
        {products.map((product) => (
          <ProductIntelligenceCard key={product.productId} product={product} />
        ))}
      </div>
    </section>
  );
}

function ProductIntelligenceCard({ product }: { product: ProductIntelligence }) {
  const perf = product.performance;
  const commerce = product.commerce;
  const historical = product.historical;

  return (
    <article className="design-studio-product-card">
      <div className="design-studio-product-card-head">
        <h3>{product.title}</h3>
        <ScorePill score={product.heroProductScore} />
      </div>
      <p className="design-studio-product-card-category">
        {product.category}
        {(historical?.bestsellerRank ?? commerce?.unitsRank ?? product.productRank) > 0
          ? ` · Rank #${historical?.bestsellerRank ?? commerce?.unitsRank ?? product.productRank}`
          : ""}
        {historical ? " · export history" : commerce && !commerce.inActiveCatalog ? " · historical" : ""}
      </p>

      {historical ? (
        <dl className="design-studio-product-scores design-studio-product-scores-performance">
          <div>
            <dt>Units Sold</dt>
            <dd>{historical.unitsSold}</dd>
          </div>
          <div>
            <dt>Historical Score</dt>
            <dd>{historical.historicalScore}</dd>
          </div>
          <div>
            <dt>Orders</dt>
            <dd>{historical.orderCount}</dd>
          </div>
        </dl>
      ) : commerce ? (
        <dl className="design-studio-product-scores design-studio-product-scores-performance">
          <div>
            <dt>Revenue</dt>
            <dd>{formatCommerceCurrency(commerce.revenue, commerce.currency)}</dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>{commerce.unitsSold}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>#{commerce.unitsRank}</dd>
          </div>
        </dl>
      ) : perf ? (
        <dl className="design-studio-product-scores design-studio-product-scores-performance">
          <div>
            <dt>Revenue</dt>
            <dd>{formatCommerceCurrency(perf.revenue, perf.currency)}</dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>{perf.unitsSold}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>#{perf.salesRank}</dd>
          </div>
        </dl>
      ) : null}

      <dl className="design-studio-product-scores">
        <div>
          <dt>Campaign</dt>
          <dd>{product.campaignScore}%</dd>
        </div>
        <div>
          <dt>Launch</dt>
          <dd>{product.launchPotential}%</dd>
        </div>
        <div>
          <dt>Hero</dt>
          <dd>{product.heroProductScore}%</dd>
        </div>
      </dl>

      <div className="design-studio-product-meta">
        {perf ? (
          <>
            <span>Conversion {perf.conversionScore}%</span>
            <span>Trend {perf.trendScore}%</span>
          </>
        ) : null}
        <span>{product.capsuleFit}</span>
      </div>

      {product.badges.length > 0 ? (
        <div className="design-studio-badge-row">
          {product.badges.map((badge) => (
            <ProductBadge key={badge} badge={badge} score={product.heroProductScore} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ProductBadge({
  badge,
  score,
}: {
  badge: ProductIntelligence["badges"][number];
  score: number;
}) {
  const tier =
    score >= 90 ? "green" : score >= 80 ? "blue" : score >= 70 ? "orange" : "muted";

  return (
    <span className={cn("design-studio-product-badge", `design-intel-tier-${tier}`)}>
      {badge}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const tier =
    score >= 90 ? "green" : score >= 80 ? "blue" : score >= 70 ? "orange" : "muted";

  return (
    <span className={cn("design-studio-score-pill", `design-intel-tier-${tier}`)}>
      {score}%
    </span>
  );
}
