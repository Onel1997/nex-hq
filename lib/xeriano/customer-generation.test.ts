import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  CREATIVE_STUDIO_CONTRACT_VERSION,
  type CreativeGenerationSetup,
} from "@/lib/creative-studio/contracts";
import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import {
  quoteCreativeCustomerGeneration,
  quoteUgcCustomerGeneration,
  quarantineCustomerGeneration,
  reconcileCustomerGenerationFromRun,
  releaseCustomerGenerationBeforeProvider,
  reserveCustomerGeneration,
  settleCustomerGenerationFromRun,
  type XerianoGenerationAuthority,
  type XerianoGenerationAuthorityRepository,
} from "@/lib/xeriano/customer-generation";
import { readIsoBmffDurationSeconds } from "@/lib/xeriano/video-duration";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const context: XerianoAccountContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "customer@example.test",
  role: "CUSTOMER",
  accountId: "22222222-2222-4222-8222-222222222222",
  accountName: "Test",
  workspaceKey: "customer-test",
  brainWorkspaceId: null,
  source: "XERIANO_MEMBERSHIP",
};

function creativeSetup(quality: "1K" | "2K" | "4K" = "2K", batchSize: 1 | 2 | 3 | 4 = 1): CreativeGenerationSetup {
  return {
    contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
    prompt: "Ein Testbild",
    modelId: "nano-banana-pro",
    aspectRatio: "4:5",
    quality,
    batchSize,
    outputType: "SOCIAL_ASSET",
    references: [],
    advanced: { ...DEFAULT_CREATIVE_ADVANCED_SETTINGS },
  };
}

function klingSetup(
  sourceSeconds = 5,
  selectedSeconds: "5" | "10" | "15" | "20" | "30" = "5",
): UgcVideoGenerationSetup {
  return {
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "MOTION_CONTROL",
    prompt: "Ein Testvideo",
    modelId: "kling-v3-pro-motion-control",
    duration: selectedSeconds,
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "image", name: "model.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 100, durationSeconds: null, role: "MODEL", order: 0 },
      { id: "video", name: "motion.mp4", mimeType: "video/mp4", mediaType: "VIDEO", byteLength: 200, durationSeconds: sourceSeconds, role: "MOTION", order: 1 },
    ],
    advanced: { ...DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS },
    klingMotion: { ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS },
    videoEdit: { sourceVideoReferenceId: null, characterMasterReferenceId: null, keepOriginalSound: false },
    videoRecast: {
      profile: "KLING_O3_CHARACTER_SCENE_RECAST",
      sourceVideoReferenceId: null,
      characterOutfitReferenceId: null,
      faceReferenceId: null,
      sceneStyleReferenceId: null,
      sourceDurationSeconds: null,
      keepAudio: false,
    },
    baseVideo: { variant: "TEXT_TO_VIDEO", startImageReferenceId: null, resolution: "720p", generateAudio: false },
  };
}

class MemoryAuthorityRepository implements XerianoGenerationAuthorityRepository {
  events: string[] = [];
  authority: XerianoGenerationAuthority | null = null;

  value(state: XerianoGenerationAuthority["state"], providerRequestId: string | null = null) {
    this.authority = {
      id: "33333333-3333-4333-8333-333333333333",
      accountId: context.accountId,
      actorUserId: context.userId,
      reservationId: "44444444-4444-4444-8444-444444444444",
      jobId: "55555555-5555-4555-8555-555555555555",
      studio: "CREATIVE_STUDIO",
      operation: "IMAGE",
      state,
      providerRequestId,
      quotedCredits: 15,
      pricingVersion: "xeriano-credit-v1",
    };
    return this.authority;
  }

  async find() { return this.authority; }
  async authorize() { this.events.push("reserve"); return this.value("RESERVED"); }
  async markAccepted(input: { providerRequestId: string }) { this.events.push("commit"); return this.value("PROVIDER_ACCEPTED", input.providerRequestId); }
  async markUnknown(input: { providerRequestId: string | null }) { this.events.push("unknown"); return this.value("UNKNOWN_OUTCOME", input.providerRequestId); }
  async release() { this.events.push("release"); return this.value("RELEASED"); }
  async finalize(input: { status: "SUCCEEDED" | "FAILED" }) { this.events.push(`final:${input.status}`); return this.value(input.status, this.authority?.providerRequestId ?? "provider-1"); }
}

