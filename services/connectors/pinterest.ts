import {
  fetchLivePinterest,
  isPinterestLiveConfigured,
} from "./clients/pinterest-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface PinterestBoard {
  name: string;
  aesthetic: string;
  colors: string[];
  saves: number;
  trend: "rising" | "stable" | "declining";
}

export interface PinterestIntelligenceData {
  colorWorlds: string[];
  aesthetics: string[];
  outfitTrends: string[];
  capsuleTrends: string[];
  boards: PinterestBoard[];
}

export const EMPTY_PINTEREST_DATA: PinterestIntelligenceData = {
  colorWorlds: [],
  aesthetics: [],
  outfitTrends: [],
  capsuleTrends: [],
  boards: [],
};

function toSignals(data: PinterestIntelligenceData): IntelligenceSignal[] {
  const boardSignals = data.boards.map((board) => ({
    id: `pin-${board.name.replace(/\s+/g, "-").slice(0, 30)}`,
    category: "social" as const,
    source: "pinterest" as const,
    label: board.name,
    message: `${board.aesthetic}: ${board.colors.join(", ")} · ${board.saves.toLocaleString("de-DE")} followers`,
    score: Math.min(100, Math.round(board.saves / 150)),
    direction: board.trend === "declining" ? ("down" as const) : ("up" as const),
    tags: ["moodboard", board.aesthetic],
  }));

  const keywordSignals = data.outfitTrends.slice(0, 4).map((trend, index) => ({
    id: `pin-keyword-${index}`,
    category: "trend" as const,
    source: "pinterest" as const,
    label: "Trending Search",
    message: trend,
    score: 80 - index * 5,
    direction: "up" as const,
    tags: ["keyword", "fashion"],
  }));

  const capsuleSignals = data.capsuleTrends.slice(0, 2).map((capsule, index) => ({
    id: `pin-capsule-${index}`,
    category: "trend" as const,
    source: "pinterest" as const,
    label: "Capsule Trend",
    message: capsule,
    score: 75 + index * 5,
    direction: "up" as const,
    tags: ["capsule"],
  }));

  const colorSignals = data.colorWorlds.slice(0, 2).map((world, index) => ({
    id: `pin-color-${index}`,
    category: "trend" as const,
    source: "pinterest" as const,
    label: "Color World",
    message: world,
    score: 68 + index * 4,
    direction: "up" as const,
    tags: ["color", "aesthetic"],
  }));

  return [...boardSignals, ...keywordSignals, ...capsuleSignals, ...colorSignals];
}

function buildResult(
  data: PinterestIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<PinterestIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.boards.length + data.outfitTrends.length + data.colorWorlds.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.92 : 0.5,
    dataQuality: mode === "live" ? 0.9 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { social: 0.5, trend: 0.5 },
    confidence,
  );

  return {
    source: "pinterest",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan Pinterest for color worlds, aesthetics and capsule trends. */
export async function scanPinterest(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<PinterestIntelligenceData>> {
  if (isPinterestLiveConfigured()) {
    try {
      const data = await fetchLivePinterest();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Pinterest API failed (${error.message}) — no data fabricated`
          : "Pinterest API failed — no data fabricated";
      return buildResult(EMPTY_PINTEREST_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_PINTEREST_DATA,
    "simulated",
    "PINTEREST_ACCESS_TOKEN not set — no Pinterest data is returned without credentials",
  );
}
