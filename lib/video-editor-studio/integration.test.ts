import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("OWNER-only navigation and route do not project Video Editor into CUSTOMER", async () => {
  const [navigation, page, authority] = await Promise.all([
    read("lib/i18n/data/hq-navigation.ts"),
    read("app/(dashboard)/hq/video-editor-studio/page.tsx"),
    read("lib/video-editor-studio/authority.ts"),
  ]);
  assert.match(navigation, /href: "\/hq\/video-editor-studio"/);
  assert.doesNotMatch(navigation.match(/const customerRoutes[\s\S]*?\]\);/)?.[0] ?? "", /video-editor/);
  assert.match(page, /hasXerianoOwnerAuthority/);
  assert.match(authority, /hasXerianoOwnerAuthority/);
  assert.match(authority, /hasXerianoAccountMembership/);
  assert.doesNotMatch(authority, /role\s*===\s*["']ADMIN/);
});

test("studio owns its state and never reads Creative or UGC active-run stores", async () => {
  const ui = await read("components/video-editor-studio/video-editor-workspace.tsx");
  assert.match(ui, /xeriamo-video-editor-owner-project-v1/);
  assert.doesNotMatch(ui, /activeRun|creative.*Run|ugc.*Run/i);
  assert.doesNotMatch(ui, /queue\.submit|fal-ai|credits|reservation/i);
  assert.match(ui, /XerianoMediaSaveLink/);
});

test("durable claim and manifest precede the one scheduled render and reload only observes", async () => {
  const [service, route, ui] = await Promise.all([
    read("lib/video-editor-studio/service.ts"),
    read("app/api/video-editor-studio/render/route.ts"),
    read("components/video-editor-studio/video-editor-workspace.tsx"),
  ]);
  const durableFunction = service.slice(service.indexOf("export async function createDurableVideoEditorJob"));
  assert.ok(durableFunction.indexOf("store.claim") < durableFunction.indexOf("store.writeManifest(manifest)"));
  assert.ok(durableFunction.indexOf("store.writeManifest(manifest)") < durableFunction.indexOf("bindVideoEditorTempSources"));
  assert.match(service, /const confirmed = await store\.readManifest/);
  assert.match(service, /failedClipIds\.push/);
  assert.match(route, /if \(durable\.created\)[\s\S]*after/);
  assert.doesNotMatch(route, /@fal-ai|queue\.submit|providerAccepted|credit_reservation|reserveCredits/i);
  assert.match(ui, /observeJob\(jobId\)/);
  assert.doesNotMatch(ui.match(/const observeJob[\s\S]*?\}, \[\]\);/)?.[0] ?? "", /\/render|method:\s*"POST"/);
});

test("render is isolated, creates a new private UPLOAD library asset and never loops clips", async () => {
  const [service, ffmpeg, storage, mediaSave] = await Promise.all([
    read("lib/video-editor-studio/service.ts"),
    read("lib/video-editor-studio/ffmpeg.ts"),
    read("lib/video-editor-studio/storage.ts"),
    read("lib/xeriano/media-save.ts"),
  ]);
  assert.match(service, /source_studio: "UPLOAD"/);
  assert.match(service, /asset_type: "VIDEO"/);
  assert.match(storage, /video-editor/);
  assert.match(storage, /UGC_VIDEO_ASSET_BUCKET/);
  assert.doesNotMatch(ffmpeg, /-stream_loop|loop=/);
  assert.match(ffmpeg, /libx264/);
  assert.match(ffmpeg, /720:1280/);
  assert.match(ffmpeg, /fps=30/);
  assert.match(ffmpeg, /\+faststart/);
  assert.match(mediaSave, /\.share!/);
});

