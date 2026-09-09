import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DESIGN_STUDIO_CONTRACT_VERSION,
  type DesignRun,
} from "./contracts";
import { latestDesignRun, mergeObservedDesignRun } from "./persistent-results";

function designRun(status: DesignRun["status"], results = 0): DesignRun {
  return {
    id: "00000000-0000-4000-8000-000000000901",
    createdAt: "2026-09-09T08:00:00.000Z",
    updatedAt: "2026-09-09T08:01:00.000Z",
    status,
    setup: {
      contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
      prompt: "Create a durable fashion design",
      stylePreset: "NONE",
      model: "IDEOGRAM_4",
      outputMode: "RASTER",
      aspectRatio: "1:1",
      quality: "STANDARD",
      resolution: "2K",
      count: 1,
      reference: null,
    },
    results: results ? [{
      id: "00000000-0000-4000-8000-000000000902",
      url: "/api/design-studio/assets/job/result",
      downloadUrl: "/api/design-studio/assets/job/result?download=1",
      mimeType: "image/png",
      width: 2048,
      height: 2048,
      resolution: "2K",
      favorite: false,
      libraryAssetId: "00000000-0000-4000-8000-000000000903",
      creationId: null,
    }] : [],
    message: status === "RUNNING" ? "Design wird erstellt …" : null,
  };
}

test("Create restoration selects the latest job, including an in-flight job", () => {
  const running = designRun("RUNNING");
  const completed = { ...designRun("SUCCEEDED", 1), id: "00000000-0000-4000-8000-000000000904" };
  assert.equal(latestDesignRun([running, completed])?.id, running.id);
});

test("a delayed observation cannot downgrade a successful Design result", () => {
  const succeeded = designRun("SUCCEEDED", 1);
  const stale = { ...designRun("RUNNING"), updatedAt: "2026-09-09T07:59:00.000Z" };
  assert.deepEqual(mergeObservedDesignRun(succeeded, stale), succeeded);
});

test("Design Create reobserves one existing job on mount, Safari resume and tab return", () => {
  const workspace = readFileSync("components/xeriano/customer-design-studio.tsx", "utf8");
  assert.match(workspace, /localStorage\.setItem\(ACTIVE_JOB_KEY, recovered\.id\)/);
  assert.doesNotMatch(workspace, /localStorage\.removeItem\(ACTIVE_JOB_KEY\)/);
  assert.match(workspace, /addEventListener\("visibilitychange", observeOnResume\)/);
  assert.match(workspace, /addEventListener\("pageshow", observeOnResume\)/);
  assert.match(workspace, /tab === "CREATE" && activeRunId/);
  assert.match(workspace, /jobObservationInFlight\.current/);
  const observerStart = workspace.indexOf("const observeDesignJob");
  const observerEnd = workspace.indexOf("useEffect(() => {", observerStart);
  const observer = workspace.slice(observerStart, observerEnd);
  assert.match(observer, /fetchDesignJob\(jobId\)/);
  assert.doesNotMatch(observer, /submitDesignGeneration|generate\(\)|fetchDesignQuote/);
});

test("Design Create always renders the current-result area below the form", () => {
  const workspace = readFileSync("components/xeriano/customer-design-studio.tsx", "utf8");
  assert.match(workspace, /Dein aktueller oder zuletzt gestarteter Auftrag bleibt hier/);
  assert.match(workspace, /Hier erscheint dein aktueller Auftrag und anschließend das dauerhaft gespeicherte Ergebnis/);
  assert.doesNotMatch(workspace, /\{visibleResults\.length \|\| run \? <section className="xd-results"/);
});
