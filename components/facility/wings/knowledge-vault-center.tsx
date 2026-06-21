"use client";

import { useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type { BrainSectionId } from "@/lib/mock/brain-knowledge";
import { getBrainSections, getBrainSystemStats } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Archive, Brain, Database, FileText, History, Loader2 } from "lucide-react";

const VAULT_SHELVES = [
  { id: "reports", label: "Reports", icon: FileText },
  { id: "research", label: "Research", icon: Brain },
  { id: "historical", label: "Historical Data", icon: History },
  { id: "documents", label: "Documents", icon: Archive },
  { id: "memory", label: "Agent Memory", icon: Database },
] as const;

type VaultShelf = (typeof VAULT_SHELVES)[number]["id"];

export function KnowledgeVaultCenter() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { brain } = useDictionary();
  const sections = getBrainSections(locale, workspace.name);
  const stats = getBrainSystemStats(locale, workspace.name);
  const [shelf, setShelf] = useState<VaultShelf>("reports");
  const [activeSection, setActiveSection] = useState<BrainSectionId>("brand_vision");

  const active = sections.find((s) => s.id === activeSection);

  return (
    <FacilityDepartmentShell
      wingId="knowledge"
      title="Knowledge Vault"
      icon={Archive}
      subtitle="Dark archive — reports, research, historical data, documents, and agent memory"
    >
      <div className="facility-vault-stats">
        {[
          { label: "Domains", value: String(stats.sections) },
          { label: "Synced", value: String(stats.synced) },
          { label: "Entries", value: String(stats.entries) },
          { label: "Status", value: t("common.status.online"), highlight: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "facility-vault-stat",
              stat.highlight && "facility-vault-stat-highlight",
            )}
          >
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="facility-vault-layout">
        <aside className="facility-vault-shelves">
          <p className="facility-vault-shelves-label">Archive Shelves</p>
          <ul>
            {VAULT_SHELVES.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "facility-vault-shelf-btn",
                      shelf === item.id && "facility-vault-shelf-btn-active",
                    )}
                    onClick={() => setShelf(item.id)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="facility-vault-content">
          <div className="facility-vault-index">
            <p className="facility-vault-index-label">{brain.knowledgeIndex}</p>
            <ul className="facility-vault-section-list">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={cn(
                        "facility-vault-section-btn",
                        isActive && "facility-vault-section-btn-active",
                      )}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <Icon className="size-4" />
                      <span>{section.title}</span>
                      <span>{section.entries.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="facility-vault-reader">
            {active ? (
              <>
                <header className="facility-vault-reader-header">
                  <h2>
                    {VAULT_SHELVES.find((s) => s.id === shelf)?.label ?? active.title}
                    {shelf === "reports" || shelf === "research" || shelf === "historical"
                      ? ` · ${active.title}`
                      : null}
                  </h2>
                  <span>{active.entries.length} entries</span>
                </header>
                <div className="facility-vault-entries">
                  {active.entries.map((entry, index) => (
                    <article key={`${entry.label}-${index}`} className="facility-vault-entry">
                      <h3>{entry.label}</h3>
                      <p>{entry.value}</p>
                      {entry.tags?.length ? (
                        <div className="facility-vault-tags">
                          {entry.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="facility-wing-loading">
                <Loader2 className="size-8 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </FacilityDepartmentShell>
  );
}
