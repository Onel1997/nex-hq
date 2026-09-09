import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("UGC successful results are automatically projected through the existing idempotent importer", () => {
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  assert.match(workspace, /activeRun\?\.status !== "SUCCEEDED"/);
  assert.match(workspace, /automaticLibraryProjectionRef\.current\.has\(key\)/);
  assert.match(workspace, /saveResultToLibrary\(activeRun, result\.id, false\)/);
  assert.match(workspace, /sourceStudio: "UGC_VIDEO_STUDIO"/);
  assert.match(workspace, /sourceJobId: sourceRun\.id/);
  assert.doesNotMatch(workspace.slice(workspace.indexOf("const saveResultToLibrary"), workspace.indexOf("return (", workspace.indexOf("const saveResultToLibrary"))), /submitUgcVideoGeneration|generateUgcVideoJob|reserveCustomerGeneration/);
});

test("Library import is account-scoped, VIDEO typed and race-idempotent", () => {
  const route = readFileSync("app/api/xeriano/library/import/route.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260828213000_xeriano_library_v1.sql", "utf8");
  assert.match(route, /requireXerianoAccount\(\)/);
  assert.match(route, /\.eq\("account_id", context\.accountId\)/);
  assert.match(route, /input\.sourceStudio === "CREATIVE_STUDIO" \? "IMAGE" : "VIDEO"/);
  assert.match(route, /if \(raced\.data\)/);
  assert.match(migration, /unique\(account_id,source_studio,source_job_id,source_result_id\)/);
  assert.doesNotMatch(route, /queue\.submit|generateUgcVideoJob|reserveCustomerGeneration|settle|refund/i);
});

test("Library VIDEO filter and Video Editor projection already use the shared private Library", () => {
  const api = readFileSync("app/api/xeriano/library/route.ts", "utf8");
  const grid = readFileSync("components/xeriano/library-grid.tsx", "utf8");
  const editor = readFileSync("lib/video-editor-studio/service.ts", "utf8");
  assert.match(grid, /\["VIDEO", "Videos"\]/);
  assert.match(api, /\["DESIGN", "IMAGE", "VIDEO", "REFERENCE"\]\.includes\(type\)/);
  assert.match(editor, /asset_type: "VIDEO"/);
  assert.match(editor, /storage_bucket: LIBRARY_BUCKET/);
  assert.match(editor, /source_job_id: input\.manifest\.jobId/);
  assert.match(editor, /source_result_id: input\.resultId/);
  assert.match(editor, /if \(raced\.data\) return raced\.data\.id/);
});

test("current Creative Studio contract has no video result path to project", () => {
  const contracts = readFileSync("lib/creative-studio/contracts.ts", "utf8");
  assert.match(contracts, /CREATIVE_OUTPUT_TYPES = \[[\s\S]*"STREETWEAR_ASSET"/);
  assert.doesNotMatch(contracts, /CREATIVE_OUTPUT_TYPES = \[[\s\S]*?"VIDEO"/);
});
