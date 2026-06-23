import "server-only";

import type { ResearchBrainSnapshot } from "@/lib/research/research-brain-intelligence";
import { loadResearchIntelligence } from "@/services/researchEngine";
import { MILAENE_DNA } from "@/services/milaene-dna";

export type {
  ResearchBrainSnapshot,
  ResearchBrandBrain,
  ResearchMarketBrain,
  ResearchCompetitorBrain,
  ResearchProductBrain,
  ResearchPodBrain,
  ResearchKnowledgeBrain,
  ResearchOpportunity,
  AiRecommendation,
  TrendScore,
  LiveSignal,
  MarketSignalCard,
} from "@/lib/research/research-brain-intelligence";

export {
  loadResearchBrainIntelligence,
} from "@/lib/research/research-brain-intelligence";

/** Load raw intelligence bundle for agents and APIs. */
export async function loadResearchIntelligenceSnapshot() {
  return loadResearchIntelligence();
}

/** Milaene brand DNA constant for client-safe imports via API only. */
export { MILAENE_DNA };
