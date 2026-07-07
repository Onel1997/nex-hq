"use client";

import { QUICK_MISSIONS } from "./missions";
import { cn } from "@/lib/utils";

interface ResearchStudioMissionsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function ResearchStudioMissions({
  onSelect,
  disabled = false,
}: ResearchStudioMissionsProps) {
  return (
    <section className="rs3-missions" aria-label="Quick missions">
      <div className="rs3-missions-header">
        <h2 className="rs3-missions-title">Quick Missions</h2>
        <p className="rs3-missions-subtitle">
          One tap to prefill your research command
        </p>
      </div>

      <div className="rs3-missions-grid">
        {QUICK_MISSIONS.map((mission) => {
          const Icon = mission.icon;
          return (
            <button
              key={mission.id}
              type="button"
              className={cn("rs3-mission-card", `rs3-mission-accent-${mission.accent}`)}
              onClick={() => onSelect(mission.prompt)}
              disabled={disabled}
            >
              <span className="rs3-mission-card-glow" />
              <span className="rs3-mission-icon-wrap">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="rs3-mission-label">{mission.label}</span>
              <span className="rs3-mission-shine" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
