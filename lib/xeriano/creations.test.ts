import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  creationStudioHref,
  creationVideoHref,
  xerianoCreationSchema,
  XERIANO_CREATION_PAGE_SIZE,
} from "./creation-contracts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const id = "11111111-1111-4111-8111-111111111111";

test("Creation contracts provide zero-cost edit, recreate and video handoffs", () => {
  assert.equal(
    creationStudioHref(id, "edit"),
    `/app/creative-studio?creation=${id}&mode=edit`,
  );
  assert.equal(
    creationStudioHref(id, "recreate"),
    `/app/creative-studio?creation=${id}&mode=recreate`,
  );
  assert.equal(
    creationVideoHref(id),
    `/app/ugc-video-studio?libraryAsset=${id}`,
  );
  assert.equal(XERIANO_CREATION_PAGE_SIZE, 24);
  for (const href of [
    creationStudioHref(id, "edit"),
    creationStudioHref(id, "recreate"),
    creationVideoHref(id),
  ]) {
    assert.doesNotMatch(href, /generate|credits|reserve/);
  }
});

test("Creation response keeps customer-safe result, setup and ordered references", () => {
  const parsed = xerianoCreationSchema.parse({
    id,
    assetId: "22222222-2222-4222-8222-222222222222",
    creationType: "IMAGE",
    sourceStudio: "CREATIVE_STUDIO",
    sourceJobId: "33333333-3333-4333-8333-333333333333",
    sourceResultId: "result-1",
    title: "Creative Bild",
    mimeType: "image/png",
    originalPrompt: "Ein authentisches Fashion-Bild",
    modelId: "nano-banana-pro",
    settings: { aspectRatio: "4:5", quality: "2K", batchSize: 1 },
    creditCost: 20,
    favorite: false,
    status: "SUCCEEDED",
    createdAt: "2026-08-30T00:00:00.000Z",
    resultContentUrl: "/api/xeriano/library/result/content",
    resultDownloadUrl: "/api/xeriano/library/result/content?download=1",
    references: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        order: 0,
        role: "DESIGN",
        sourceKind: "LOCAL_FILE_REFERENCE",
        filename: "design.png",
        mimeType: "image/png",
        byteLength: 8,
        checksumSha256: "a".repeat(64),
        contentUrl: "/api/xeriano/creations/c/references/r/content",
        source: { kind: "LOCAL_FILE_REFERENCE" },
      },
    ],
  });
  assert.equal(parsed.references?.[0]?.order, 0);
  assert.equal(parsed.creditCost, 20);
  assert.equal("providerRequestId" in parsed, false);
});

