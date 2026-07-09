"use client";

import type { CeoMode } from "@/components/ceo/ceo-interface-types";
import type { CeoDashboardData } from "@/components/ceo/use-ceo-dashboard";
import { useT } from "@/lib/i18n";

interface CeoHeroStatusProps {
  mode: CeoMode;
  data: CeoDashboardData | null;
  isLoading?: boolean;
}

export function CeoHeroStatus({ mode, data, isLoading }: CeoHeroStatusProps) {
  const t = useT();

  const agentsOnline = data
    ? data.intelligence.agentStatus.filter(
        (a) => a.status !== "waiting",
      ).length
    : null;

  const delegatedTasks = data?.summary.ceoCreated ?? null;
  const pendingReview = data?.summary.execution.pendingReview ?? null;

  const items = [
    mode === "delegation"
      ? t("ceo.heroStatus.executiveMode")
      : t("ceo.heroStatus.briefingMode"),
    isLoading
      ? t("ceo.heroStatus.loading")
      : agentsOnline != null
        ? t("ceo.heroStatus.agentsOnline", { count: String(agentsOnline) })
        : null,
    isLoading
      ? null
      : delegatedTasks != null
        ? t("ceo.heroStatus.delegatedTasks", {
            count: String(delegatedTasks),
          })
        : null,
    isLoading
      ? null
      : pendingReview != null
        ? t("ceo.heroStatus.pendingReview", {
            count: String(pendingReview),
          })
        : null,
  ].filter(Boolean) as string[];

  return (
    <aside className="ceo-hero-status" aria-label={t("ceo.heroStatus.label")}>
      <p className="ceo-hero-status-label">{t("ceo.heroStatus.label")}</p>
      <ul className="ceo-hero-status-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
