"use client";

import type { ProviderSnapshot } from "./data-source-types";
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

function modeLabel(mode: RunSourceMode): string {
  switch (mode) {
    case "live":
      return "Live";
    case "simulated":
      return "Simulated";
    case "offline":
      return "Offline";
  }
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
  if (providers.length === 0) return null;

  const counts = providers.reduce(
    (acc, provider) => {
      const mode = resolveRunSourceMode(provider);
      acc[mode] += 1;
      return acc;
    },
    { live: 0, simulated: 0, offline: 0 },
  );

  return (
    <section className="rs3-run-coverage" aria-label="Source coverage for this run">
      <header className="rs3-run-coverage-head">
        <h3>Run Source Coverage</h3>
        <div className="rs3-run-coverage-summary">
          <span className="rs3-run-coverage-live">{counts.live} live</span>
          <span className="rs3-run-coverage-sim">{counts.simulated} simulated</span>
          <span className="rs3-run-coverage-offline">{counts.offline} offline</span>
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
