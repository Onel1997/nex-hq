"use client";

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
  return (
    <div className="rs3-hero">
      <div className="rs3-hero-intro">
        <p className="rs3-hero-eyebrow">AI Fashion Intelligence Command Center</p>
        <h1 className="rs3-hero-headline">What should we discover today?</h1>
        <p className="rs3-hero-subline">
          The creative brain of Milaene — connected to the world&apos;s fashion
          data.
        </p>
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