test("server quote authority prices Nano quality/count and Kling reference duration", () => {
  const creative = quoteCreativeCustomerGeneration(creativeSetup("2K", 1));
  assert.equal(creative.credits, 15);
  assert.equal((creative.pricingSnapshot.economics as { providerModel: string }).providerModel, "fal-ai/nano-banana-pro");
  assert.equal((creative.pricingSnapshot.economics as { safetyStatus: string }).safetyStatus, "SAFE_BELOW_TARGET");
  assert.deepEqual(creative, quoteCreativeCustomerGeneration(creativeSetup("2K", 1)), "idempotent replay snapshot must be stable");
  assert.equal(quoteCreativeCustomerGeneration(creativeSetup("4K", 2)).credits, 60);
  const kling = quoteUgcCustomerGeneration(klingSetup(5));
  assert.equal(kling.credits, 125);
  assert.equal(kling.pricingSnapshot.billableSeconds, 5);
  const tenSeconds = quoteUgcCustomerGeneration(klingSetup(12, "10"), 12);
  assert.equal(tenSeconds.credits, 250);
  assert.equal(tenSeconds.pricingSnapshot.billableSeconds, 10);
  assert.notDeepEqual(tenSeconds, kling, "duration changes the authoritative quote snapshot");
  assert.throws(
    () => quoteUgcCustomerGeneration(klingSetup(8, "10"), 8),
    /kürzer als die gewählte Videolänge/,
  );
  assert.throws(
    () =>
      quoteUgcCustomerGeneration(
        {
          ...klingSetup(26, "15"),
          klingMotion: {
            ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
            characterOrientation: "IMAGE",
          },
        },
        26,
      ),
    /maximal 10 Sekunden/,
  );
  assert.throws(() => quoteUgcCustomerGeneration({ ...klingSetup(), modelId: "seedance-2.5" }));
});

test("Kling financial duration can be derived from server-uploaded MP4 bytes", () => {
  const mvhd = Buffer.alloc(28);
  mvhd.writeUInt32BE(28, 0);
  mvhd.write("mvhd", 4, "ascii");
  mvhd.writeUInt8(0, 8);
  mvhd.writeUInt32BE(1_000, 20);
  mvhd.writeUInt32BE(5_000, 24);
  const moov = Buffer.alloc(8 + mvhd.length);
  moov.writeUInt32BE(moov.length, 0);
  moov.write("moov", 4, "ascii");
  mvhd.copy(moov, 8);
  assert.equal(readIsoBmffDurationSeconds(moov), 5);
});

test("reservation precedes execution and accepted provider commits exactly once", async () => {
  const repository = new MemoryAuthorityRepository();
  const quote = quoteCreativeCustomerGeneration(creativeSetup());
  await reserveCustomerGeneration({ context, jobId: "55555555-5555-4555-8555-555555555555", quote, repository });
  repository.events.push("provider");
  await settleCustomerGenerationFromRun({
    context,
    jobId: "55555555-5555-4555-8555-555555555555",
    run: { status: "SUCCEEDED", providerRequestId: "provider-1", providerModel: "internal" },
    repository,
  });
  assert.deepEqual(repository.events, ["reserve", "provider", "commit", "final:SUCCEEDED"]);
});

