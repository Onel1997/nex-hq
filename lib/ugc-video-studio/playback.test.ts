import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ugcPlaybackSource } from "@/components/ugc-video-studio/ugc-result-video";

test("completed UGC browser truth is the stable authenticated Xeriamo asset route", () => {
  const service = readFileSync("lib/ugc-video-studio/generation-service.ts", "utf8");
  assert.match(service, /return `\/api\/ugc-video-studio\/assets\/\$\{jobId\}\/\$\{resultId\}`/);
  assert.match(service, /downloadUrl: `\$\{publicUrl\}\?download=1`/);
  assert.doesNotMatch(service.slice(service.indexOf("function toPublicResultUrl"), service.indexOf("function isMp4")), /signed|provider|supabase/i);
});

test("playback source refresh is deterministic and never becomes a Generate request", () => {
  const stable = "/api/ugc-video-studio/assets/job/result";
  assert.equal(ugcPlaybackSource(stable, 0), stable);
  assert.equal(ugcPlaybackSource(stable, 1), `${stable}?playback=1`);
  assert.equal(ugcPlaybackSource(`${stable}?view=inline`, 2), `${stable}?view=inline&playback=2`);
  assert.doesNotMatch(ugcPlaybackSource(stable, 1), /generate|fal|credit|reservation/);
});

test("Safari resume observes an accepted job once and media errors get one safe source refresh", () => {
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const player = readFileSync("components/ugc-video-studio/ugc-result-video.tsx", "utf8");
  assert.match(workspace, /addEventListener\("visibilitychange", onResume\)/);
  assert.match(workspace, /addEventListener\("pageshow", onResume\)/);
  assert.match(workspace, /lastResumeObservationAt/);
  assert.match(player, /automaticRefreshUsedRef/);
  assert.match(player, /onError=\{\(\) => refresh\(true\)\}/);
  assert.match(player, /Video erneut laden/);
  assert.doesNotMatch(player, /submitUgcVideoGeneration|generateUgcVideoJob|reservation|\bfal\b/);
});
