import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  observeCreativeGenerationJob,
} from "@/lib/creative-studio/client";
import {
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  creativeRunSchema,
  type CreativeReferenceImage,
  type CreativeRun,
} from "@/lib/creative-studio/contracts";
import {
  buildCreativeReferenceSnapshot,
  creativeReferenceContentUrl,
  fallbackSnapshotFromRun,
  fetchCreativeReferenceSnapshot,
  mergeCreativeRunClientState,
  preserveCreativeRunAgainstLocalDowngrade,
  recoverCreativeReferenceBlobs,
  saveCreativeReferenceSnapshot,
} from "@/lib/creative-studio/reference-recovery";

const NOW = "2026-08-30T00:00:00.000Z";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_JOB_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

function reference(
  name: string,
  order: number,
  source: CreativeReferenceImage["source"],
): CreativeReferenceImage {
  const file = new File([`bytes:${name}`], name, { type: "image/png" });
  return {
    id: `ref-${order}`,
    name,
    mimeType: file.type,
    byteLength: file.size,
    role: order === 0 ? "DESIGN" : "MODEL",
    order,
    file,
    previewUrl: `blob:${name}`,
    tempReferenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    uploadState: "READY",
    source,
  };
}

function run(overrides: Partial<CreativeRun> = {}): CreativeRun {
  return creativeRunSchema.parse({
    id: JOB_ID,
    createdAt: NOW,
    updatedAt: NOW,
    status: "SUCCEEDED",
    setup: {
      contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
      prompt: "Erstelle ein hochwertiges Fashion-Motiv.",
      modelId: "nano-banana-pro",
      aspectRatio: "4:5",
      quality: "2K",
      batchSize: 1,
      outputType: "CAMPAIGN",
      references: [
        {
          id: "ref-0",
          name: "design.png",
          mimeType: "image/png",
          byteLength: 12,
          role: "DESIGN",
          order: 0,
        },
      ],
      advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
    },
    results: [
      {
        id: "result-1",
        url: `/api/creative-studio/assets/${JOB_ID}/result-1`,
        downloadUrl: null,
        mimeType: "image/png",
        width: 1024,
        height: 1280,
        favorite: false,
      },
    ],
    message: "Das Bild wurde erfolgreich erstellt.",
    ...overrides,
  });
}

test("reference snapshot preserves durable provenance, role and user-selected order without bytes", () => {
  const snapshot = buildCreativeReferenceSnapshot({
    jobId: JOB_ID,
    createdAt: NOW,
    references: [
      reference("local.png", 2, { kind: "LOCAL_FILE_REFERENCE" }),
      reference("design.png", 0, {
        kind: "LIBRARY_REFERENCE",
        libraryAssetId: ASSET_ID,
      }),
      reference("winner.png", 1, {
        kind: "GENERATED_RESULT_REFERENCE",
        sourceJobId: SOURCE_JOB_ID,
        sourceResultId: "winner-1",
      }),
    ],
  });

  assert.deepEqual(
    snapshot.references.map((item) => [item.order, item.source.kind, item.role]),
    [
      [0, "LIBRARY_REFERENCE", "DESIGN"],
      [1, "GENERATED_RESULT_REFERENCE", "MODEL"],
      [2, "LOCAL_FILE_REFERENCE", "MODEL"],
    ],
  );
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /blob:|bytes:local|data:image/);
  assert.equal(snapshot.references[0]?.checksumSha256, null);
});

