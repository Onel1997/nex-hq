import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  invalidateCachedOwnerData,
  loadCachedOwnerData,
  resetCachedOwnerDataForTests,
} from "@/lib/image/client-owner-data-cache";
import { immediateContentPlanningAssets } from "@/lib/image/immediate-content-plan";
import { CONTENT_PACKS } from "@/lib/image/content-packs";

test("independent owner-data requests share in-flight work without a serial waterfall", async () => {
  resetCachedOwnerDataForTests();
  let productLoads = 0;
  let personaLoads = 0;
  const started = Date.now();
  const product = loadCachedOwnerData({
    key: "image:product-family-production-v1",
    ttlMs: 1_000,
    load: async () => {
      productLoads += 1;
      await new Promise((resolve) => setTimeout(resolve, 35));
      return ["Vacancy T-Shirt"];
    },
  });
  const persona = loadCachedOwnerData({
    key: "image:eligible-brand-models-v1",
    ttlMs: 1_000,
    load: async () => {
      personaLoads += 1;
      await new Promise((resolve) => setTimeout(resolve, 35));
      return ["North African Street Premium"];
    },
  });
  const duplicateProduct = loadCachedOwnerData({
    key: "image:product-family-production-v1",
    ttlMs: 1_000,
    load: async () => {
      productLoads += 1;
      return [];
    },
  });
  const [products, models, duplicate] = await Promise.all([
    product,
    persona,
    duplicateProduct,
  ]);
  const elapsed = Date.now() - started;
  assert.deepEqual(products, duplicate);
  assert.deepEqual(models, ["North African Street Premium"]);
  assert.equal(productLoads, 1);
  assert.equal(personaLoads, 1);
  assert.ok(elapsed < 65, `parallel elapsed ${elapsed}ms should stay below serial 70ms`);
});

test("stable owner data is reused and actual Product writes invalidate it", async () => {
  resetCachedOwnerDataForTests();
  let loads = 0;
  const load = () =>
    loadCachedOwnerData({
      key: "image:product-family-production-v1",
      ttlMs: 60_000,
      load: async () => ({ version: ++loads }),
    });
  assert.equal((await load()).version, 1);
  assert.equal((await load()).version, 1);
  invalidateCachedOwnerData("image:product-family-production");
  assert.equal((await load()).version, 2);
});

test("static Content Pack cards exist before optional history or report persistence", () => {
  const assets = immediateContentPlanningAssets();
  const ids = new Set(assets.map((asset) => asset.id));
  for (const id of CONTENT_PACKS.BASE.shotIds) assert.equal(ids.has(id), true);
  for (const id of CONTENT_PACKS.WINNING_EXPANSION.shotIds)
    assert.equal(ids.has(id), true);
  assert.equal(new Set(assets.map((asset) => asset.id)).size, assets.length);
});

test("optional Content Pack history waits for an idle lane and never owns card availability", () => {
  const source = readFileSync(
    "components/image/content-pack-selector.tsx",
    "utf8",
  );
  assert.match(source, /requestIdleCallback\(loadHistory/);
  assert.match(source, /disabled=\{!compatible \|\| !asset\}/);
  assert.doesNotMatch(source, /disabled=\{[^}]*runs/);
  assert.doesNotMatch(source, /disabled=\{[^}]*packProgress/);
});