test("Smart Cut is non-generative and partial failures preserve manual editing", async () => {
  const [analysisRoute, ui, ffmpeg] = await Promise.all([
    read("app/api/video-editor-studio/analyze/route.ts"),
    read("components/video-editor-studio/video-editor-workspace.tsx"),
    read("lib/video-editor-studio/ffmpeg.ts"),
  ]);
  assert.doesNotMatch(analysisRoute + ffmpeg, /@fal-ai|openai|queue\.submit/i);
  assert.match(ffmpeg, /blackdetect/);
  assert.match(ffmpeg, /freezedetect/);
  assert.match(ffmpeg, /blurdetect/);
  assert.match(ffmpeg, /gt\(scene,0\.32\)/);
  assert.match(ui, /VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES/);
  assert.match(ui, /Math\.min\(VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES/);
  assert.match(ui, /manueller Schnitt bleibt möglich/);
});

test("editor references are isolated, streamed and never reuse the UGC studio authority", async () => {
  const [ui, sources, streaming, migration] = await Promise.all([
    read("components/video-editor-studio/video-editor-workspace.tsx"),
    read("lib/video-editor-studio/sources.ts"),
    read("lib/video-editor-studio/streaming.ts"),
    read("supabase/migrations/20260904201254_xeriamo_video_editor_references_and_render_lease.sql"),
  ]);
  assert.match(ui, /studio: "VIDEO_EDITOR_STUDIO"/);
  assert.doesNotMatch(ui, /studio: "UGC_VIDEO_STUDIO"/);
  assert.match(sources, /row\.studio !== "VIDEO_EDITOR_STUDIO"/);
  assert.match(sources, /VIDEO_EDITOR_WRONG_STUDIO/);
  assert.match(streaming, /response\.body\.getReader/);
  assert.doesNotMatch(sources + streaming, /arrayBuffer\(\)/);
  for (const studio of ["CREATIVE_STUDIO", "UGC_VIDEO_STUDIO", "VIDEO_EDITOR_STUDIO"]) assert.match(migration, new RegExp(studio));
});

test("media routes issue short-lived protected Storage redirects without buffering video", async () => {
  const [sourceRoute, assetRoute, delivery] = await Promise.all([
    read("app/api/video-editor-studio/sources/[kind]/[sourceId]/route.ts"),
    read("app/api/video-editor-studio/jobs/[jobId]/asset/route.ts"),
    read("lib/video-editor-studio/delivery.ts"),
  ]);
  assert.match(sourceRoute + assetRoute, /requireVideoEditorOwner/);
  assert.match(sourceRoute, /createVideoEditorSourceSignedUrl/);
  assert.match(assetRoute, /createResultSignedUrl/);
  assert.match(delivery, /NextResponse\.redirect\(signed, 307\)/);
  assert.match(delivery, /private, no-store/);
  assert.doesNotMatch(sourceRoute + assetRoute, /arrayBuffer|Buffer\.from|readResult/);
});

test("only Analyze and Render import the FFmpeg-bearing service boundary", async () => {
  const [jobRoute, assetRoute, sourceRoute, nextConfig] = await Promise.all([
    read("app/api/video-editor-studio/jobs/[jobId]/route.ts"),
    read("app/api/video-editor-studio/jobs/[jobId]/asset/route.ts"),
    read("app/api/video-editor-studio/sources/[kind]/[sourceId]/route.ts"),
    read("next.config.ts"),
  ]);
  assert.doesNotMatch(jobRoute + assetRoute + sourceRoute, /video-editor-studio\/service/);
  assert.match(nextConfig, /"\/api\/video-editor-studio\/analyze"/);
  assert.match(nextConfig, /"\/api\/video-editor-studio\/render"/);
});

test("existing studio provider and generation files are not imported or changed by the editor", async () => {
  const files = [
    "lib/video-editor-studio/service.ts",
    "lib/video-editor-studio/ffmpeg.ts",
    "components/video-editor-studio/video-editor-workspace.tsx",
  ];
  const combined = (await Promise.all(files.map(read))).join("\n");
  assert.doesNotMatch(combined, /creative-studio\/generation-service|ugc-video-studio\/generation-service/);
  assert.doesNotMatch(combined, /fal-video-edit|fal-video-recast|fal-kling-motion-control|fal-base-video/);
});

test("scoped mobile styles keep the 375-430px editor within its container", async () => {
  const css = await read("app/video-editor-studio.css");
  assert.match(css, /\.ve-studio \*[\s\S]*min-width: 0/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /font-size: 16px/);
  assert.doesNotMatch(css, /100vw|w-screen/);
});