test("durable Library and generated-result references recover in order while local files remain explicit", async () => {
  const snapshot = buildCreativeReferenceSnapshot({
    jobId: JOB_ID,
    createdAt: NOW,
    references: [
      reference("local.png", 2, { kind: "LOCAL_FILE_REFERENCE" }),
      reference("design.png", 0, {
        kind: "LIBRARY_REFERENCE",
        libraryAssetId: ASSET_ID,
      }),
      reference("winner.png", 1, {
        kind: "GENERATED_RESULT_REFERENCE",
        sourceJobId: SOURCE_JOB_ID,
        sourceResultId: "winner-1",
      }),
    ],
  });
  const calls: string[] = [];
  const recovered = await recoverCreativeReferenceBlobs({
    snapshot,
    fetcher: async (input) => {
      calls.push(String(input));
      return new Response(new Blob(["image"], { type: "image/png" }), {
        status: 200,
      });
    },
  });

  assert.deepEqual(calls, [
    `/api/xeriano/library/${ASSET_ID}/content`,
    `/api/creative-studio/assets/${SOURCE_JOB_ID}/winner-1`,
  ]);
  assert.deepEqual(recovered.restored.map((item) => item.entry.order), [0, 1]);
  assert.deepEqual(recovered.localOnly.map((item) => item.order), [2]);
  assert.equal(recovered.unavailable.length, 0);
  assert.equal(creativeReferenceContentUrl(snapshot.references[2]!), null);
});

test("old runs truthfully degrade unknown provenance to local-only placeholders", () => {
  const fallback = fallbackSnapshotFromRun(run());
  assert.equal(fallback.references.length, 1);
  assert.equal(fallback.references[0]?.source.kind, "LOCAL_FILE_REFERENCE");
  assert.equal(fallback.references[0]?.filename, "design.png");
});

test("snapshot API helpers use a metadata-only sidecar and never invoke generation", async () => {
  const snapshot = buildCreativeReferenceSnapshot({
    jobId: JOB_ID,
    createdAt: NOW,
    references: [],
  });
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? "GET" });
    return Response.json({ success: true, snapshot });
  };
  await saveCreativeReferenceSnapshot({ snapshot, fetcher });
  await fetchCreativeReferenceSnapshot({ jobId: JOB_ID, fetcher });
  assert.deepEqual(calls, [
    {
      url: `/api/creative-studio/jobs/${JOB_ID}/reference-snapshot`,
      method: "PUT",
    },
    {
      url: `/api/creative-studio/jobs/${JOB_ID}/reference-snapshot`,
      method: "GET",
    },
  ]);
  assert.equal(calls.some((call) => call.url.endsWith("/generate")), false);
});

test("server refresh preserves snapshot, favorite and idempotent Library import state", () => {
  const snapshot = buildCreativeReferenceSnapshot({
    jobId: JOB_ID,
    createdAt: NOW,
    references: [],
  });
  const existing = run({
    referenceSnapshot: snapshot,
    results: [
      {
        ...run().results[0]!,
        favorite: true,
        libraryAssetId: ASSET_ID,
      },
    ],
  });
  const merged = mergeCreativeRunClientState(run(), existing);
  assert.equal(merged.referenceSnapshot?.jobId, JOB_ID);
  assert.equal(merged.results[0]?.favorite, true);
  assert.equal(merged.results[0]?.libraryAssetId, ASSET_ID);
});

test("server SUCCEEDED hydrates over local UNKNOWN_OUTCOME without losing results", () => {
  const localUnknown = run({
    status: "UNKNOWN_OUTCOME",
    results: [],
    providerRequestId: null,
    message: "Der Anbieterstatus ist unklar.",
  });
  const serverSucceeded = run({
    providerRequestId: "provider-request-present",
  });
  const merged = mergeCreativeRunClientState(serverSucceeded, localUnknown);
  assert.equal(merged.status, "SUCCEEDED");
  assert.equal(merged.providerRequestId, "provider-request-present");
  assert.equal(merged.results.length, 1);
});

test("late local UNKNOWN_OUTCOME cannot overwrite an observed terminal server run", () => {
  const serverSucceeded = run({
    providerRequestId: "provider-request-present",
  });
  const localUnknown = run({
    status: "UNKNOWN_OUTCOME",
    results: [],
    providerRequestId: null,
    message: "Der Anbieterstatus ist unklar.",
  });
  const preserved = preserveCreativeRunAgainstLocalDowngrade(
    localUnknown,
    serverSucceeded,
  );
  assert.equal(preserved.status, "SUCCEEDED");
  assert.equal(preserved.providerRequestId, "provider-request-present");
  assert.equal(preserved.results.length, 1);
});

