import {
  creativeStudioPersistedStateSchema,
  type CreativeRun,
  type CreativeStudioPersistedState,
  type SavedCreativePrompt,
} from "@/lib/creative-studio/contracts";

export const CREATIVE_STUDIO_STORAGE_KEY = "nexhq-creative-studio-v1";
const MAX_RUNS = 60;

export type CreativeStorage = Pick<Storage, "getItem" | "setItem">;

export const EMPTY_CREATIVE_STUDIO_STATE: CreativeStudioPersistedState =
  Object.freeze({ version: 1, prompts: [], runs: [] });

export function loadCreativeStudioState(
  storage: CreativeStorage,
): CreativeStudioPersistedState {
  try {
    const raw = storage.getItem(CREATIVE_STUDIO_STORAGE_KEY);
    if (!raw) return { version: 1, prompts: [], runs: [] };
    const parsed = creativeStudioPersistedStateSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? parsed.data
      : { version: 1, prompts: [], runs: [] };
  } catch {
    return { version: 1, prompts: [], runs: [] };
  }
}

export function saveCreativeStudioState(
  storage: CreativeStorage,
  state: CreativeStudioPersistedState,
): CreativeStudioPersistedState {
  const normalized = creativeStudioPersistedStateSchema.parse({
    ...state,
    runs: [...state.runs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_RUNS),
  });
  storage.setItem(CREATIVE_STUDIO_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertCreativePrompt(
  state: CreativeStudioPersistedState,
  prompt: SavedCreativePrompt,
): CreativeStudioPersistedState {
  return {
    ...state,
    prompts: [prompt, ...state.prompts.filter((item) => item.id !== prompt.id)],
  };
}

export function removeCreativePrompt(
  state: CreativeStudioPersistedState,
  promptId: string,
): CreativeStudioPersistedState {
  return {
    ...state,
    prompts: state.prompts.filter((prompt) => prompt.id !== promptId),
  };
}

export function upsertCreativeRun(
  state: CreativeStudioPersistedState,
  run: CreativeRun,
): CreativeStudioPersistedState {
  return {
    ...state,
    runs: [run, ...state.runs.filter((item) => item.id !== run.id)].slice(
      0,
      MAX_RUNS,
    ),
  };
}
