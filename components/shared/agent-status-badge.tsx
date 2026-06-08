"use client";

import { type AgentStatus } from "@/lib/constants/agents";
import { getAgentStatusLabels } from "@/lib/i18n/data";
import { useLocale } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AgentStatus, string> = {
  active:
    "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10",
  planned:
    "border-border bg-muted/50 text-muted-foreground hover:bg-muted/50",
};

interface AgentStatusBadgeProps {
  status: AgentStatus;
  showPulse?: boolean;
  className?: string;
}

export function AgentStatusBadge({
  status,
  showPulse = false,
  className,
}: AgentStatusBadgeProps) {
  const locale = useLocale();
  const labels = getAgentStatusLabels(locale);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 px-3 py-1 text-sm font-normal",
        STATUS_STYLES[status],
        className,
      )}
    >
      {showPulse && status === "active" && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      )}
      {labels[status]}
    </Badge>
  );
}
