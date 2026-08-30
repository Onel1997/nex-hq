import {
  ugcVideoPersistedStateSchema,
  type SavedUgcVideoPrompt,
  type UgcVideoPersistedState,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";

export const UGC_VIDEO_STORAGE_KEY = "nexhq:ugc-video-studio:v1";
const MAX_RUNS = 40;

export type UgcVideoStorage = Pick<Storage, "getItem" | "setItem">;

export function loadUgcVideoState(
  storage: UgcVideoStorage,
): UgcVideoPersistedState {
  try {
    const raw = storage.getItem(UGC_VIDEO_STORAGE_KEY);
    if (!raw) return { version: 1, prompts: [], runs: [] };
    const parsed = ugcVideoPersistedStateSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? parsed.data
      : { version: 1, prompts: [], runs: [] };
  } catch {
    return { version: 1, prompts: [], runs: [] };
  }
}

export function saveUgcVideoState(
  storage: UgcVideoStorage,
  state: UgcVideoPersistedState,
): UgcVideoPersistedState {
  const normalized = ugcVideoPersistedStateSchema.parse({
    ...state,
    runs: [...state.runs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_RUNS),
  });
  storage.setItem(UGC_VIDEO_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertUgcVideoPrompt(
  state: UgcVideoPersistedState,
  prompt: SavedUgcVideoPrompt,
): UgcVideoPersistedState {
  return {
    ...state,
    prompts: [prompt, ...state.prompts.filter((item) => item.id !== prompt.id)],
  };
}

export function removeUgcVideoPrompt(
  state: UgcVideoPersistedState,
  promptId: string,
): UgcVideoPersistedState {
  return {
    ...state,
    prompts: state.prompts.filter((prompt) => prompt.id !== promptId),
  };
}

export function upsertUgcVideoRun(
  state: UgcVideoPersistedState,
  run: UgcVideoRun,
): UgcVideoPersistedState {
  return {
    ...state,
    runs: [run, ...state.runs.filter((item) => item.id !== run.id)].slice(
      0,
      MAX_RUNS,
    ),
  };
}
