"use client";

import { DesignInterface } from "@/components/design/design-interface";
import { useDesignStudio } from "@/components/design/use-design-studio";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { DesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import { cn } from "@/lib/utils";
import {
  Factory,
  Home,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const PRIMARY_BASES = ["T-Shirts", "Hoodies", "Beanies", "Accessories"] as const;

const FEATURED_OPPORTUNITY_IDS = [
  "winter-essentials",
  "essentials-2",
  "premium-embroidery",
  "heavyweight-oversized",
] as const;

const FEATURED_OPPORTUNITY_LABELS: Record<
  (typeof FEATURED_OPPORTUNITY_IDS)[number],
  string
> = {
  "winter-essentials": "Winter Capsule",
  "essentials-2": "Essentials 2.0",
  "premium-embroidery": "Premium Embroidery",
  "heavyweight-oversized": "Heavyweight Collection",
};

const SUPPLIER_CAPABILITY_CHIPS = [
  "DTG",
  "Embroidery",
  "Oversized",
  "POD",
  "Premium blanks",
] as const;

export function DesignStudioCenter() {
  const { data, loading, error, refresh } = useDesignStudio();

  return (
    <WorkspaceShell agentId="designer" className="design-studio-shell" hideHeader>
      <div className="design-studio">
        <header className="design-studio-topbar">
          <nav className="design-studio-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="design-studio-crumb">
              <Home className="size-3.5" />
              Facility
            </Link>
            <ChevronRight className="size-3.5 opacity-40" />
            <span className="design-studio-crumb design-studio-crumb-current">
              <Palette className="size-3.5" />
              Design Studio
            </span>
          </nav>

          <div className="design-studio-topbar-meta">
            {data ? (
              <>
                <TopBarStat
                  label="Supplier"
                  value={data.businessMeta.primarySupplier.replace(
                    " Print On Demand",
                    "",
                  )}
                />
                <TopBarStat
                  label="MarketPrint Fit"
                  value={`${data.studio.summary.averageSuitability}%`}
                />
                <TopBarStat
                  label="Products"
                  value={String(data.studio.summary.activeProducts)}
                />
              </>
            ) : null}
            <span className="design-studio-live">
              <span className="design-studio-live-dot" />
              Live commerce
            </span>
            <button
              type="button"
              className="design-studio-refresh"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Sync
            </button>
          </div>
        </header>

        {loading && !data ? (
          <div className="design-studio-loading">
            <Loader2 className="size-8 animate-spin text-[#22d3ee]" />
            <p>Loading live catalog…</p>
          </div>
        ) : error && !data ? (
          <div className="design-studio-error">
            <p>{error}</p>
            <button type="button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            <div className="design-studio-row-1">
              <ProductEcosystemColumn studio={data.studio} />
              <CollectionOpportunitiesColumn studio={data.studio} />
              <SupplierCapabilitiesColumn studio={data.studio} />
            </div>

            <section className="design-studio-mission" aria-label="Creative Director">
              <DesignInterface variant="compact" />
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function TopBarStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="design-studio-topbar-stat">
      <span className="design-studio-topbar-stat-label">{label}</span>
      <span className="design-studio-topbar-stat-value">{value}</span>
    </span>
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
  const featured = FEATURED_OPPORTUNITY_IDS.map((id) => {
    const item = studio.collectionOpportunities.find((o) => o.id === id);
    if (!item) return null;
    return {
      ...item,
      title: FEATURED_OPPORTUNITY_LABELS[id],
    };
  }).filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
    marketPrintSuitability?: number;
  }>;

  return (
    <section className="design-studio-panel design-studio-panel-opportunities">
      <PanelHeader title="Collection Opportunities" icon={Sparkles} />
      <div className="design-studio-opportunity-list">
        {featured.map((item) => (
          <article key={item.id} className="design-studio-opportunity-row">
            <div className="design-studio-opportunity-row-head">
              <h3>{item.title}</h3>
              {item.marketPrintSuitability ? (
                <span className="design-studio-suitability-badge">
                  {item.marketPrintSuitability}%
                </span>
              ) : null}
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
