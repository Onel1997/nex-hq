"use client";

import type { QuickMission } from "./missions";
import { cn } from "@/lib/utils";

interface ResearchStudioMissionsProps {
  missions: QuickMission[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function ResearchStudioMissions({
  missions,
  onSelect,
  disabled = false,
}: ResearchStudioMissionsProps) {
  return (
    <div className="research-studio-missions">
      <p className="research-studio-missions-label">Quick missions</p>
      <div className="research-studio-missions-grid">
        {missions.map((mission) => (
          <button
            key={mission.id}
            type="button"
            disabled={disabled}
            className={cn(
              "research-studio-mission-card",
              disabled && "research-studio-mission-card-disabled",
            )}
            onClick={() => onSelect(mission.prompt)}
          >
            <span className="research-studio-mission-category">
              {mission.category}
            </span>
            <span className="research-studio-mission-label">{mission.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
