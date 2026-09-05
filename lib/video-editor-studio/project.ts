import type { VideoEditorClip, VideoEditorTempo } from "./contracts";

export type VideoEditorAnalysisSuggestion = {
  trimStartSeconds: number;
  trimEndSeconds: number;
  qualityScore: number;
  contentKey: string;
  warnings: string[];
};

export function clampVideoEditorTrim(input: {
  start: number;
  end: number;
  duration: number;
}) {
  const duration = Math.max(0.25, input.duration);
  const start = Math.min(Math.max(0, input.start), Math.max(0, duration - 0.25));
  const end = Math.min(duration, Math.max(start + 0.25, input.end));
  return { start, end };
}

export function moveVideoEditorClip<T extends { id: string; order: number }>(
  clips: T[],
  clipId: string,
  direction: -1 | 1,
): T[] {
  const ordered = [...clips].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((clip) => clip.id === clipId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
  return ordered.map((clip, order) => ({ ...clip, order }));
}

export function selectedVideoEditorDuration(clips: VideoEditorClip[]) {
  return clips
    .filter((clip) => clip.enabled)
    .reduce((total, clip) => total + Math.max(0, clip.trimEndSeconds - clip.trimStartSeconds), 0);
}

const TEMPO_SECONDS: Record<VideoEditorTempo, number> = {
  CALM: 4,
  DYNAMIC: 3,
  FAST: 2,
};

/**
 * Produces a deterministic cut plan. It never loops clips, and exact duplicate
 * content keys are used at most once. The user can change every suggestion.
 */
export function composeVideoEditorSuggestion(input: {
  clips: VideoEditorClip[];
  analyses: Record<string, VideoEditorAnalysisSuggestion | undefined>;
  targetDurationSeconds: number;
  tempo: VideoEditorTempo;
}): { clips: VideoEditorClip[]; durationSeconds: number; shortfallSeconds: number } {
  const seenContent = new Set<string>();
  const candidates = input.clips
    .map((clip) => ({ clip, analysis: input.analyses[clip.id] }))
    .filter(({ clip, analysis }) => {
      if (!clip.enabled) return false;
      if (!analysis?.contentKey) return true;
      if (seenContent.has(analysis.contentKey)) return false;
      seenContent.add(analysis.contentKey);
      return true;
    })
    .sort((left, right) => {
      const score = (right.analysis?.qualityScore ?? 0.5) - (left.analysis?.qualityScore ?? 0.5);
      return score || left.clip.order - right.clip.order;
    });

  let remaining = input.targetDurationSeconds;
  const desired = TEMPO_SECONDS[input.tempo];
  const selected = new Map<string, { start: number; end: number; order: number }>();
  for (const [order, { clip, analysis }] of candidates.entries()) {
    if (remaining < 0.25) break;
    const suggestedStart = analysis?.trimStartSeconds ?? clip.trimStartSeconds;
    const suggestedEnd = analysis?.trimEndSeconds ?? clip.trimEndSeconds;
    const bounds = clampVideoEditorTrim({
      start: suggestedStart,
      end: Math.min(suggestedEnd, suggestedStart + desired, suggestedStart + remaining),
      duration: clip.sourceDurationSeconds,
    });
    const usable = Math.min(bounds.end - bounds.start, remaining);
    if (usable < 0.25) continue;
    selected.set(clip.id, { start: bounds.start, end: bounds.start + usable, order });
    remaining -= usable;
  }

  const arranged = input.clips
    .map((clip) => {
      const selection = selected.get(clip.id);
      return selection
        ? {
            ...clip,
            enabled: true,
            order: selection.order,
            trimStartSeconds: selection.start,
            trimEndSeconds: selection.end,
          }
        : { ...clip, enabled: false, order: candidates.length + clip.order };
    })
    .sort((a, b) => a.order - b.order)
    .map((clip, order) => ({ ...clip, order }));
  const durationSeconds = selectedVideoEditorDuration(arranged);
  return {
    clips: arranged,
    durationSeconds,
    shortfallSeconds: Math.max(0, input.targetDurationSeconds - durationSeconds),
  };
}

export function buildVideoEditorRenderSegments(
  clips: VideoEditorClip[],
  targetDurationSeconds: number,
) {
  let remaining = targetDurationSeconds;
  const segments: Array<VideoEditorClip & { renderDurationSeconds: number }> = [];
  for (const clip of [...clips].filter((entry) => entry.enabled).sort((a, b) => a.order - b.order)) {
    if (remaining < 0.25) break;
    const selected = Math.max(0, clip.trimEndSeconds - clip.trimStartSeconds);
    const renderDurationSeconds = Math.min(selected, remaining);
    if (renderDurationSeconds < 0.25) continue;
    segments.push({ ...clip, renderDurationSeconds });
    remaining -= renderDurationSeconds;
  }
  return segments;
}

