import { AGENT_CATALOG, type AgentId } from "@/lib/constants/agents";
import { AGENT_LIVE_STATUS } from "@/lib/mock/command-center";
import { SectionHeading } from "@/components/shared/section-heading";
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

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function AiTeamLive() {
  return (
    <section className="space-y-12">
      <SectionHeading
        label="AI Team"
        title="Your creative intelligence"
        description="Six agents aligned to your brand — one active, five preparing for launch."
        action={
          <div className="flex items-center gap-3 text-base text-muted-foreground">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            1 active
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {AGENT_LIVE_STATUS.map((live) => {
          const agent = AGENT_CATALOG[live.id];
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
                  {isActive ? "Active" : "Planned"}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-label mb-2">Current Focus</p>
                  <p className="text-lg leading-relaxed text-foreground">
                    {live.currentFocus}
                  </p>
                </div>
                <div>
                  <p className="text-label mb-2">Next Objective</p>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    {live.nextTask}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-6">
                  <div>
                    <p className="text-label mb-1">Priority</p>
                    <p
                      className={cn(
                        "text-base font-medium capitalize",
                        live.priority === "urgent" && "text-red-400",
                        live.priority === "high" && "text-amber-300/90",
                        live.priority === "medium" && "text-foreground",
                        live.priority === "low" && "text-muted-foreground",
                      )}
                    >
                      {PRIORITY_LABEL[live.priority]}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-sm text-primary/80">In session</span>
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