test("a replay after provider acceptance cannot cross the provider boundary again", async () => {
  const repository = new MemoryAuthorityRepository();
  repository.authority = repository.value("PROVIDER_ACCEPTED", "provider-1");
  repository.authorize = async () => {
    repository.events.push("reserve-replay");
    return repository.authority!;
  };

  await assert.rejects(
    reserveCustomerGeneration({
      context,
      jobId: repository.authority.jobId,
      quote: quoteCreativeCustomerGeneration(creativeSetup()),
      repository,
    }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "GENERATION_ALREADY_STARTED",
  );
  assert.deepEqual(repository.events, ["reserve-replay"]);
});

test("pre-provider failure releases while ambiguous submission never releases", async () => {
  const released = new MemoryAuthorityRepository();
  await reserveCustomerGeneration({ context, jobId: "55555555-5555-4555-8555-555555555555", quote: quoteCreativeCustomerGeneration(creativeSetup()), repository: released });
  await releaseCustomerGenerationBeforeProvider({ context, jobId: "55555555-5555-4555-8555-555555555555", repository: released });
  assert.deepEqual(released.events, ["reserve", "release"]);

  const ambiguous = new MemoryAuthorityRepository();
  await ambiguous.authorize();
  await settleCustomerGenerationFromRun({
    context,
    jobId: "55555555-5555-4555-8555-555555555555",
    run: { status: "UNKNOWN_OUTCOME", providerRequestId: null, providerModel: "internal" },
    repository: ambiguous,
  });
  assert.deepEqual(ambiguous.events, ["reserve", "unknown"]);
});

test("UGC polling reuses accepted authority without a second financial effect", async () => {
  const repository = new MemoryAuthorityRepository();
  repository.authority = {
    ...repository.value("PROVIDER_ACCEPTED", "provider-1"),
    studio: "UGC_VIDEO_STUDIO",
    operation: "VIDEO",
  };
  repository.events.length = 0;
  await reconcileCustomerGenerationFromRun({
    context,
    jobId: repository.authority.jobId,
    run: { status: "RUNNING", providerRequestId: "provider-1", providerModel: "internal" },
    repository,
  });
  assert.deepEqual(repository.events, []);
});

test("stale submission observation is quarantined without release or resubmit", async () => {
  const repository = new MemoryAuthorityRepository();
  repository.authority = repository.value("RESERVED");
  repository.events.length = 0;
  const authority = await reconcileCustomerGenerationFromRun({
    context,
    jobId: repository.authority.jobId,
    run: {
      status: "RUNNING",
      providerRequestId: null,
      providerModel: "fal-model",
      updatedAt: "2026-08-30T00:00:00.000Z",
    },
    nowMs: Date.parse("2026-08-30T00:11:00.000Z"),
    repository,
  });
  assert.equal(authority.state, "UNKNOWN_OUTCOME");
  assert.deepEqual(repository.events, ["unknown"]);
});

test("missing studio authority can be quarantined but never financially released", async () => {
  const repository = new MemoryAuthorityRepository();
  repository.authority = repository.value("RESERVED");
  repository.events.length = 0;
  const authority = await quarantineCustomerGeneration({
    context,
    jobId: repository.authority.jobId,
    repository,
  });
  assert.equal(authority.state, "UNKNOWN_OUTCOME");
  assert.deepEqual(repository.events, ["unknown"]);
});

test("additive migration atomically links reservation, acceptance and active concurrency", () => {
  const sql = read("supabase/migrations/20260830010000_xeriano_customer_generation_authority_v1.sql");
  assert.match(sql, /xeriano_generation_authorities/);
  assert.match(sql, /xeriano_authorize_customer_generation/);
  assert.match(sql, /xeriano_reserve_credits/);
  assert.match(sql, /xeriano_mark_customer_generation_accepted/);
  assert.match(sql, /xeriano_commit_credit_reservation/);
  assert.match(sql, /set status = 'RUNNING', completed_at = null/);
  assert.match(sql, /UNKNOWN remains an active claim/);
  assert.match(sql, /revoke all on public\.xeriano_generation_authorities from public,anon,authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("customer routes reserve before frozen execution and status never reserves", () => {
  const creative = read("app/api/creative-studio/generate/route.ts");
  const ugc = read("app/api/ugc-video-studio/generate/route.ts");
  const status = read("app/api/ugc-video-studio/jobs/[jobId]/route.ts");
  assert.ok(creative.indexOf("reserveCustomerGeneration") < creative.indexOf("generateCreativeJob({"));
  assert.ok(ugc.indexOf("reserveCustomerGeneration") < ugc.indexOf("generateUgcVideoJob("));
  assert.ok(
    ugc.lastIndexOf("prepareKlingMotionMedia({") <
      ugc.lastIndexOf("reserveCustomerGeneration({"),
    "the trusted media clip is prepared before credits are reserved",
  );
  assert.doesNotMatch(status, /reserveCustomerGeneration/);
  assert.match(status, /reconcileCustomerGenerationFromRun/);
  assert.match(creative, /authorizeXerianoGeneration/);
  assert.match(ugc, /authorizeXerianoGeneration/);
  assert.match(creative, /authorization\.bypass === null/);
  assert.match(ugc, /authorization\.bypass === null/);
  assert.match(creative, /OWNER_UNLIMITED/);
  assert.match(ugc, /requireTrustedCustomerMotionDuration/);
});

test("customer config and responses redact USD caps, provider diagnostics and routing", () => {
  const customerConfig = read("lib/xeriano/customer-config.ts");
  const customerPages = read("app/(customer)/app/creative-studio/page.tsx") + read("app/(customer)/app/ugc-video-studio/page.tsx");
  const policy = read("lib/xeriano/customer-generation.ts");
  assert.doesNotMatch(customerPages, /getCreativeProviderPublicConfig|getUgcVideoProviderPublicConfig/);
  assert.match(customerPages, /getXerianoCreativeCustomerConfig|getXerianoUgcCustomerConfig/);
  assert.doesNotMatch(customerConfig, /costCapUsd|pricingVersion|providerModel|EnvironmentName/);
  assert.match(policy, /redactCreativeRunForCustomer/);
  assert.match(policy, /providerError: _providerError/);
  assert.match(policy, /providerRequestId: _providerRequestId/);
  assert.doesNotMatch(
    read("components/ugc-video-studio/ugc-video-studio-workspace.tsx"),
    /estimateSeedanceMaximumCostUsd|estimateKlingMotionMaximumCostUsd/,
  );
});

test("legacy internal APIs remain customer-forbidden and result import is account-scoped", () => {
  const routing = read("lib/auth/routing.ts");
  const libraryImport = read("app/api/xeriano/library/import/route.ts");
  assert.match(routing, /api_forbidden/);
  assert.doesNotMatch(routing, /api\/image.*allow|api\/video.*allow/);
  assert.match(libraryImport, /requireXerianoAccount/);
  assert.match(libraryImport, /workspaceId: context\.workspaceKey/);
  assert.match(libraryImport, /accounts\/\$\{context\.accountId\}/);
  assert.doesNotMatch(libraryImport, /formData.*account|body.*accountId/);
});
