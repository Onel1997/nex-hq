import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) { return readFile(new URL(`../../${path}`, import.meta.url), "utf8"); }

test("OWNER-only Studio and API authority are additive and absent from CUSTOMER navigation", async () => {
  const [navigation, page, authority, routes] = await Promise.all([
    read("lib/i18n/data/hq-navigation.ts"),
    read("app/(dashboard)/hq/artwork-prep-studio/page.tsx"),
    read("lib/artwork-prep-studio/authority.ts"),
    Promise.all(["sources/route.ts", "quote/route.ts", "process/route.ts", "assets/[assetId]/route.ts", "jobs/[jobId]/route.ts"].map((file) => read(`app/api/artwork-prep-studio/${file}`))).then((files) => files.join("\n")),
  ]);
  assert.match(navigation, /href: "\/hq\/artwork-prep-studio"/);
  assert.doesNotMatch(navigation.match(/const customerRoutes[\s\S]*?\]\);/)?.[0] ?? "", /artwork-prep/);
  assert.match(page + authority, /hasXerianoOwnerAuthority/);
  assert.match(routes, /requireArtworkPrepOwner/);
  assert.doesNotMatch(routes, /reserveCustomerGeneration|Credits|queue\.submit/);
});

test("direct upload uses an isolated studio authority and no binary API body", async () => {
  const [ui, client, server, migration] = await Promise.all([
    read("components/artwork-prep-studio/artwork-prep-workspace.tsx"),
    read("lib/xeriano/temp-references/client.ts"),
    read("lib/xeriano/temp-references/server.ts"),
    read("supabase/migrations/20260909105614_artwork_prep_studio_authority.sql"),
  ]);
  assert.match(ui, /studio: "ARTWORK_PREP_STUDIO"/);
  assert.match(client, /uploadToSignedUrl/);
  assert.match(client, /metadata\/ids only and never carry binary data/);
  assert.match(server, /ARTWORK_PREP_STUDIO/);
  for (const studio of ["CREATIVE_STUDIO", "UGC_VIDEO_STUDIO", "VIDEO_EDITOR_STUDIO", "ARTWORK_PREP_STUDIO"]) assert.match(migration, new RegExp(studio));
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(ui, /FormData|arrayBuffer\(\)/);
});

test("provider actions are POST-only, recovery observes exact jobs and local transforms are creditfree", async () => {
  const [processRoute, jobRoute, service] = await Promise.all([
    read("app/api/artwork-prep-studio/process/route.ts"),
    read("app/api/artwork-prep-studio/jobs/[jobId]/route.ts"),
    read("lib/artwork-prep-studio/service.ts"),
  ]);
  assert.match(processRoute, /export async function POST/);
  assert.doesNotMatch(processRoute, /export async function GET/);
  assert.match(jobRoute, /recoverArtworkPrepUtility/);
  assert.doesNotMatch(jobRoute, /startArtworkPrepUtility|executeDesignUtility|queue\.submit/);
  assert.match(service, /renderArtworkBackground/);
  assert.match(service, /recordDesignProviderCostEvent/);
  assert.doesNotMatch(service, /reserveCustomerGeneration|credit_reservations|refund/i);
});

test("assets are private, account/actor bound, idempotent and originals are never overwritten", async () => {
  const assets = await read("lib/artwork-prep-studio/assets.ts");
  assert.match(assets, /\.eq\("account_id", context\.accountId\)/);
  assert.match(assets, /\.eq\("owner_user_id", context\.userId\)/);
  assert.match(assets, /source_studio: "ARTWORK_PREP_STUDIO"/);
  assert.match(assets, /source_result_id/);
  assert.match(assets, /upsert: false/);
  assert.doesNotMatch(assets, /from\("xeriano_library_assets"\)[\s\S]{0,120}\.update\(|replaceAssetId|public:\s*true/);
});

test("mobile workspace is scoped, resumable and reuses native media save", async () => {
  const [ui, css] = await Promise.all([
    read("components/artwork-prep-studio/artwork-prep-workspace.tsx"),
    read("app/artwork-prep-studio.css"),
  ]);
  assert.match(ui, /ARTWORK_PREP_LOCAL_STORAGE_KEY/);
  assert.match(ui, /visibilitychange/);
  assert.match(ui, /pageshow/);
  assert.match(ui, /XerianoMediaSaveLink/);
  assert.match(css, /overflow-x:clip/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.doesNotMatch(css, /100vw|user-scalable|maximum-scale/);
});
