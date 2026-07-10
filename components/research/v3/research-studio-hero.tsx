"use client";

import { useDictionary } from "@/lib/i18n";
import { ResearchStudioCommandInput } from "./research-studio-command-input";
import { ResearchStudioMissions } from "./research-studio-missions";

interface ResearchStudioHeroProps {
  request: string;
  onRequestChange: (value: string) => void;
  onSelectMission: (prompt: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function ResearchStudioHero({
  request,
  onRequestChange,
  onSelectMission,
  onSubmit,
  disabled = false,
}: ResearchStudioHeroProps) {
  const { research } = useDictionary();
  const hero = research.studio.hero;

  return (
    <div className="rs3-hero">
      <div className="rs3-hero-intro">
        <p className="rs3-hero-eyebrow">{hero.eyebrow}</p>
        <h1 className="rs3-hero-headline">{hero.headline}</h1>
        <p className="rs3-hero-subline">{hero.subline}</p>
      </div>

      <ResearchStudioCommandInput
        value={request}
        onChange={onRequestChange}
        onSubmit={onSubmit}
        disabled={disabled}
      />

      <ResearchStudioMissions onSelect={onSelectMission} disabled={disabled} />
    </div>
  );
}
