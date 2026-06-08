"use client";

import { getAgentCatalog } from "@/lib/i18n/data";
import { useDictionary, useLocale } from "@/lib/i18n";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";

export function AgentOverview() {
  const locale = useLocale();
  const { agents } = useDictionary();
  const catalog = getAgentCatalog(locale);
  const active = Object.values(catalog).filter((a) => a.status === "active").length;
  const planned = Object.values(catalog).filter((a) => a.status === "planned").length;

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {[
        { label: agents.overview.total, value: "6" },
        { label: agents.overview.active, value: String(active), highlight: true },
        { label: agents.overview.planned, value: String(planned) },
      ].map((stat) => (
        <div key={stat.label} className="luxury-surface p-8">
          <p className="text-label">{stat.label}</p>
          <p
            className={`mt-2 font-display text-5xl font-medium tracking-tight ${
              stat.highlight ? "text-primary" : "text-foreground"
            }`}
          >
            {stat.value}
          </p>
          {stat.highlight && (
            <div className="mt-4">
              <AgentStatusBadge status="active" showPulse />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
