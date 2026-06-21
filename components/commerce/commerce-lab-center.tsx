"use client";

import { CommerceLabSidebar } from "@/components/commerce/commerce-lab-sidebar";
import { useCommerceLab } from "@/components/commerce/use-commerce-lab";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import type {
  CommerceLabCategoryRow,
  CommerceLabInsight,
  CommerceLabPayload,
  CommerceLabProductRow,
  CommerceLabSeasonRow,
} from "@/lib/commerce/commerce-lab-types";
import { formatCommerceCurrency } from "@/lib/shopify/commerce-shared";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Crown,
  Home,
  Layers,
  Lightbulb,
  Loader2,
  Megaphone,
  Package,
  Palette,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

export function CommerceLabCenter() {
  const { data, loading, error, refresh } = useCommerceLab();

  return (
    <div
      className="commerce-lab-shell"
      style={{ "--commerce-accent": "#F97316" } as React.CSSProperties}
    >
      <WorkspaceNav activeId="commerce" />

      <div className="commerce-lab">
        <header className="commerce-lab-header">
          <nav className="commerce-lab-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/" className="commerce-lab-crumb">
              <Home className="size-3.5" />
              Facility
            </Link>
            <ChevronRight className="size-3.5 opacity-40" />
            <span className="commerce-lab-crumb commerce-lab-crumb-current">
              <BarChart3 className="size-3.5" />
              Commerce Lab
            </span>
          </nav>

          <div className="commerce-lab-header-actions">
            {data ? (
              <span className="commerce-lab-live">
                <span className="commerce-lab-live-dot" />
                {data.hasHistoricalData ? "Historical data active" : "Catalog mode"}
              </span>
            ) : null}
            <button
              type="button"
              className="commerce-lab-refresh"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </button>
          </div>
        </header>

        {data ? (
          <div className="commerce-lab-meta">
            <MetaItem label="Revenue" value={formatCommerceCurrency(data.revenue.totalRevenue, data.revenue.currency)} />
            <MetaItem label="Orders" value={String(data.revenue.totalOrders)} />
            <MetaItem label="Products" value={String(data.products.bestsellers.length > 0 ? data.products.lifetimeRevenue.length : 0)} />
            <MetaItem label="Source" value={data.hasHistoricalData ? "Shopify export" : "Live catalog"} />
          </div>
        ) : null}

        <div className="commerce-lab-body">
          <main className="commerce-lab-main">
            {loading && !data ? (
              <div className="commerce-lab-loading">
                <Loader2 className="size-8 animate-spin text-[var(--commerce-accent)]" />
                <p>Analyzing commerce intelligence…</p>
              </div>
            ) : error ? (
              <div className="commerce-lab-error">
                <p>{error}</p>
                <button type="button" onClick={() => void refresh()}>
                  Retry
                </button>
              </div>
            ) : data ? (
              <CommerceLabDashboard data={data} />
            ) : null}
          </main>

          {data ? (
            <CommerceLabSidebar data={data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommerceLabDashboard({ data }: { data: CommerceLabPayload }) {
  return (
    <div className="commerce-lab-dashboard">
      <section className="commerce-lab-mission">
        <Sparkles className="size-4 text-[var(--commerce-accent)]" />
        <p>{data.mission}</p>
      </section>

      <RevenueSection data={data} />
      <ProductSection data={data} />
      <SeasonalSection data={data} />
      <CategorySection data={data} />
      <InsightSection
        title="Commerce Recommendations"
        icon={Lightbulb}
        insights={data.recommendations}
        accent="commerce"
      />
      <InsightSection
        title="CEO Insights"
        icon={Crown}
        insights={data.ceoInsights}
        accent="ceo"
      />
      <InsightSection
        title="Design Insights"
        icon={Palette}
        insights={data.designInsights}
        accent="design"
      />
      <InsightSection
        title="Marketing Insights"
        icon={Megaphone}
        insights={data.marketingInsights}
        accent="marketing"
      />
    </div>
  );
}

function RevenueSection({ data }: { data: CommerceLabPayload }) {
  const { revenue: r } = data;
  const growthUp = (r.revenueGrowthPercent ?? 0) >= 0;

  return (
    <Panel title="Revenue Intelligence" icon={BarChart3}>
      <div className="commerce-lab-kpi-grid">
        <Kpi label="Total Revenue" value={formatCommerceCurrency(r.totalRevenue, r.currency)} highlight />
        <Kpi label="Total Orders" value={String(r.totalOrders)} />
        <Kpi label="Paid Orders" value={String(r.paidOrders)} />
        <Kpi label="Average Order Value" value={formatCommerceCurrency(r.averageOrderValue, r.currency)} />
        <Kpi label="First Order" value={formatDate(r.firstOrder)} />
        <Kpi label="Latest Order" value={formatDate(r.latestOrder)} />
        <Kpi
          label="Revenue Growth"
          value={r.revenueGrowthPercent != null ? `${growthUp ? "+" : ""}${r.revenueGrowthPercent}%` : "—"}
          sub={r.revenueGrowthLabel}
          trend={r.revenueGrowthPercent != null ? (growthUp ? "up" : "down") : undefined}
        />
        <Kpi label="Total Units" value={String(r.totalUnits)} />
      </div>
    </Panel>
  );
}

function ProductSection({ data }: { data: CommerceLabPayload }) {
  return (
    <Panel title="Product Intelligence" icon={Package}>
      <div className="commerce-lab-product-grid">
        <ProductTable title="Top 10 Bestsellers" products={data.products.bestsellers} metric="units" currency={data.revenue.currency} />
        <ProductTable title="Worst Performing" products={data.products.worstPerforming} metric="units" currency={data.revenue.currency} muted />
        <ProductTable title="Highest Revenue" products={data.products.highestRevenue} metric="revenue" currency={data.revenue.currency} />
        <ProductTable title="Highest Volume" products={data.products.highestVolume} metric="units" currency={data.revenue.currency} />
      </div>
      <div className="commerce-lab-lifetime">
        <h3>Product Lifetime Revenue</h3>
        <div className="commerce-lab-lifetime-bars">
          {data.products.lifetimeRevenue.slice(0, 8).map((p) => {
            const max = data.products.lifetimeRevenue[0]?.revenue ?? 1;
            const pct = Math.round((p.revenue / max) * 100);
            return (
              <div key={p.productKey} className="commerce-lab-lifetime-row">
                <span className="commerce-lab-lifetime-title">{p.title}</span>
                <div className="commerce-lab-lifetime-track">
                  <div className="commerce-lab-lifetime-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="commerce-lab-lifetime-value">
                  {formatCommerceCurrency(p.revenue, data.revenue.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function SeasonalSection({ data }: { data: CommerceLabPayload }) {
  const { seasonal: s } = data;
  const maxRevenue = Math.max(...s.revenueByMonth.map((m) => m.revenue), 1);
  const maxUnits = Math.max(...s.unitsByMonth.map((m) => m.unitsSold), 1);

  return (
    <Panel title="Seasonal Intelligence" icon={Calendar}>
      <div className="commerce-lab-season-grid">
        <div>
          <h3 className="commerce-lab-subtitle">Revenue by Month</h3>
          <MonthChart rows={s.revenueByMonth} max={maxRevenue} metric="revenue" />
        </div>
        <div>
          <h3 className="commerce-lab-subtitle">Units by Month</h3>
          <MonthChart rows={s.unitsByMonth} max={maxUnits} metric="units" />
        </div>
      </div>

      <div className="commerce-lab-season-summary">
        {s.strongestSeason ? (
          <SeasonCard label="Strongest Season" season={s.strongestSeason} variant="strong" currency={data.revenue.currency} />
        ) : null}
        {s.weakestSeason ? (
          <SeasonCard label="Weakest Season" season={s.weakestSeason} variant="weak" currency={data.revenue.currency} />
        ) : null}
      </div>

      {s.suggestedDropWindows.length > 0 ? (
        <div className="commerce-lab-drop-windows">
          <h3 className="commerce-lab-subtitle">Suggested Drop Windows</h3>
          <ul>
            {s.suggestedDropWindows.map((window) => (
              <li key={window}>{window}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function CategorySection({ data }: { data: CommerceLabPayload }) {
  const { categories: c } = data;

  return (
    <Panel title="Category Intelligence" icon={Layers}>
      <div className="commerce-lab-category-grid">
        <CategoryTable title="Revenue by Category" rows={c.revenueByCategory} metric="revenue" currency={data.revenue.currency} />
        <CategoryTable title="Units by Category" rows={c.unitsByCategory} metric="units" />
      </div>

      {c.fastestGrowingCategory ? (
        <div className="commerce-lab-fastest-growing">
          <TrendingUp className="size-4 text-[var(--commerce-accent)]" />
          <span>
            Fastest growing: <strong>{c.fastestGrowingCategory.category}</strong>
            {" · "}
            {c.fastestGrowingCategory.sharePercent}% revenue share
          </span>
        </div>
      ) : null}

      <div className="commerce-lab-share-bars">
        <h3 className="commerce-lab-subtitle">Category Share %</h3>
        {c.revenueByCategory.slice(0, 6).map((cat) => (
          <div key={cat.category} className="commerce-lab-share-row">
            <span>{cat.category}</span>
            <div className="commerce-lab-share-track">
              <div className="commerce-lab-share-fill" style={{ width: `${cat.sharePercent}%` }} />
            </div>
            <span>{cat.sharePercent}%</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function InsightSection({
  title,
  icon: Icon,
  insights,
  accent,
}: {
  title: string;
  icon: LucideIcon;
  insights: CommerceLabInsight[];
  accent: string;
}) {
  return (
    <Panel title={title} icon={Icon}>
      <ul className="commerce-lab-insight-list">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className={cn("commerce-lab-insight", `commerce-lab-insight-${accent}`, `commerce-lab-insight-${insight.priority}`)}
          >
            <span className="commerce-lab-insight-priority">{insight.priority}</span>
            <p>{insight.message}</p>
            {insight.action ? (
              <span className="commerce-lab-insight-action">{insight.action}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="commerce-lab-panel">
      <header className="commerce-lab-panel-header">
        <Icon className="size-4 text-[var(--commerce-accent)]" />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <div className={cn("commerce-lab-kpi", highlight && "commerce-lab-kpi-highlight")}>
      <span className="commerce-lab-kpi-label">{label}</span>
      <span className="commerce-lab-kpi-value">
        {trend === "up" ? <TrendingUp className="size-3.5 text-emerald-400" /> : null}
        {trend === "down" ? <TrendingDown className="size-3.5 text-rose-400" /> : null}
        {value}
      </span>
      {sub ? <span className="commerce-lab-kpi-sub">{sub}</span> : null}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="commerce-lab-meta-item">
      <span className="commerce-lab-meta-label">{label}</span>
      <span className="commerce-lab-meta-value">{value}</span>
    </span>
  );
}

function ProductTable({
  title,
  products,
  metric,
  currency,
  muted,
}: {
  title: string;
  products: CommerceLabProductRow[];
  metric: "units" | "revenue";
  currency: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("commerce-lab-product-table", muted && "commerce-lab-product-table-muted")}>
      <h3>{title}</h3>
      {products.length === 0 ? (
        <p className="commerce-lab-empty">No product data</p>
      ) : (
        <ol>
          {products.slice(0, 10).map((p, i) => (
            <li key={p.productKey}>
              <span className="commerce-lab-rank">{i + 1}</span>
              <span className="commerce-lab-product-title">{p.title}</span>
              <span className="commerce-lab-product-metric">
                {metric === "units" ? `${p.unitsSold} u` : formatCommerceCurrency(p.revenue, currency)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MonthChart({
  rows,
  max,
  metric,
}: {
  rows: CommerceLabSeasonRow[];
  max: number;
  metric: "revenue" | "units";
}) {
  if (rows.length === 0) {
    return <p className="commerce-lab-empty">No seasonal data</p>;
  }

  return (
    <div className="commerce-lab-month-chart">
      {rows.map((row) => {
        const value = metric === "revenue" ? row.revenue : row.unitsSold;
        const pct = Math.round((value / max) * 100);
        return (
          <div key={row.month} className="commerce-lab-month-col">
            <div className="commerce-lab-month-bar-wrap">
              <div className="commerce-lab-month-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
            </div>
            <span className="commerce-lab-month-label">{row.monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function SeasonCard({
  label,
  season,
  variant,
  currency,
}: {
  label: string;
  season: { season: string; months: string[]; unitsSold: number; revenue: number };
  variant: "strong" | "weak";
  currency: string;
}) {
  return (
    <div className={cn("commerce-lab-season-card", `commerce-lab-season-card-${variant}`)}>
      <span className="commerce-lab-season-card-label">{label}</span>
      <strong>{season.season}</strong>
      <span>{season.months.join(" · ")}</span>
      <span>{formatCommerceCurrency(season.revenue, currency)} · {season.unitsSold} units</span>
    </div>
  );
}

function CategoryTable({
  title,
  rows,
  metric,
  currency,
}: {
  title: string;
  rows: CommerceLabCategoryRow[];
  metric: "revenue" | "units";
  currency?: string;
}) {
  return (
    <div className="commerce-lab-category-table">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="commerce-lab-empty">No category data</p>
      ) : (
        <ul>
          {rows.slice(0, 8).map((row) => (
            <li key={row.category}>
              <span>{row.category}</span>
              <span>
                {metric === "revenue" && currency
                  ? formatCommerceCurrency(row.revenue, currency)
                  : `${row.unitsSold} u`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
