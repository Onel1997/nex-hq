"use client";

import {
  type AgentDefinition,
  type AgentId,
} from "@/lib/constants/agents";
import { getAgentCatalog } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT } from "@/lib/i18n";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { OsPanel, OsPanelContent, OsPanelHeader } from "@/components/shared/os-panel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Crown,
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  marketing: Megaphone,
  shopify: ShoppingBag,
};

interface AgentCardProps {
  agent: AgentDefinition;
  featured?: boolean;
  className?: string;
}

export function AgentCard({ agent, featured = false, className }: AgentCardProps) {
  const t = useT();
  const { agents } = useDictionary();
  const Icon = AGENT_ICONS[agent.id];
  const isActive = agent.status === "active";

  return (
    <OsPanel
      glow={isActive}
      className={cn(featured && "border-primary/15", className)}
    >
      <OsPanelHeader
        title={agent.name}
        subtitle={agent.role}
        action={<AgentStatusBadge status={agent.status} showPulse={isActive} />}
      />
      <OsPanelContent className="space-y-8">
        <p className="text-lg leading-relaxed text-muted-foreground">
          {agent.description}
        </p>

        <div className="space-y-3">
          <p className="text-label">{agents.capabilities}</p>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className="bg-muted/60 px-3 py-1 text-sm font-normal"
              >
                {cap}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-label">{agents.responsibilities}</p>
          <ul className="space-y-3">
            {agent.responsibilities.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-base leading-relaxed text-muted-foreground"
              >
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            {t("common.reportsTo")}{" "}
            <span className="font-medium text-foreground">
              {agent.reportsTo === "human"
                ? t("common.founderLabel")
                : t("dashboard.command.ceoAgent")}
            </span>
          </span>
          <Icon className="size-4 opacity-40" />
        </div>
      </OsPanelContent>
    </OsPanel>
  );
}

export function AgentRoster() {
  const locale = useLocale();
  const { agents } = useDictionary();
  const catalog = getAgentCatalog(locale);
  const ceo = catalog.ceo;
  const specialists = Object.values(catalog).filter((a) => a.id !== "ceo");

  return (
    <div className="space-y-10">
      <AgentCard agent={ceo} featured />
      <div>
        <p className="text-label mb-6">{agents.specialistAgents}</p>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {specialists.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
