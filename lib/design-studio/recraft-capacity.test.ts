import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DESIGN_STUDIO_CONTRACT_VERSION, designGenerationSetupSchema, type DesignGenerationSetup } from "./contracts";
import { generateDesignJob } from "./generation-service";
import { DESIGN_ENDPOINTS } from "./model-config";
import {
  DesignProviderCapacityError,
  normalizeDesignProviderError,
  RECRAFT_CAPACITY_MESSAGE,
} from "./provider-errors";
import { FalDesignProvider, type FalDesignTransport } from "./providers/fal-design";
import type { DesignJobManifest } from "./server-contracts";
import type { XerianoAccountContext } from "../xeriano/auth";
import {
  reconcileCustomerGenerationFromRun,
  type XerianoGenerationAuthority,
  type XerianoGenerationAuthorityRepository,
} from "../xeriano/customer-generation";

function recraftSetup(): DesignGenerationSetup {
  return designGenerationSetupSchema.parse({
    contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
    prompt: "Editorial illustration",
    stylePreset: "EDITORIAL",
    model: "RECRAFT_4",
    outputMode: "RASTER",
    aspectRatio: "1:1",
    quality: "STANDARD",
    resolution: "2K",
    count: 1,
    reference: null,
  });
}

function capacityError() {
  const error = new Error("Selected model is at capacity. Please try a different model.") as Error & {
    status: number;
    body: { code: string };
  };
  error.status = 503;
  error.body = { code: "MODEL_AT_CAPACITY" };
  return error;
}

test("Recraft capacity is structurally normalized without leaking the provider wording", () => {
  const normalized = normalizeDesignProviderError(capacityError(), "RECRAFT_4");
  assert.ok(normalized instanceof DesignProviderCapacityError);
  assert.equal(normalized.code, "PROVIDER_CAPACITY");
  assert.equal(normalized.providerStatus, 503);
  assert.equal(normalized.message, RECRAFT_CAPACITY_MESSAGE);
  assert.doesNotMatch(normalized.message, /Selected model is at capacity/i);
  assert.equal(normalizeDesignProviderError({ status: 503, body: { message: "Service unavailable" } }, "RECRAFT_4"), null);
  assert.equal(normalizeDesignProviderError(capacityError(), "IDEOGRAM_4"), null);
});

test("capacity rejection before queue acceptance has no acceptance evidence", async () => {
  const transport: FalDesignTransport = {
    async upload() { throw new Error("not used"); },
    async submit() { throw capacityError(); },
    async wait() {},
    async result() { throw new Error("not used"); },
  };
  const provider = new FalDesignProvider(undefined, transport);
  let accepted = false;
  await assert.rejects(
    provider.generate({
      jobId: "00000000-0000-4000-8000-000000000031",
      setup: recraftSetup(),
      reference: null,
      onAccepted() { accepted = true; },
    }),
    (error: unknown) => error instanceof DesignProviderCapacityError && error.code === "PROVIDER_CAPACITY",
  );
  assert.equal(accepted, false);
});

test("accepted capacity failure remains accepted rather than becoming a refundable pre-submit failure", async () => {
  const transport: FalDesignTransport = {
    async upload() { throw new Error("not used"); },
    async submit() { return "accepted-capacity-request"; },
    async wait() { throw capacityError(); },
    async result() { throw new Error("not used"); },
  };
  const provider = new FalDesignProvider(undefined, transport);
  let accepted = "";
  await assert.rejects(provider.generate({
    jobId: "00000000-0000-4000-8000-000000000032",
    setup: recraftSetup(),
    reference: null,
    onAccepted(requestId) { accepted = requestId; },
  }), DesignProviderCapacityError);
  assert.equal(accepted, "accepted-capacity-request");
});

test("capacity manifest exposes only the safe code/message and preserves private normalized diagnostics", async () => {
  let manifest: DesignJobManifest | null = null;
  const store = {
    async claim() { return "CREATED" as const; },
    async writeManifest(value: DesignJobManifest) { manifest = value; },
    async readManifest() { return manifest; },
    async listManifests() { return manifest ? [manifest] : []; },
    async persistReference() { return "unused"; },
    async persistResult() { return "unused"; },
    async readResult() { return null; },
  };
  const run = await generateDesignJob({
    scope: { workspaceId: "workspace", actorId: "actor" },
    jobId: "00000000-0000-4000-8000-000000000033",
    setup: recraftSetup(),
    reference: null,
  }, {
    store: store as never,
    provider: {
      isConfigured: () => true,
      async generate() { throw new DesignProviderCapacityError(503); },
    },
    now: () => "2026-08-31T09:00:00.000Z",
  });
  assert.equal(run.status, "FAILED");
  assert.equal(run.failureCode, "PROVIDER_CAPACITY");
  assert.equal(run.message, RECRAFT_CAPACITY_MESSAGE);
  assert.equal((manifest as DesignJobManifest | null)?.providerRequestId, null);
  assert.equal((manifest as DesignJobManifest | null)?.technicalError, "PROVIDER_CAPACITY:503");
});

