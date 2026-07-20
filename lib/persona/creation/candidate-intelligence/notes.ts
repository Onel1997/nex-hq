/**
 * Versioned candidate notes — stored in generation_settings (no schema migration).
 * user_notes remains the latest snapshot for API compatibility.
 */

export interface CandidateNoteRevision {
  version: number;
  note: string;
  author: string;
  timestamp: string;
}

export const NOTES_HISTORY_KEY = "notes_history" as const;

export function readNotesHistory(
  settings: Record<string, unknown> | null | undefined,
): CandidateNoteRevision[] {
  const raw = settings?.[NOTES_HISTORY_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.note !== "string") return null;
      return {
        version: typeof row.version === "number" ? row.version : 0,
        note: row.note,
        author: typeof row.author === "string" ? row.author : "unknown",
        timestamp:
          typeof row.timestamp === "string"
            ? row.timestamp
            : new Date().toISOString(),
      } satisfies CandidateNoteRevision;
    })
    .filter((x): x is CandidateNoteRevision => x != null)
    .sort((a, b) => a.version - b.version);
}

/**
 * Append a note revision when the text changes.
 * Returns null if unchanged (no new version).
 */
export function appendCandidateNoteRevision(params: {
  settings: Record<string, unknown>;
  previousNote: string;
  nextNote: string;
  author: string;
  now?: string;
}): {
  settings: Record<string, unknown>;
  revision: CandidateNoteRevision;
} | null {
  const next = params.nextNote.trim();
  const prev = params.previousNote.trim();
  if (next === prev) return null;

  const history = readNotesHistory(params.settings);
  const version = (history[history.length - 1]?.version ?? 0) + 1;
  const revision: CandidateNoteRevision = {
    version,
    note: next,
    author: params.author || "user",
    timestamp: params.now ?? new Date().toISOString(),
  };

  return {
    settings: {
      ...params.settings,
      [NOTES_HISTORY_KEY]: [...history, revision],
    },
    revision,
  };
}
