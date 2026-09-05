import assert from "node:assert/strict";
import test from "node:test";

import type { VideoEditorClip } from "./contracts";
import {
  buildVideoEditorRenderSegments,
  clampVideoEditorTrim,
  composeVideoEditorSuggestion,
  moveVideoEditorClip,
  selectedVideoEditorDuration,
} from "./project";

function clip(index: number, duration = 6): VideoEditorClip {
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    source: { kind: "TEMP_REFERENCE", id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` },
    title: `Clip ${index + 1}`,
    order: index,
    enabled: true,
    trimStartSeconds: 0,
    trimEndSeconds: duration,
    sourceDurationSeconds: duration,
  };
}

test("clip order is stable and mobile up/down operations remain canonical", () => {
  const input = [clip(0), clip(1), clip(2)];
  const moved = moveVideoEditorClip(input, input[2]!.id, -1);
  assert.deepEqual(moved.map((item) => item.title), ["Clip 1", "Clip 3", "Clip 2"]);
  assert.deepEqual(moved.map((item) => item.order), [0, 1, 2]);
  assert.deepEqual(moveVideoEditorClip(moved, moved[0]!.id, -1), moved);
});

test("trim bounds remain inside source duration", () => {
  assert.deepEqual(clampVideoEditorTrim({ start: -4, end: 20, duration: 6 }), { start: 0, end: 6 });
  assert.deepEqual(clampVideoEditorTrim({ start: 5.9, end: 5.91, duration: 6 }), { start: 5.75, end: 6 });
});

test("automatic composition starts with strongest unique clip and never loops footage", () => {
  const clips = [clip(0, 5), clip(1, 5), clip(2, 5), clip(3, 5)];
  const result = composeVideoEditorSuggestion({
    clips,
    analyses: {
      [clips[0]!.id]: { trimStartSeconds: 0.5, trimEndSeconds: 4.5, qualityScore: 0.7, contentKey: "a", warnings: [] },
      [clips[1]!.id]: { trimStartSeconds: 0.5, trimEndSeconds: 4.5, qualityScore: 0.95, contentKey: "b", warnings: [] },
      [clips[2]!.id]: { trimStartSeconds: 0.5, trimEndSeconds: 4.5, qualityScore: 0.9, contentKey: "b", warnings: [] },
      [clips[3]!.id]: { trimStartSeconds: 0.5, trimEndSeconds: 4.5, qualityScore: 0.8, contentKey: "d", warnings: [] },
    },
    targetDurationSeconds: 15,
    tempo: "CALM",
  });
  const active = result.clips.filter((item) => item.enabled);
  assert.equal(active[0]?.id, clips[1]?.id);
  assert.equal(active.some((item) => item.id === clips[2]?.id), false, "exact duplicate content is not repeated");
  assert.equal(new Set(active.map((item) => item.id)).size, active.length, "no artificial loop duplicates a clip");
  assert.equal(result.durationSeconds, 12);
  assert.equal(result.shortfallSeconds, 3);
});

test("target duration truncates the final segment without looping and disabled clips stay excluded", () => {
  const clips = [clip(0, 10), { ...clip(1, 10), enabled: false }, clip(2, 10)];
  const segments = buildVideoEditorRenderSegments(clips, 15);
  assert.deepEqual(segments.map((item) => item.renderDurationSeconds), [10, 5]);
  assert.deepEqual(segments.map((item) => item.id), [clips[0]!.id, clips[2]!.id]);
  assert.equal(selectedVideoEditorDuration(clips), 20);
});

