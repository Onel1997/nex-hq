"use client";

import type { AgentId } from "@/lib/constants/agents";
import { getAgentCatalog, getAgentLiveStatus } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT } from "@/lib/i18n";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";
import {
  Crown,
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  image: Wand2,
  marketing: Megaphone,
  shopify: ShoppingBag,
};

export function AiTeamLive() {
  const locale = useLocale();
  const t = useT();
  const { common, dashboard } = useDictionary();
  const agentCatalog = getAgentCatalog(locale);
  const agentLiveStatus = getAgentLiveStatus(locale);

  return (
    <section className="space-y-12">
      <SectionHeading
        label={dashboard.team.label}
        title={dashboard.team.title}
        description={dashboard.team.description}
        action={
          <div className="flex items-center gap-3 text-base text-muted-foreground">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            {t("common.activeCount", { count: 1 })}
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {agentLiveStatus.map((live) => {
          const agent = agentCatalog[live.id];
          const Icon = AGENT_ICONS[live.id];
          const isActive = live.status === "active";

          return (
            <div
              key={live.id}
              className={cn(
                "luxury-surface group p-8 transition-all duration-500",
                "hover:border-primary/20",
                isActive && "luxury-surface-elevated border-primary/15",
              )}
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex size-14 items-center justify-center rounded-2xl",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-medium text-foreground">
                      {agent.name}
                    </h3>
                    <p className="mt-1 text-base text-muted-foreground">
                      {agent.role}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium tracking-wide",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {isActive ? common.status.active : common.status.planned}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-label mb-2">{dashboard.team.currentFocus}</p>
                  <p className="text-lg leading-relaxed text-foreground">
                    {live.currentFocus}
                  </p>
                </div>
                <div>
                  <p className="text-label mb-2">{dashboard.team.nextObjective}</p>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    {live.nextTask}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-6">
                  <div>
                    <p className="text-label mb-1">{dashboard.team.priority}</p>
                    <p
                      className={cn(
                        "text-base font-medium",
                        live.priority === "urgent" && "text-red-400",
                        live.priority === "high" && "text-amber-300/90",
                        live.priority === "medium" && "text-foreground",
                        live.priority === "low" && "text-muted-foreground",
                      )}
                    >
                      {common.priority[live.priority]}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-sm text-primary/80">
                      {common.inSession}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
