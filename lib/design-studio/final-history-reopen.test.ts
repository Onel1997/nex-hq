import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DESIGN_STUDIO_CONTRACT_VERSION,
  type DesignRun,
} from "./contracts";
import { isSuccessfulDesignRun } from "./persistent-results";

function run(status: DesignRun["status"], resultCount: number): DesignRun {
  return {
    id: "00000000-0000-4000-8000-000000000041",
    createdAt: "2026-08-31T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
    status,
    setup: {
      contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
      prompt: "Restore this design",
      stylePreset: "EDITORIAL",
      model: "RECRAFT_4",
      outputMode: "RASTER",
      aspectRatio: "4:5",
      quality: "STANDARD",
      resolution: "2K",
      count: 1,
      reference: null,
    },
    results: resultCount ? [{
      id: "00000000-0000-4000-8000-000000000042",
      url: "/result",
      downloadUrl: "/result?download=1",
      mimeType: "image/png",
      width: 2048,
      height: 2048,
      resolution: "2K",
      favorite: false,
      libraryAssetId: "00000000-0000-4000-8000-000000000043",
      creationId: null,
    }] : [],
    message: resultCount ? null : "Design konnte nicht erstellt werden.",
  };
}

test("HTTP completion is not product success without a persisted result", () => {
  assert.equal(isSuccessfulDesignRun(run("SUCCEEDED", 0)), false);
  assert.equal(isSuccessfulDesignRun(run("PARTIALLY_SUCCEEDED", 0)), false);
  assert.equal(isSuccessfulDesignRun(run("FAILED", 0)), false);
  assert.equal(isSuccessfulDesignRun(run("SUCCEEDED", 1)), true);
});

test("History restoration uses clear wording, restores setup and never submits", async () => {
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /Prompt wiederverwenden/);
  assert.doesNotMatch(ui, /Prompt und Einstellungen wurden wiederhergestellt/);
  assert.match(ui, /Weiter bearbeiten/);
  assert.match(ui, /Design-Einstellungen wiederhergestellt\./);
  assert.match(ui, /function restoreRunSetup[\s\S]*setSetup\(\{[\s\S]*\.\.\.item\.setup[\s\S]*setTab\("CREATE"\)/);
  const start = ui.indexOf("function restoreRunSetup");
  const end = ui.indexOf("function historyStatus", start);
  const restoreBody = ui.slice(start, end);
  assert.doesNotMatch(restoreBody, /submitDesignGeneration|reserveCustomerGeneration|generate\(\)/);
  assert.match(restoreBody, /model === "IDEOGRAM_4"/);
  assert.match(restoreBody, /reference: null/);
});

test("known Recraft capacity is explicit and offers only manual continuation", async () => {
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  assert.match(ui, /failureCode === "PROVIDER_CAPACITY"/);
  assert.match(ui, /Recraft ausgelastet/);
  assert.match(ui, /Bitte versuche es später erneut oder nutze Ideogram 4\./);
  assert.match(ui, /restoreRunSetup\(item, "IDEOGRAM_4"\)/);
  assert.doesNotMatch(ui, /restoreRunSetup\([^)]*\)[\s\S]{0,80}submitDesignGeneration/);
});

test("reopened and uploaded references render a real account-private preview", async () => {
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const contentRoute = await readFile(new URL("../../app/api/xeriano/library/[assetId]/content/route.ts", import.meta.url), "utf8");
  assert.match(ui, /setReferencePreview\(\{[\s\S]*url: assetContentUrl\(asset\)[\s\S]*title: asset\.title[\s\S]*width: asset\.width[\s\S]*mimeType: asset\.mimeType/);
  assert.match(ui, /xd-reference-artwork[\s\S]*<img src=\{referencePreview\.url\}/);
  assert.match(ui, /referencePreview\.transparentSurface \? " xeriamo-transparency-preview"/);
  assert.match(ui, /URL\.createObjectURL\(file\)/);
  assert.match(ui, /URL\.revokeObjectURL\(referencePreview\.url\)/);
  assert.match(ui, /Referenz ändern/);
  assert.match(ui, /Referenz entfernen/);
  assert.match(contentRoute, /requireXerianoAccount\(\)/);
  assert.match(contentRoute, /\.eq\("id", assetId\)\.eq\("account_id", context\.accountId\)/);
  assert.match(contentRoute, /Content-Security-Policy/);
  assert.match(contentRoute, /rasterizePrivateSvg/);
  assert.doesNotMatch(ui, /storage_path|storage_bucket|createSignedUrl/);
});

test("reference preview remains bounded and touch-safe on iPhone widths", async () => {
  const css = await readFile(new URL("../../app/xeriano.css", import.meta.url), "utf8");
  assert.match(css, /\.xd-reference-card\{[^}]*grid-template-columns:minmax\(180px,240px\) minmax\(0,1fr\)/);
  assert.match(css, /\.xd-reference-artwork\{[^}]*overflow:hidden/);
  assert.match(css, /\.xd-reference-details>button\{[^}]*min-height:44px/);
  assert.match(css, /@media\(max-width:560px\)\{[\s\S]*?\.xd-reference-card\{grid-template-columns:1fr/);
  assert.match(css, /\.xd-remove-reference\{[^}]*min-height:44px/);
  assert.match(css, /\.xeriamo-transparency-preview\{[^}]*background-image:/);
});
