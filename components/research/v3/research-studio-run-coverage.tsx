"use client";

import type { ProviderSnapshot } from "./data-source-types";
import { useDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type RunSourceMode = "live" | "simulated" | "offline";

export function resolveRunSourceMode(provider: ProviderSnapshot): RunSourceMode {
  if (provider.status === "connected" && provider.mode === "live") {
    return "live";
  }
  if (provider.mode === "simulated" && provider.status !== "disconnected") {
    return "simulated";
  }
  return "offline";
}

function modeClass(mode: RunSourceMode): string {
  switch (mode) {
    case "live":
      return "rs3-run-coverage-live";
    case "simulated":
      return "rs3-run-coverage-sim";
    case "offline":
      return "rs3-run-coverage-offline";
  }
}

interface ResearchStudioRunCoverageProps {
  providers: ProviderSnapshot[];
}

export function ResearchStudioRunCoverage({
  providers,
}: ResearchStudioRunCoverageProps) {
  const { research } = useDictionary();
  const coverage = research.studio.coverage;

  if (providers.length === 0) return null;

  const counts = providers.reduce(
    (acc, provider) => {
      const mode = resolveRunSourceMode(provider);
      acc[mode] += 1;
      return acc;
    },
    { live: 0, simulated: 0, offline: 0 },
  );

  const modeLabel = (mode: RunSourceMode): string => {
    switch (mode) {
      case "live":
        return coverage.liveMode;
      case "simulated":
        return coverage.simulatedMode;
      case "offline":
        return coverage.offlineMode;
    }
  };

  return (
    <section className="rs3-run-coverage" aria-label={coverage.ariaLabel}>
      <header className="rs3-run-coverage-head">
        <h3>{coverage.title}</h3>
        <div className="rs3-run-coverage-summary">
          <span className="rs3-run-coverage-live">
            {coverage.summaryLive.replace("{count}", String(counts.live))}
          </span>
          <span className="rs3-run-coverage-sim">
            {coverage.summarySim.replace("{count}", String(counts.simulated))}
          </span>
          <span className="rs3-run-coverage-offline">
            {coverage.summaryOffline.replace("{count}", String(counts.offline))}
          </span>
        </div>
      </header>
      <div className="rs3-run-coverage-grid">
        {providers.map((provider) => {
          const mode = resolveRunSourceMode(provider);
          return (
            <article key={provider.id} className="rs3-run-coverage-card">
              <span className="rs3-run-coverage-name">{provider.name}</span>
              <span className={cn("rs3-run-coverage-mode", modeClass(mode))}>
                {modeLabel(mode)}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
