import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DESIGN_STUDIO_CONTRACT_VERSION, type DesignResult, type DesignRun } from "./contracts";
import { latestCompletedDesignRun, mergeDurableDesignResults } from "./persistent-results";
import { deriveDesignAssetCapabilities } from "../xeriano/library";

const result = (id: string, assetId = id): DesignResult => ({
  id, url: `/result/${id}`, downloadUrl: `/download/${id}`, mimeType: "image/png",
  width: 2048, height: 2048, resolution: "2K", favorite: false,
  libraryAssetId: assetId, creationId: null,
});

const run = (id: string, status: DesignRun["status"], results: DesignResult[]): DesignRun => ({
  id, createdAt: "2026-08-31T08:00:00.000Z", updatedAt: "2026-08-31T08:00:00.000Z",
  status, results, message: status === "FAILED" ? "Nicht abgeschlossen" : null,
  setup: {
    contractVersion: DESIGN_STUDIO_CONTRACT_VERSION, prompt: "Durable design",
    stylePreset: "NONE", model: "IDEOGRAM_4", outputMode: "RASTER",
    aspectRatio: "1:1", quality: "STANDARD", resolution: "2K", count: 1, reference: null,
  },
});

test("persistent result recovery skips failed jobs and deduplicates durable assets", () => {
  const failed = run("00000000-0000-4000-8000-000000000001", "FAILED", []);
  const completedResult = result("00000000-0000-4000-8000-000000000010");
  const completed = run("00000000-0000-4000-8000-000000000002", "SUCCEEDED", [completedResult]);
  assert.equal(latestCompletedDesignRun([failed, completed])?.id, completed.id);
  assert.equal(latestCompletedDesignRun([failed]), null);
  const derived = result("00000000-0000-4000-8000-000000000011");
  assert.deepEqual(mergeDurableDesignResults([derived, completedResult], [completedResult]), [derived, completedResult]);
});

test("server-derived design capabilities distinguish 2K, 4K, removed backgrounds and SVG", () => {
  const twoK = deriveDesignAssetCapabilities({ assetType: "DESIGN", mimeType: "image/png", width: 2048, height: 2048, operation: null });
  assert.deepEqual(twoK, { transparentPreview: false, canBackgroundRemove: true, canUpscale: true, canCreatePng: false });
  const fourK = deriveDesignAssetCapabilities({ assetType: "DESIGN", mimeType: "image/png", width: 4096, height: 4096, operation: null });
  assert.equal(fourK?.canUpscale, false);
  const transparent = deriveDesignAssetCapabilities({ assetType: "DESIGN", mimeType: "image/png", width: 2048, height: 2048, operation: "BACKGROUND_REMOVE" });
  assert.equal(transparent?.transparentPreview, true);
  assert.equal(transparent?.canBackgroundRemove, false);
  const svg = deriveDesignAssetCapabilities({ assetType: "DESIGN", mimeType: "image/svg+xml", width: null, height: null, operation: null });
  assert.equal(svg?.canBackgroundRemove, false);
  assert.equal(svg?.canUpscale, false);
  assert.equal(svg?.canCreatePng, true);
});

test("durable Library actions reopen the correct shell and never auto-generate", async () => {
  const designUi = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const globalLibrary = await readFile(new URL("../../components/xeriano/library-grid.tsx", import.meta.url), "utf8");
  for (const label of [
    "Im Design Studio bearbeiten", "Variation erstellen", "Hintergrund entfernen",
    "Auf 4K upscalen", "Im Creative Studio verwenden", "Details bearbeiten", "Favorit",
  ]) assert.match(designUi, new RegExp(label));
  assert.match(globalLibrary, /studioRoot[\s\S]*design-studio\?asset=/);
  assert.match(globalLibrary, /audience === "OWNER" \? "\/hq" : "\/app"/);
  assert.doesNotMatch(globalLibrary, /submitDesignGeneration/);
  assert.match(designUi, /mode === "variation" \? "VARIATION" : "EDIT"/);
  assert.match(designUi, /designGenerationSetupSchema\.safeParse\(asset\.design\?\.setup\)/);
});

test("derived utilities reuse financial authority and immediately project their asset", async () => {
  const designUi = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const utilityRoute = await readFile(new URL("../../app/api/design-studio/utility/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("./utility-service.ts", import.meta.url), "utf8");
  assert.match(designUi, /setDerivedResults/);
  assert.match(designUi, /Hintergrund entfernt/);
  assert.match(designUi, /4K-Version erstellt/);
  assert.match(designUi, /scrollIntoView/);
  assert.ok(utilityRoute.indexOf("if (customer) authority = await reserveCustomerGeneration")
    < utilityRoute.indexOf("const execution = await executeDesignUtility"));
  assert.match(utilityRoute, /authorization\.bypass === null/);
  assert.match(service, /BACKGROUND_ALREADY_REMOVED/);
  assert.match(service, /\.eq\("id", assetId\)\.eq\("account_id", context\.accountId\)/);
});

test("transparent previews are presentation-only and mobile menus stay bounded", async () => {
  const css = await readFile(new URL("../../app/xeriano.css", import.meta.url), "utf8");
  const projection = await readFile(new URL("./projection.ts", import.meta.url), "utf8");
  assert.match(css, /\.xeriamo-transparency-preview\{[^}]*background-image:/);
  assert.match(css, /\.xeriano-library-actions>div\{[^}]*max-height:[^}]*overflow-y:auto/);
  assert.match(css, /width:min\(310px,calc\(100vw - 48px\)\)/);
  assert.match(projection, /mime_type: "image\/png"/);
  assert.doesNotMatch(projection, /background(?:Color|_color).*white/i);
});