test("early manifest 404 is classified as PREPARING without generation retry", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const observed = await observeCreativeGenerationJob({
    jobId: JOB_ID,
    fetcher: async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      return Response.json(
        { success: false, code: "JOB_NOT_FOUND", error: "Noch nicht sichtbar." },
        { status: 404 },
      );
    },
  });
  assert.deepEqual(observed, { state: "PREPARING" });
  assert.deepEqual(calls, [
    {
      url: `/api/creative-studio/jobs/${JOB_ID}`,
      method: "GET",
    },
  ]);
  assert.equal(calls.some((call) => call.url.endsWith("/generate")), false);
});

test("ambiguous submission observation hydrates a later successful manifest", async () => {
  let calls = 0;
  const observed = await observeCreativeGenerationJob({
    jobId: JOB_ID,
    fetcher: async () => {
      calls += 1;
      return Response.json({ success: true, run: run() });
    },
  });
  assert.equal(calls, 1);
  assert.equal(observed.state, "FOUND");
  if (observed.state === "FOUND") {
    assert.equal(observed.run.status, "SUCCEEDED");
    assert.equal(observed.run.results.length, 1);
  }
});

test("customer setup recovery and result actions remain non-paid UI operations", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const controls = readFileSync(
    "components/creative-studio/creative-studio-controls.tsx",
    "utf8",
  );
  const css = readFileSync("app/creative-studio.css", "utf8");
  const route = readFileSync(
    "app/api/creative-studio/jobs/[jobId]/reference-snapshot/route.ts",
    "utf8",
  );
  const reopen = workspace.slice(
    workspace.indexOf("const reopenRunSetup"),
    workspace.indexOf("const savePrompt"),
  );
  const providerMetadata = workspace.slice(
    workspace.indexOf("function referenceMetadata"),
    workspace.indexOf("export function CreativeStudioWorkspace"),
  );

  assert.match(reopen, /fetchCreativeReferenceSnapshot/);
  assert.match(reopen, /recoverCreativeReferenceBlobs/);
  assert.doesNotMatch(reopen, /submitCreativeGeneration|reserveCustomerGeneration|\/generate/);
  assert.match(providerMetadata, /id: reference\.id/);
  assert.doesNotMatch(providerMetadata, /source|libraryAssetId|sourceJobId/);
  assert.match(controls, /Diese lokale Referenz musst du erneut hinzufügen\./);
  assert.match(workspace, /In Bibliothek/);
  assert.match(workspace, /cs-result-library/);
  assert.match(workspace, /Als Referenz/);
  assert.match(workspace, /Herunterladen/);
  assert.match(workspace, /Weitere Ergebnisaktionen/);
  assert.match(css, /\.cs-result-actions--customer/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) auto/);
  assert.match(css, /\.cs-result-more > summary[\s\S]*?min-height: 44px/);
  assert.match(route, /resolveXerianoAccess/);
  assert.match(route, /workspaceKey/);
  assert.match(route, /actorId: auth\.context\.userId/);
  assert.doesNotMatch(
    route,
    /@fal-ai|FAL_KEY|OpenAI|submitCreativeGeneration|reserveCustomerGeneration/,
  );
});

test("Library result import remains account-scoped and idempotent", () => {
  const route = readFileSync("app/api/xeriano/library/import/route.ts", "utf8");
  assert.match(route, /\.eq\("account_id", context\.accountId\)/);
  assert.match(route, /source_job_id/);
  assert.match(route, /source_result_id/);
  assert.match(route, /reused: true/);
  assert.match(route, /requireXerianoAccount/);
});
