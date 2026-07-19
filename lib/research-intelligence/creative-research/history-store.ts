/**
 * Creative Research history — reduce repetition across recent runs.
 * Client + server safe via localStorage when available; in-memory fallback for tests/SSR.
 */

import { normalizePhrase, isNearDuplicatePhrase } from "./phrase-quality";
import type { DesignIdea, VisualStructureId } from "./types";

export interface CreativeHistoryEntry {
  primaryPhrase: string;
  phraseKey: string;
  designTitle: string;
  visualStructure: VisualStructureId;
  emotionalTheme: string;
  typographyFamily: string;
  placement: string;
  graphicMotifs: string[];
  selected: boolean;
  createdAt: string;
}

const STORAGE_KEY = "nexhq-creative-research-history";
const MAX_ENTRIES = 80;

const memoryStore: CreativeHistoryEntry[] = [];

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadCreativeHistory(): CreativeHistoryEntry[] {
  if (!canUseStorage()) return [...memoryStore];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...memoryStore];
    const parsed = JSON.parse(raw) as CreativeHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [...memoryStore];
  } catch {
    return [...memoryStore];
  }
}

export function saveCreativeHistory(entries: CreativeHistoryEntry[]): void {
  const next = entries.slice(0, MAX_ENTRIES);
  memoryStore.splice(0, memoryStore.length, ...next);
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function recordCreativeRunIdeas(
  ideas: DesignIdea[],
  options: { selectedIdeaId?: string | null } = {},
): void {
  const previous = loadCreativeHistory();
  const incoming: CreativeHistoryEntry[] = ideas.map((idea) => ({
    primaryPhrase: idea.primaryPhrase,
    phraseKey: normalizePhrase(idea.primaryPhrase),
    designTitle: idea.designTitle,
    visualStructure: idea.visualStructure,
    emotionalTheme: idea.emotionalTheme,
    typographyFamily: idea.typographyFamily,
    placement: idea.placement,
    graphicMotifs: idea.graphicElements.slice(0, 4),
    selected: idea.id === options.selectedIdeaId || idea.status === "selected",
    createdAt: idea.createdAt,
  }));
  saveCreativeHistory([...incoming, ...previous].slice(0, MAX_ENTRIES));
}

export function recentPhraseKeys(limit = 40): string[] {
  return loadCreativeHistory()
    .slice(0, limit)
    .map((entry) => entry.phraseKey);
}

export function recentPhrases(limit = 40): string[] {
  return loadCreativeHistory()
    .slice(0, limit)
    .map((entry) => entry.primaryPhrase);
}

export function recentStructures(limit = 24): VisualStructureId[] {
  return loadCreativeHistory()
    .slice(0, limit)
    .map((entry) => entry.visualStructure);
}

export function isExcludedByHistory(
  idea: Pick<DesignIdea, "primaryPhrase" | "visualStructure" | "emotionalTheme" | "designConcept">,
  history: CreativeHistoryEntry[] = loadCreativeHistory(),
): boolean {
  for (const entry of history.slice(0, 40)) {
    if (isNearDuplicatePhrase(idea.primaryPhrase, entry.primaryPhrase, 0.5)) {
      return true;
    }
    if (
      idea.visualStructure === entry.visualStructure &&
      idea.emotionalTheme.toLowerCase() === entry.emotionalTheme.toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}

/** Test helper — clear in-memory + storage history. */
export function clearCreativeHistoryForTests(): void {
  memoryStore.splice(0, memoryStore.length);
  if (canUseStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