test("additive migration makes one account-scoped Creation per provider result", () => {
  const sql = read(
    "supabase/migrations/20260830023000_xeriano_creations_v1.sql",
  );
  assert.match(sql, /create table if not exists public\.xeriano_creations/);
  assert.match(sql, /create table if not exists public\.xeriano_creation_references/);
  assert.match(
    sql,
    /unique\(account_id, source_studio, source_job_id, source_result_id\)/,
  );
  assert.match(sql, /unique\(creation_id, reference_order\)/);
  assert.match(sql, /foreign key \(library_asset_id, account_id\)/);
  assert.match(sql, /LOCAL_FILE_REFERENCE[\s\S]+creative-studio-assets/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all[\s\S]+authenticated/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("customer generation persists exact references before frozen provider execution", () => {
  const route = read("app/api/creative-studio/generate/route.ts");
  assert.ok(
    route.indexOf("reserveCustomerGeneration") <
      route.indexOf("prepareCreativeCreationReferences"),
  );
  assert.ok(
    route.indexOf("prepareCreativeCreationReferences({") <
      route.indexOf("generateCreativeJob({"),
  );
  assert.ok(
    route.indexOf("generateCreativeJob({") <
      route.indexOf("finalizeCreativeCreations({"),
  );
  const storage = read("lib/creative-studio/server-storage.ts");
  assert.match(storage, /xeriano-private-reference-bytes-v1/);
  assert.match(storage, /bytesBase64/);
  assert.match(storage, /creation-references\/manifest\.json/);
  const service = read("lib/xeriano/creation-service.ts");
  assert.match(service, /from\("xeriano_creations"\)\.select\("id"\)\.limit\(1\)/);
  assert.match(
    service,
    /from\("xeriano_creation_references"\)\.select\("id"\)\.limit\(1\)/,
  );
});

test("automatic materialization is idempotent and does not create a financial effect", () => {
  const source = read("lib/xeriano/creation-service.ts");
  assert.match(source, /ensureCreativeLibraryAsset/);
  assert.match(source, /finalizeCreativeCreations/);
  assert.match(source, /eq\("source_job_id", input\.run\.id\)/);
  assert.match(source, /eq\("source_result_id", result\.id\)/);
  assert.match(source, /raced/);
  assert.doesNotMatch(
    source,
    /reserveCustomerGeneration|commit_credit|release_credit|quoteXerianoCredits/,
  );
});

test("Creation detail and reference bytes are server-account-scoped", () => {
  for (const route of [
    "app/api/xeriano/creations/[creationId]/route.ts",
    "app/api/xeriano/creations/[creationId]/references/[referenceId]/content/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /requireXerianoAccount/);
    assert.match(source, /\.eq\("account_id", account\.accountId\)/);
    assert.doesNotMatch(source, /request.*accountId|searchParams.*account/i);
  }
  const content = read(
    "app/api/xeriano/creations/[creationId]/references/[referenceId]/content/route.ts",
  );
  assert.match(content, /checksum_sha256/);
  assert.match(content, /creation_reference_integrity_failed/);
  assert.doesNotMatch(content, /storage_path[^\n]+NextResponse|storage_bucket[^\n]+NextResponse/);
});

test("Library is visual, paginated and opens generated assets as Creation details", () => {
  const route = read("app/api/xeriano/library/route.ts");
  assert.match(route, /\["DESIGN",\s*"IMAGE",\s*"VIDEO",\s*"REFERENCE"\]/);
  assert.match(route, /query=query\.eq\("asset_type",type\)/);
  assert.match(route, /XERIANO_LIBRARY_SCHEMA_UNAVAILABLE/);
  assert.match(route, /SCHEMA_MIGRATION_UNAVAILABLE/);
  assert.match(route, /error: "Die Bibliothek ist gerade nicht verfügbar\."/);
  const grid = read("components/xeriano/library-grid.tsx");
  assert.match(grid, /\["IMAGE", "Bilder"\]/);
  assert.match(grid, /xeriano-creation-grid/);
  assert.match(grid, /\$\{basePath\}\/\$\{encodeURIComponent\(asset\.creationId\)\}/);
  assert.match(grid, /basePath = "\/app\/library"/);
  assert.match(grid, /Mehr anzeigen/);
  assert.match(grid, /offset: String\(offset\)/);
  assert.doesNotMatch(grid, /setInterval|EventSource/);
  const css = read("app/xeriano.css");
  assert.match(css, /xeriano-creation-grid\{grid-template-columns:repeat\(2/);
});

test("customer result UX uses edit/recreate/video and automatic Library status", () => {
  const workspace = read(
    "components/creative-studio/creative-studio-workspace.tsx",
  );
  assert.match(workspace, /Bild bearbeiten/);
  assert.match(workspace, /Neu erstellen/);
  assert.match(workspace, /Video erstellen/);
  assert.match(workspace, /In Bibliothek/);
  assert.match(workspace, /initialCreationMode === "edit"/);
  assert.match(workspace, /initialCreationMode\?: "edit" \| "recreate"/);
  assert.match(workspace, /creation\.references/);
  assert.match(workspace, /referenceResponse\.blob/);
  assert.doesNotMatch(
    read("components/xeriano/creation-detail.tsx"),
    /submitCreativeGeneration|reserveCustomerGeneration|\/generate/,
  );
});
