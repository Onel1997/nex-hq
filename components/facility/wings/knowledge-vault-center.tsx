"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  KnowledgeVaultPayload,
  KnowledgeVaultReportCard,
  KnowledgeVaultSearchScope,
  KnowledgeVaultSectionId,
  KnowledgeVaultSubsection,
} from "@/lib/facility/knowledge-vault-types";
import { cn } from "@/lib/utils";
import {
  Archive,
  Brain,
  Clock,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const SEARCH_SCOPES: Array<{ id: KnowledgeVaultSearchScope; label: string }> = [
  { id: "all", label: "All" },
  { id: "products", label: "Products" },
  { id: "reports", label: "Reports" },
  { id: "missions", label: "Missions" },
  { id: "trends", label: "Trends" },
  { id: "agents", label: "Agents" },
];

const SECTION_ICONS: Record<
  KnowledgeVaultSectionId,
  React.ComponentType<{ className?: string }>
> = {
  commerce: ShoppingBag,
  research: TrendingUp,
  design: Palette,
  marketing: Sparkles,
  agents: Brain,
};

const STATUS_LABELS: Record<KnowledgeVaultReportCard["status"], string> = {
  approved: "Approved",
  pending_review: "Review",
  draft: "Draft",
  archived: "Archived",
  classified: "Classified",
};

export function KnowledgeVaultCenter() {
  const { data, loading, error, refresh } = useKnowledgeVault();

  return (
    <FacilityDepartmentShell
      wingId="knowledge"
      title="Knowledge Vault"
      icon={Archive}
      subtitle="Classified AI archive — the central memory of Milaene HQ"
      className="kv-shell"
      headerActions={
        <button
          type="button"
          className="kv-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync Archive
        </button>
      }
    >
      {loading && !data ? (
        <div className="kv-loading">
          <Loader2 className="size-8 animate-spin text-[var(--kv-accent)]" />
          <p>Decrypting classified archive…</p>
        </div>
      ) : error ? (
        <div className="kv-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <KnowledgeVaultArchive data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function KnowledgeVaultArchive({ data }: { data: KnowledgeVaultPayload }) {
  const [section, setSection] = useState<KnowledgeVaultSectionId>("commerce");
  const [subsection, setSubsection] = useState<KnowledgeVaultSubsection | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<KnowledgeVaultSearchScope>("all");

  const activeSection = data.sections.find((s) => s.id === section);

  useEffect(() => {
    setSubsection("all");
  }, [section]);

  const filteredReports = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return data.reports.filter((report) => {
      if (report.sectionId !== section) return false;
      if (subsection !== "all" && report.subsection !== subsection) return false;

      if (!needle) return matchesScope(report, scope);

      const haystack = [
        report.title,
        report.department,
        report.authorAgent,
        report.summary ?? "",
        ...(report.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(needle)) return false;
      return matchesScope(report, scope);
    });
  }, [data.reports, section, subsection, query, scope]);

  return (
    <div className="kv-archive">
      <div className="kv-scanlines" aria-hidden />

      <CommandBar bar={data.commandBar} />

      <SearchPanel
        query={query}
        scope={scope}
        onQueryChange={setQuery}
        onScopeChange={setScope}
      />

      <div className="kv-layout">
        <nav className="kv-sections" aria-label="Archive sections">
          <p className="kv-panel-label">Intelligence Sections</p>
          <ul>
            {data.sections.map((item) => {
              const Icon = SECTION_ICONS[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "kv-section-btn",
                      section === item.id && "kv-section-btn-active",
                    )}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="kv-section-text">
                      <strong>{item.label}</strong>
                      <small>{item.count} entries</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {activeSection ? (
            <div className="kv-subsections">
              <p className="kv-panel-label">Subsections</p>
              <div className="kv-subsection-chips">
                <button
                  type="button"
                  className={cn(
                    "kv-chip",
                    subsection === "all" && "kv-chip-active",
                  )}
                  onClick={() => setSubsection("all")}
                >
                  All
                </button>
                {activeSection.subsections.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={cn(
                      "kv-chip",
                      subsection === sub.id && "kv-chip-active",
                    )}
                    onClick={() => setSubsection(sub.id)}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </nav>

        <section className="kv-records" aria-label="Report cards">
          <header className="kv-records-header">
            <div>
              <h2>{activeSection?.label ?? "Archive"}</h2>
              <p>
                {filteredReports.length} classified record
                {filteredReports.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="kv-classification">EYES ONLY · MILAENE HQ</span>
          </header>

          {filteredReports.length === 0 ? (
            <p className="kv-empty">No records match this filter</p>
          ) : (
            <div className="kv-card-grid">
              {filteredReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </section>

        <aside className="kv-side">
          <TimelinePanel timeline={data.timeline} />
          <FuturePanel modules={data.futureModules} />
        </aside>
      </div>
    </div>
  );
}

function CommandBar({ bar }: { bar: KnowledgeVaultPayload["commandBar"] }) {
  const items = [
    { label: "Total Entries", value: bar.totalEntries, glow: true },
    { label: "Sections Indexed", value: bar.sectionsIndexed },
    { label: "Agents Contributing", value: bar.agentsContributing, pulse: true },
    {
      label: "Last Sync",
      value: new Date(bar.lastSync).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ];

  return (
    <div className="kv-command-bar">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "kv-command-stat",
            item.glow && "kv-command-stat-glow",
          )}
        >
          {item.pulse ? <span className="kv-pulse-dot" /> : null}
          <span className="kv-command-label">{item.label}</span>
          <span className="kv-command-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function SearchPanel({
  query,
  scope,
  onQueryChange,
  onScopeChange,
}: {
  query: string;
  scope: KnowledgeVaultSearchScope;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: KnowledgeVaultSearchScope) => void;
}) {
  return (
    <div className="kv-search">
      <div className="kv-search-input-wrap">
        <Search className="size-4 shrink-0 text-[var(--kv-accent)]" />
        <input
          type="search"
          className="kv-search-input"
          placeholder="Global AI search — products, reports, missions, trends, agents…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="kv-search-scopes">
        {SEARCH_SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("kv-scope-btn", scope === item.id && "kv-scope-btn-active")}
            onClick={() => onScopeChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: KnowledgeVaultReportCard }) {
  const subsectionLabel =
    report.subsection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <article
      className={cn("kv-card", `kv-card-status-${report.status}`)}
    >
      <header className="kv-card-header">
        <span className="kv-card-dept">{report.department}</span>
        <span className={cn("kv-card-status", `kv-status-${report.status}`)}>
          {STATUS_LABELS[report.status]}
        </span>
      </header>

      <h3 className="kv-card-title">{report.title}</h3>

      {report.summary ? (
        <p className="kv-card-summary">{report.summary}</p>
      ) : null}

      <footer className="kv-card-footer">
        <span>
          <Clock className="size-3" />
          {new Date(report.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span>{report.authorAgent}</span>
        <span className="kv-card-subsection">{subsectionLabel}</span>
      </footer>

      {report.tags?.length ? (
        <div className="kv-card-tags">
          {report.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <span className="kv-card-stamp" aria-hidden>
        ARCHIVED
      </span>
    </article>
  );
}

function TimelinePanel({
  timeline,
}: {
  timeline: KnowledgeVaultPayload["timeline"];
}) {
  return (
    <section className="kv-panel kv-timeline">
      <header className="kv-panel-header">
        <Target className="size-4" />
        <h2>Memory Timeline</h2>
      </header>
      <ol className="kv-timeline-list">
        {timeline.map((event, index) => (
          <li
            key={event.id}
            className={cn("kv-timeline-item", `kv-timeline-${event.kind}`)}
          >
            <div className="kv-timeline-node">
              <span className="kv-timeline-dot" />
              {index < timeline.length - 1 ? (
                <span className="kv-timeline-line" />
              ) : null}
            </div>
            <div className="kv-timeline-body">
              <p>{event.message}</p>
              <span>
                {event.department} ·{" "}
                {new Date(event.timestamp).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FuturePanel({ modules }: { modules: string[] }) {
  return (
    <section className="kv-panel kv-future">
      <header className="kv-panel-header">
        <Brain className="size-4" />
        <h2>Future Modules</h2>
      </header>
      <ul className="kv-future-list">
        {modules.map((module) => (
          <li key={module}>
            <span>{module}</span>
            <span className="kv-future-soon">Coming online</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function matchesScope(
  report: KnowledgeVaultReportCard,
  scope: KnowledgeVaultSearchScope,
): boolean {
  if (scope === "all") return true;

  const haystack = `${report.title} ${report.summary ?? ""} ${report.authorAgent}`.toLowerCase();

  switch (scope) {
    case "products":
      return (
        report.subsection === "product_performance" ||
        /product|sku|bestseller|catalog/i.test(haystack)
      );
    case "reports":
      return report.sectionId !== "agents" || report.subsection !== "missions";
    case "missions":
      return report.subsection === "missions" || /mission|task/i.test(haystack);
    case "trends":
      return (
        report.sectionId === "research" ||
        /trend|market|competitor|signal/i.test(haystack)
      );
    case "agents":
      return (
        report.sectionId === "agents" ||
        /agent|ceo|output|decision/i.test(haystack)
      );
    default:
      return true;
  }
}

function useKnowledgeVault() {
  const [data, setData] = useState<KnowledgeVaultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facility/knowledge");
      const body = (await res.json()) as KnowledgeVaultPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Knowledge Vault");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Knowledge Vault");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
