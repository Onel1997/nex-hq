"use client";

import { useLocale, useDictionary } from "@/lib/i18n";
import { getQuickMissions } from "@/lib/i18n/data/research-studio";
import { cn } from "@/lib/utils";

interface ResearchStudioMissionsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function ResearchStudioMissions({
  onSelect,
  disabled = false,
}: ResearchStudioMissionsProps) {
  const locale = useLocale();
  const { research } = useDictionary();
  const missions = getQuickMissions(locale);

  return (
    <section className="rs3-missions" aria-label={research.studio.missions.ariaLabel}>
      <div className="rs3-missions-header">
        <h2 className="rs3-missions-title">{research.studio.missions.title}</h2>
        <p className="rs3-missions-subtitle">{research.studio.missions.subtitle}</p>
      </div>

      <div className="rs3-missions-grid">
        {missions.map((mission) => {
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