const context: XerianoAccountContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "customer@example.test",
  role: "CUSTOMER",
  accountId: "22222222-2222-4222-8222-222222222222",
  accountName: "Customer",
  workspaceKey: "customer-workspace",
  brainWorkspaceId: null,
  source: "XERIANO_MEMBERSHIP",
};

function authority(state: XerianoGenerationAuthority["state"], providerRequestId: string | null = null): XerianoGenerationAuthority {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    accountId: context.accountId,
    actorUserId: context.userId,
    reservationId: "44444444-4444-4444-8444-444444444444",
    jobId: "00000000-0000-4000-8000-000000000033",
    studio: "DESIGN_STUDIO",
    operation: "IMAGE",
    state,
    providerRequestId,
    quotedCredits: 15,
    pricingVersion: "design-test",
  };
}

test("pre-acceptance capacity releases; accepted and ambiguous settlement semantics stay unchanged", async () => {
  const events: string[] = [];
  let current = authority("RESERVED");
  const repository: XerianoGenerationAuthorityRepository = {
    async find() { return current; },
    async authorize() { return current; },
    async release() { events.push("release"); return current = authority("RELEASED"); },
    async markAccepted(input) { events.push("accepted"); return current = authority("PROVIDER_ACCEPTED", input.providerRequestId); },
    async markUnknown(input) { events.push("unknown"); return current = authority("UNKNOWN_OUTCOME", input.providerRequestId); },
    async finalize(input) { events.push(`final:${input.status}`); return current = authority(input.status, current.providerRequestId); },
  };
  await reconcileCustomerGenerationFromRun({
    context,
    jobId: current.jobId,
    run: { status: "FAILED", providerRequestId: null, providerModel: DESIGN_ENDPOINTS.RECRAFT_RASTER },
    repository,
  });
  assert.deepEqual(events, ["release"]);

  events.length = 0;
  current = authority("RESERVED");
  await reconcileCustomerGenerationFromRun({
    context,
    jobId: current.jobId,
    run: { status: "FAILED", providerRequestId: "accepted-request", providerModel: DESIGN_ENDPOINTS.RECRAFT_RASTER },
    repository,
  });
  assert.deepEqual(events, ["accepted", "final:FAILED"]);

  events.length = 0;
  current = authority("RESERVED");
  await reconcileCustomerGenerationFromRun({
    context,
    jobId: current.jobId,
    run: { status: "UNKNOWN_OUTCOME", providerRequestId: null, providerModel: DESIGN_ENDPOINTS.RECRAFT_RASTER },
    repository,
  });
  assert.deepEqual(events, ["unknown"]);
});

test("capacity UX is explicit, manual-only, and result actions use the final hierarchy", async () => {
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../app/xeriano.css", import.meta.url), "utf8");
  assert.match(ui, /Recraft ausgelastet/);
  assert.match(ui, /Weiter bearbeiten/);
  assert.match(ui, /Ideogram 4 verwenden/);
  assert.doesNotMatch(ui, /restoreRunSetup[\s\S]{0,500}submitDesignGeneration/);
  assert.match(ui, /xd-result-primary-row[\s\S]*Herunterladen[\s\S]*xd-result-actions[\s\S]*Aktionen/);
  assert.match(ui, /xd-result-creative-handoff[\s\S]*Im Creative Studio verwenden/);
  assert.match(css, /\.xd-result-primary-row\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.xd-result-footer>\.xd-result-creative-handoff\{[^}]*width:100%/);
  assert.match(css, /\.xd-result-actions summary\{[^}]*min-height:44px/);
  for (const action of ["Variation erstellen", "Favorit", "Hintergrund entfernen", "Auf 4K upscalen"]) {
    assert.match(ui, new RegExp(action));
  }
  assert.match(ui, /canBackgroundRemove/);
  assert.match(ui, /canUpscale/);
  assert.match(ui, /result\.mimeType !== "image\/svg\+xml"/);
});
