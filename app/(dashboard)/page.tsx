import { AiCommandInterface } from "@/components/dashboard/ai-command-interface";
import { AiTeamLive } from "@/components/dashboard/ai-team-live";
import { BrainVisualization } from "@/components/dashboard/brain-visualization";
import { CommandHero } from "@/components/dashboard/command-hero";
import { IntelligenceFeed } from "@/components/dashboard/intelligence-feed";
import { CommandSurface } from "@/components/shared/command-surface";

export default function DashboardPage() {
  return (
    <CommandSurface variant="hq">
      <CommandHero />
      <AiCommandInterface />
      <AiTeamLive />
      <IntelligenceFeed />
      <BrainVisualization />
    </CommandSurface>
  );
}
