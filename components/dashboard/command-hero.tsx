"use client";

import {
  getFounderName,
  getPulseStateLabel,
  getStatusPulses,
} from "@/lib/i18n/data";
import type { StatusPulse } from "@/lib/mock/command-center";
import { useLocale, useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function getGreeting(t: ReturnType<typeof useT>): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("common.greeting.morning");
  if (hour < 18) return t("common.greeting.afternoon");
  return t("common.greeting.evening");
}

function PulseItem({
  pulse,
  stateLabel,
}: {
  pulse: StatusPulse;
  stateLabel: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-label">{pulse.label}</p>
      <p className="font-display text-4xl font-medium tracking-tight text-foreground">
        {pulse.value}
      </p>
      <p className="text-base leading-relaxed text-muted-foreground">
        {pulse.detail}
      </p>
      <div className="flex items-center gap-2 pt-1">
        <span
          className={cn(
            "size-2 rounded-full",
            pulse.state === "nominal" && "status-live",
            pulse.state === "attention" && "status-attention",
            pulse.state === "critical" && "status-critical",
          )}
        />
        <span className="text-sm text-muted-foreground">{stateLabel}</span>
      </div>
    </div>
  );
}

export function CommandHero() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const pulses = getStatusPulses(locale);
  const founderName = getFounderName(locale);

  return (
    <header className="space-y-16">
      <div className="space-y-6">
        <p className="text-lg text-muted-foreground">
          {getGreeting(t)}, {founderName}.
        </p>
        <h1 className="text-display-xl max-w-4xl text-foreground">
          {t("dashboard.hero.operatingNormally", {
            workspace: workspace.name,
          })}
        </h1>
      </div>

      <div className="grid gap-12 border-y border-border py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-16">
        {pulses.map((pulse) => (
          <PulseItem
            key={pulse.id}
            pulse={pulse}
            stateLabel={getPulseStateLabel(locale, pulse.state)}
          />
        ))}
      </div>
    </header>
  );
}
