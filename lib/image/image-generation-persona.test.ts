import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { BrainImageSections, BrainReportContent } from "@/brain/domains/reports";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewChecklist,
} from "@/lib/persona/domain/creation-types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { MemoryPersonaRepository } from "@/lib/persona/repositories/memory-persona-repository";
import { setPersonaRepositoryForTests } from "@/lib/persona/repositories/factory";
import { MemoryCreationRepository } from "@/lib/persona/creation/memory-creation-repository";
import { setCreationRepositoryForTests } from "@/lib/persona/creation/creation-factory";
import { buildMasterIdentityNotes } from "@/lib/persona/creation/master-identity-reference";
import { buildReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";
import {
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
} from "@/lib/persona/creation/reference-package/repository";
import { REFERENCE_PACKAGE_SLOTS } from "@/lib/persona/creation/reference-package/slots";
import {
  MemoryIdentityLockRepository,
  lockBrandIdentity,
  setIdentityLockRepositoryForTests,
} from "@/lib/persona/creation/identity-lock";
import {
  MemoryReferenceRightsEvidenceRepository,
  setReferenceRightsEvidenceRepositoryForTests,
} from "@/lib/persona/creation/reference-rights";
import {
  buildImageStudioPersonaHandoff,
} from "@/lib/persona/future/image-studio-hooks";
import {
  createImageBrandModelProductionContext,
} from "@/lib/image/brand-model-production-context";
import {
  resolveBrandModelGenerationIdentity,
} from "@/lib/image/resolve-brand-model-generation-identity";
import { imageGenerateRequestSchema } from "@/agents/image/types-generation";
import {
  buildOpenAiIdentityConditionedPrompt,
  generateOpenAiImage,
} from "@/agents/image/providers/openai-images-provider";
import type { OpenAiIdentityEditRequest } from "@/agents/image/providers/openai-images-edit-provider";
import {
  getImageProviderIdentityStrategy,
} from "@/agents/image/providers/registry";
import { generateImageAsset } from "@/agents/image/generate";
import type { ImageGenerationDependencies } from "@/agents/image/generate";
import type { ImageStudioAsset } from "@/agents/image/studio-schema";
import {
  assertImagePaidGenerationEnabled,
  ImagePaidGenerationSafetyError,
} from "@/lib/image/image-paid-generation-guard";
import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import type { ImageGenerationInputSnapshot } from "@/lib/image/paid-generation/types";

const WS = "workspace-image-identity";
const ACTOR = "owner-image-identity";
const scope: WorkspaceScope = { workspaceId: WS, actorId: ACTOR };

function checklist(): IdentityReviewChecklist {
  return Object.fromEntries(
    IDENTITY_REVIEW_CHECK_KEYS.map((key) => [
      key,
      key === "suitable_for_video_generation" ? false : true,
    ]),
  ) as IdentityReviewChecklist;
}

function makeAsset(trace?: ReturnType<typeof createImageBrandModelProductionContext>["trace"]): ImageStudioAsset {
  const prompt = "Premium fashion campaign portrait with controlled lighting, garment detail, realistic skin texture, and editorial urban direction.";
  return {
    id: "asset-hero",
    assetType: "hero_image",
    outputCategory: "editorial_campaign",
    productName: "Faith Oversized Tee",
    collection: "Love Story",
    color: "Cream",
    material: "Cotton",
    location: "Concrete rooftop at dusk",
    lighting: "Soft key light with restrained rim",
    photographyStyle: "Premium editorial streetwear photography",
    cameraStyle: "Full-frame 50mm portrait",
    prompt: { openai: prompt, flux: prompt, midjourney: prompt },
    priority: "hero",
    status: "pending",
    title: "Campaign Hero",
    dimensions: "1024x1536",
    ...(trace ? { brandModelTrace: trace } : {}),
  };
}

describe("Image generation consumes canonical Persona identity", () => {
  let personaRepo: MemoryPersonaRepository;
  let creationRepo: MemoryCreationRepository;
  let packageRepo: MemoryReferencePackageRepository;
  let lockRepo: MemoryIdentityLockRepository;

  beforeEach(() => {
    personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    packageRepo = new MemoryReferencePackageRepository();
    lockRepo = new MemoryIdentityLockRepository();
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
    setReferencePackageRepositoryForTests(packageRepo);
    setIdentityLockRepositoryForTests(lockRepo);
    setReferenceRightsEvidenceRepositoryForTests(
      new MemoryReferenceRightsEvidenceRepository(),
    );
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
    setIdentityLockRepositoryForTests(null);
    setReferenceRightsEvidenceRepositoryForTests(null);
  });

  async function seedEligibleImageModel() {
    const persona = await personaRepo.createPersona(scope, {
      name: "North African Street Premium",
      role: "primary_male",
      status: "Approved",
      gender: "male",
      age_range: "22-25",
      height: "180",
      body_type: "lean",
      skin_tone: "medium",
      hair: "short dark hair",
      beard: "trimmed beard",
      eye_color: "brown",
      expression: "calm",
      personality: "confident",
      style: "street premium",
      notes: "generation identity regression fixture",
      canonical_identity_description: "North African male with stable facial geometry and medium skin tone.",
      immutable_features: "Preserve facial geometry, skin tone, eye shape, and trimmed beard.",
      prohibited_changes: "No identity substitution, age shift, or facial-hair removal.",
      approved_hair_variations: "Short dark styles only.",
      approved_expression_range: "Neutral to subtle confident smile.",
      approved_body_proportions: "Lean athletic frame.",
      approved_age_range: "22-25",
      default_styling: "Premium streetwear.",
      brand_fit_score: 95,
      identity_lock_status: "collecting_references",
      image_identity_ready: true,
      video_identity_ready: false,
      image_use_approved: true,
      image_use_approved_at: "2026-08-13T17:42:52.534Z",
      image_use_approved_by: ACTOR,
      video_use_approved: false,
      brand_cast_approved: true,
      brand_cast_approved_at: "2026-08-13T17:43:36.043Z",
      brand_cast_approved_by: ACTOR,
    });
    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/personas/${persona.id}/master.png`,
      mime_type: "image/png",
      width: 1024,
      height: 1024,
      file_size_bytes: 128,
      checksum: "master-generation-checksum",
      status: "uploaded",
      is_primary: true,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: true,
      notes: buildMasterIdentityNotes({
        version: 1,
        source: "selected_candidate",
        reference_type: "identity_master",
        primary_identity_reference: true,
        immutable_source_reference: true,
        original_provider: "openai",
        source_candidate_id: "candidate-generation",
        source_candidate_asset_id: "candidate-asset-generation",
        source_creation_project_id: "project-generation",
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, persona.id, {
      primary_reference_asset_id: master.id,
    });
    const session = await packageRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "generation-fixture-token",
      estimate_hash: "generation-fixture-hash",
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });
    const supporting = [];
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const attempt = await packageRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      const reference = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: slot.includes("profile")
          ? "profile"
          : slot.includes("three_quarter")
            ? "three_quarter"
            : "portrait",
        storage_path: `workspace/${WS}/personas/${persona.id}/${slot}.png`,
        mime_type: "image/png",
        width: 1024,
        height: 1024,
        file_size_bytes: 128,
        checksum: `generation-${slot}-checksum`,
        status: "approved",
        is_primary: false,
        view_angle: slot,
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: attempt.id,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      supporting.push({ slot, reference });
      await packageRepo.updateAttempt(scope, attempt.id, {
        generated_asset_id: reference.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }
    await creationRepo.createIdentityReview(scope, {
      persona_id: persona.id,
      checklist: checklist(),
      all_passed: false,
      reviewer_notes: "Image approved; Video intentionally independent.",
    });
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    const handoff = await buildImageStudioPersonaHandoff(scope, persona.id);
    const context = createImageBrandModelProductionContext(handoff);
    return { persona, master, supporting, locked: locked.snapshot, handoff, context };
  }

  it("resolves the exact authoritative Master and canonical 5/5 from one lock", async () => {
    const fixture = await seedEligibleImageModel();
    const masterBytes = Buffer.from("authoritative-master-bytes");
    const resolved = await resolveBrandModelGenerationIdentity(
      scope,
      fixture.context.trace,
      {
        downloadMasterBytes: async (request) => {
          assert.equal(request.workspaceId, WS);
          assert.equal(request.storagePath, fixture.master.storage_path);
          assert.equal(request.expectedChecksum, fixture.master.checksum);
          return masterBytes;
        },
      },
    );
    assert.equal(resolved.masterReference.assetId, fixture.master.id);
    assert.equal(resolved.masterReference.bytes, masterBytes);
    assert.deepEqual(
      resolved.supportingReferences.map((entry) => entry.assetId),
      fixture.supporting.map((entry) => entry.reference.id),
    );
    assert.equal(resolved.trace.brandModel.identityLockSnapshotId, fixture.locked.id);
    assert.equal(
      resolved.trace.brandModel.identityLockVersion,
      fixture.locked.identity_lock_version,
    );
    assert.ok(resolved.trace.referencePackageVersion);
    assert.equal(fixture.persona.video_use_approved, false);
    assert.doesNotMatch(JSON.stringify(resolved.trace), /storage_path|signed|https?:\/\//i);
  });

  it("fails closed for unconfirmed rights", async () => {
    const fixture = await seedEligibleImageModel();
    await personaRepo.updateReferenceAsset(scope, fixture.master.id, {
      rights_confirmed: false,
    });
    await assert.rejects(
      () => resolveBrandModelGenerationIdentity(scope, fixture.context.trace),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_INELIGIBLE",
    );
  });

  it("rejects stale lock version and wrong identity/reference fingerprints", async () => {
    const fixture = await seedEligibleImageModel();
    for (const trace of [
      { ...fixture.context.trace, identityLockVersion: 99 },
      { ...fixture.context.trace, identityFingerprint: "wrong-fingerprint" },
      { ...fixture.context.trace, referencePackageVersion: "wrong-version" },
      { ...fixture.context.trace, referencePackageFingerprint: "wrong-package" },
    ]) {
      await assert.rejects(
        () => resolveBrandModelGenerationIdentity(scope, trace),
        (error: unknown) =>
          error instanceof PersonaDomainError &&
          error.code === "BRAND_MODEL_VERSION_MISMATCH",
      );
    }
  });

  it("fails if the current lock advances while private Master bytes resolve", async () => {
    const fixture = await seedEligibleImageModel();
    await assert.rejects(
      () =>
        resolveBrandModelGenerationIdentity(scope, fixture.context.trace, {
          downloadMasterBytes: async () => {
            await personaRepo.updatePersona(scope, fixture.persona.id, {
              identity_lock_version:
                fixture.locked.identity_lock_version + 1,
            });
            return Buffer.from("now-stale-master");
          },
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_VERSION_MISMATCH",
    );
  });

  it("rejects cross-workspace generation identity resolution", async () => {
    const fixture = await seedEligibleImageModel();
    await assert.rejects(
      () =>
        resolveBrandModelGenerationIdentity(
          { workspaceId: "another-workspace", actorId: ACTOR },
          fixture.context.trace,
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "UNAUTHORIZED_WORKSPACE",
    );
  });

  it("rejects rejected, archived, or superseded locked references", async () => {
    for (const status of ["rejected", "archived", "superseded"] as const) {
      const fixture = await seedEligibleImageModel();
      await personaRepo.updateReferenceAsset(
        scope,
        fixture.supporting[0].reference.id,
        { status },
      );
      await assert.rejects(
        () => resolveBrandModelGenerationIdentity(scope, fixture.context.trace),
        /cannot be used for generation/i,
      );
    }
  });

  it("rejects reference metadata that no longer matches the immutable snapshot", async () => {
    const fixture = await seedEligibleImageModel();
    await personaRepo.updateReferenceAsset(
      scope,
      fixture.supporting[0].reference.id,
      { checksum: "mutated-after-lock" },
    );
    await assert.rejects(
      () => resolveBrandModelGenerationIdentity(scope, fixture.context.trace),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_VERSION_MISMATCH",
    );
  });

  it("accepts only safe browser trace IDs and rejects paths or signed URLs", async () => {
    const fixture = await seedEligibleImageModel();
    const base = {
      reportRecordId: randomUUID(),
      reportId: randomUUID(),
      assetId: "asset-hero",
      provider: "openai" as const,
      promptVariant: "openai" as const,
      brandModelTrace: fixture.context.trace,
    };
    assert.equal(imageGenerateRequestSchema.safeParse(base).success, true);
    assert.equal(
      imageGenerateRequestSchema.safeParse({
        ...base,
        storagePath: "workspace/attacker/master.png",
      }).success,
      false,
    );
    assert.equal(
      imageGenerateRequestSchema.safeParse({
        ...base,
        signedUrl: "https://example.test/private?token=attacker",
      }).success,
      false,
    );
  });

  it("OpenAI uses only Master bytes as authoritative high-fidelity identity input", async () => {
    const fixture = await seedEligibleImageModel();
    const identity = await resolveBrandModelGenerationIdentity(
      scope,
      fixture.context.trace,
      { downloadMasterBytes: async () => Buffer.from("master-only") },
    );
    const editInputs: OpenAiIdentityEditRequest[] = [];
    const result = await generateOpenAiImage(
      {
        prompt: "Campaign scene with cream tee on a concrete rooftop.",
        dimensions: "1024x1536",
        assetType: "hero_image",
        identity,
      },
      {
        editFromMaster: async (request) => {
          editInputs.push(request);
          return {
            prompt: request.prompt,
            status: "completed",
            providerId: "openai",
            imageBytes: Buffer.from("fake-output"),
            providerRequestId: "fake-provider-request",
            path: "openai.images.edit(gpt-image-1, image=master, input_fidelity=high)",
            inputFidelity: "high",
          };
        },
      },
    );
    assert.equal(editInputs.length, 1);
    const editInput = editInputs[0]!;
    assert.equal(editInput.referenceImageBytes.toString(), "master-only");
    assert.match(editInput.prompt, /first and only identity reference/i);
    assert.match(editInput.prompt, /same person/i);
    assert.equal(identity.supportingReferences.length, 5);
    assert.equal(result.identityStrategy, "openai_master_image_edit_high_fidelity");
    assert.equal(result.providerRequestId, "fake-provider-request");
  });

  it("never falls back to text-only Flux for a selected Brand Model", () => {
    assert.throws(
      () => getImageProviderIdentityStrategy("flux", true),
      /text-only/i,
    );
  });

  it("persists exact identity/provider lineage without private access", async () => {
    const fixture = await seedEligibleImageModel();
    const identity = await resolveBrandModelGenerationIdentity(
      scope,
      fixture.context.trace,
      { downloadMasterBytes: async () => Buffer.from("master-for-provider") },
    );
    const reportRecordId = randomUUID();
    const reportId = randomUUID();
    const artworkChecksum = "a".repeat(64);
    let sections: BrainImageSections = {
      schemaVersion: "3.0",
      projectName: "Identity Campaign",
      collectionName: "Love Story",
      moodboard: {
        visualDirection: "Premium urban campaign",
        aestheticKeywords: [],
        colorSystem: [],
        materialReferences: [],
        photographyStyle: "Editorial",
      },
      productionAssets: [makeAsset(fixture.context.trace)],
      brandModelContract: fixture.context.contract,
    };
    const record = (): BrainReportContent => ({
      kind: "reports",
      reportId,
      taskId: randomUUID(),
      agentId: "image",
      status: "submitted",
      summary: "Identity campaign",
      confidence: 1,
      reportType: "image-project",
      imageSections: sections,
      notes: "test",
      artifacts: [],
    });
    let providerCalls = 0;
    const deps: Partial<ImageGenerationDependencies> = {
      assertExecutionAllowed: () => {},
      allowTestOnlyUnconfirmedExecution: true,
      isProviderConfigured: () => true,
      loadReport: async () => ({
        id: reportRecordId,
        workspaceId: WS,
        content: record(),
      }),
      updateSections: async (_id, next) => {
        sections = next;
      },
      resolveIdentity: async () => identity,
      getProviderModel: () => "gpt-image-1",
      getIdentityStrategy: () => "openai_master_identity_and_artwork_edit_high_fidelity",
      operationId: () => "11111111-1111-4111-8111-111111111111",
      now: (() => {
        let call = 0;
        return () =>
          call++ === 0
            ? "2026-08-17T00:00:00.000Z"
            : "2026-08-17T00:00:01.000Z";
      })(),
      generateProvider: async (_provider, request) => {
        providerCalls += 1;
        assert.equal(request.identity?.masterReference.assetId, fixture.master.id);
        assert.equal(request.identity?.supportingReferences.length, 5);
        assert.equal(request.artwork?.bytes.toString(), "approved-artwork");
        return {
          prompt: request.prompt,
          dimensions: request.dimensions,
          assetType: request.assetType,
          status: "completed",
          providerId: "openai",
          modelId: "gpt-image-1",
          providerRequestId: "provider-request-123",
          identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
          imageBytes: Buffer.from("fake-generated-image"),
        };
      },
      upload: async () => ({
        storagePath: `workspace/${WS}/reports/${reportId}/generated.png`,
        url: "https://temporary-output.example/generated.png",
      }),
    };
    const snapshot: ImageGenerationInputSnapshot = {
      version: "image-generation-input-v1",
      workspaceId: WS,
      brandModel: { ...fixture.context.trace, displayName: fixture.persona.name, masterIdentityAssetId: fixture.master.id },
      masterArtwork: { artworkId: "11111111-1111-4111-8111-111111111111", designId: "design-test", version: "V1", checksum: artworkChecksum, mimeType: "image/png", byteLength: 16, sourceType: "uploaded", approvalStatus: "APPROVED", sourceReportId: "design-report", sourceHandoffAt: "2026-08-17T00:00:00Z", placement: "center chest", printMethod: "screen print", provenance: "DESIGN_STUDIO_DURABLE" },
      product: { version: "product-production-context-v1", productId: null, variantId: null, productName: "Faith Oversized Tee", productType: "tee", color: "Cream", size: null, material: "Cotton", fit: "oversized", collection: "Milaene", availability: "UNKNOWN", active: null, authority: "DESIGN_HANDOFF_LOCAL", authoritative: false, provenance: { source: "test handoff", sourceRecordId: null, capturedAt: "2026-08-17T00:00:00.000Z", sourceVersion: "V1" } },
      production: { projectId: "33333333-3333-4333-8333-333333333333", projectVersion: 1, reportRecordId, reportId, projectName: "Identity Campaign", assetId: "asset-hero", assetType: "hero_image", shotTitle: "Campaign Hero", prompt: makeAsset().prompt.openai, scene: "Concrete rooftop at dusk", lighting: "Soft key light with restrained rim", poseDirection: "Premium editorial streetwear photography", provider: "openai", model: "gpt-image-1", dimensions: "1024x1536", quality: "high", identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity", artworkStrategy: "openai_secondary_master_artwork_reference" },
    };
    const inputFingerprint = fingerprintImageGenerationInput(snapshot);
    const result = await generateImageAsset(
      {
        scope,
        request: {
          reportRecordId,
          reportId,
          assetId: "asset-hero",
          provider: "openai",
          promptVariant: "openai",
          brandModelTrace: fixture.context.trace,
        },
        paidExecution: {
          jobId: "22222222-2222-4222-8222-222222222222",
          inputFingerprint,
          snapshot,
          artwork: { artworkId: "11111111-1111-4111-8111-111111111111", designId: "design-test", version: "V1", checksum: artworkChecksum, mimeType: "image/png", bytes: Buffer.from("approved-artwork"), placement: "center chest" },
        },
      },
      deps,
    );
    assert.equal(providerCalls, 1);
    const provenance = result.asset.generationProvenance;
    assert.ok(provenance);
    assert.equal(provenance.identity?.masterIdentityAssetId, fixture.master.id);
    assert.equal(provenance.identity?.referencePackageVersion, fixture.locked.reference_package_version);
    assert.equal(provenance.providerRequestId, "provider-request-123");
    assert.equal(provenance.identityStrategy, "openai_master_identity_and_artwork_edit_high_fidelity");
    assert.equal(provenance.paidGeneration?.jobId, "22222222-2222-4222-8222-222222222222");
    assert.equal(provenance.paidGeneration?.inputFingerprint, inputFingerprint);
    assert.equal(provenance.paidGeneration?.masterArtwork.checksum, artworkChecksum);
    assert.equal(provenance.paidGeneration?.product.productName, "Faith Oversized Tee");
    assert.doesNotMatch(
      JSON.stringify(provenance),
      /storage_path|signedUrl|token=|master-for-provider/i,
    );
    assert.equal(
      sections.productionAssets?.[0].generationProvenance?.identity?.brandModel
        .identityLockVersion,
      fixture.locked.identity_lock_version,
    );
  });

  it("allows SHOPIFY_LIVE product truth to differ from mission plan labels during paid execution", async () => {
    const fixture = await seedEligibleImageModel();
    const identity = await resolveBrandModelGenerationIdentity(
      scope,
      fixture.context.trace,
      { downloadMasterBytes: async () => Buffer.from("master-for-provider") },
    );
    const reportRecordId = randomUUID();
    const reportId = randomUUID();
    const artworkChecksum = "b".repeat(64);
    const planAsset = makeAsset(fixture.context.trace);
    planAsset.productName = "Faith Mission Tee";
    planAsset.color = "Cream";
    const sections: BrainImageSections = {
      schemaVersion: "3.0",
      projectName: "Identity Campaign",
      collectionName: "Love Story",
      moodboard: {
        visualDirection: "Premium urban campaign",
        aestheticKeywords: [],
        colorSystem: [],
        materialReferences: [],
        photographyStyle: "Editorial",
      },
      productionAssets: [planAsset],
      brandModelContract: fixture.context.contract,
    };
    let providerCalls = 0;
    const snapshot: ImageGenerationInputSnapshot = {
      version: "image-generation-input-v1",
      workspaceId: WS,
      brandModel: {
        ...fixture.context.trace,
        displayName: fixture.persona.name,
        masterIdentityAssetId: fixture.master.id,
      },
      masterArtwork: {
        artworkId: "11111111-1111-4111-8111-111111111111",
        designId: "design-test",
        version: "V1",
        checksum: artworkChecksum,
        mimeType: "image/png",
        byteLength: 16,
        sourceType: "uploaded",
        approvalStatus: "APPROVED",
        sourceReportId: "design-report",
        sourceHandoffAt: "2026-08-17T00:00:00Z",
        placement: "center chest",
        printMethod: "screen print",
        provenance: "DESIGN_STUDIO_DURABLE",
      },
      product: {
        version: "product-production-context-v1",
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/2",
        productName: "CRUISING - Heavy Oversized Tee",
        productType: "tee",
        color: "Black",
        size: "L",
        material: "Cotton",
        fit: "oversized",
        collection: "Core",
        availability: "AVAILABLE",
        active: true,
        authority: "SHOPIFY_LIVE",
        authoritative: true,
        provenance: {
          source: "Shopify Admin GraphQL live read",
          sourceRecordId: "gid://shopify/ProductVariant/2",
          capturedAt: "2026-08-17T00:00:00.000Z",
          sourceVersion: "2026-08-17T00:00:00.000Z",
        },
      },
      production: {
        projectId: "33333333-3333-4333-8333-333333333333",
        projectVersion: 1,
        reportRecordId,
        reportId,
        projectName: "Identity Campaign",
        assetId: "asset-hero",
        assetType: "hero_image",
        shotTitle: "Campaign Hero",
        prompt: planAsset.prompt.openai,
        scene: "Concrete rooftop at dusk",
        lighting: "Soft key light with restrained rim",
        poseDirection: "Premium editorial streetwear photography",
        provider: "openai",
        model: "gpt-image-1",
        dimensions: "1024x1536",
        quality: "high",
        identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
        artworkStrategy: "openai_secondary_master_artwork_reference",
      },
    };
    const result = await generateImageAsset(
      {
        scope,
        request: {
          reportRecordId,
          reportId,
          assetId: "asset-hero",
          provider: "openai",
          promptVariant: "openai",
          brandModelTrace: fixture.context.trace,
        },
        paidExecution: {
          jobId: "22222222-2222-4222-8222-222222222222",
          inputFingerprint: fingerprintImageGenerationInput(snapshot),
          snapshot,
          artwork: {
            artworkId: "11111111-1111-4111-8111-111111111111",
            designId: "design-test",
            version: "V1",
            checksum: artworkChecksum,
            mimeType: "image/png",
            bytes: Buffer.from("approved-artwork"),
            placement: "center chest",
          },
        },
      },
      {
        assertExecutionAllowed: () => {},
        allowTestOnlyUnconfirmedExecution: true,
        isProviderConfigured: () => true,
        loadReport: async () => ({
          id: reportRecordId,
          workspaceId: WS,
          content: {
            kind: "reports",
            reportId,
            taskId: randomUUID(),
            agentId: "image",
            status: "submitted",
            summary: "Identity campaign",
            confidence: 1,
            reportType: "image-project",
            imageSections: sections,
            notes: "test",
            artifacts: [],
          },
        }),
        updateSections: async () => {},
        resolveIdentity: async () => identity,
        getProviderModel: () => "gpt-image-1",
        getIdentityStrategy: () => "openai_master_identity_and_artwork_edit_high_fidelity",
        operationId: () => "11111111-1111-4111-8111-111111111111",
        now: () => "2026-08-17T00:00:00.000Z",
        generateProvider: async () => {
          providerCalls += 1;
          return {
            prompt: "test",
            dimensions: "1024x1536",
            assetType: "hero_image",
            status: "completed",
            providerId: "openai",
            modelId: "gpt-image-1",
            providerRequestId: "provider-request-shopify",
            identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
            imageBytes: Buffer.from("fake-generated-image"),
          };
        },
        upload: async () => ({
          storagePath: `workspace/${WS}/reports/${reportId}/generated.png`,
          url: "https://temporary-output.example/generated.png",
        }),
      },
    );
    assert.equal(providerCalls, 1);
    assert.equal(result.asset.status, "completed");
  });

  it("rejects a mismatched browser/project trace before identity/provider execution", async () => {
    const fixture = await seedEligibleImageModel();
    const reportRecordId = randomUUID();
    const reportId = randomUUID();
    let providerCalls = 0;
    await assert.rejects(
      () =>
        generateImageAsset(
          {
            scope,
            request: {
              reportRecordId,
              reportId,
              assetId: "asset-hero",
              provider: "openai",
              promptVariant: "openai",
              brandModelTrace: {
                ...fixture.context.trace,
                identityFingerprint: "browser-injected-fingerprint",
              },
            },
          },
          {
            assertExecutionAllowed: () => {},
            allowTestOnlyUnconfirmedExecution: true,
            isProviderConfigured: () => true,
            loadReport: async () => ({
              id: reportRecordId,
              workspaceId: WS,
              content: {
                kind: "reports",
                reportId,
                taskId: randomUUID(),
                agentId: "image",
                status: "submitted",
                summary: "test",
                confidence: 1,
                reportType: "image-project",
                notes: "test",
                artifacts: [],
                imageSections: {
                  schemaVersion: "3.0",
                  projectName: "test",
                  moodboard: {
                    visualDirection: "test",
                    aestheticKeywords: [],
                    colorSystem: [],
                    materialReferences: [],
                    photographyStyle: "test",
                  },
                  productionAssets: [makeAsset(fixture.context.trace)],
                  brandModelContract: fixture.context.contract,
                },
              },
            }),
            generateProvider: async () => {
              providerCalls += 1;
              throw new Error("must not be called");
            },
          },
        ),
      /does not match the planned Image project/i,
    );
    assert.equal(providerCalls, 0);
  });

  it("preserves the intentional non-Persona generation seam", async () => {
    const reportRecordId = randomUUID();
    const reportId = randomUUID();
    let sections: BrainImageSections = {
      schemaVersion: "3.0",
      projectName: "Product-only campaign",
      moodboard: {
        visualDirection: "Product-only",
        aestheticKeywords: [],
        colorSystem: [],
        materialReferences: [],
        photographyStyle: "Studio",
      },
      productionAssets: [makeAsset()],
    };
    let receivedIdentity = true;
    const result = await generateImageAsset(
      {
        scope,
        request: {
          reportRecordId,
          reportId,
          assetId: "asset-hero",
          provider: "openai",
          promptVariant: "openai",
        },
      },
      {
        assertExecutionAllowed: () => {},
        allowTestOnlyUnconfirmedExecution: true,
        isProviderConfigured: () => true,
        loadReport: async () => ({
          id: reportRecordId,
          workspaceId: WS,
          content: {
            kind: "reports",
            reportId,
            taskId: randomUUID(),
            agentId: "image",
            status: "submitted",
            summary: "test",
            confidence: 1,
            reportType: "image-project",
            notes: "test",
            artifacts: [],
            imageSections: sections,
          },
        }),
        updateSections: async (_id, next) => {
          sections = next;
        },
        getProviderModel: () => "gpt-image-1",
        getIdentityStrategy: (_provider, hasIdentity) => {
          receivedIdentity = hasIdentity;
          return null;
        },
        operationId: () => "22222222-2222-4222-8222-222222222222",
        now: () => "2026-08-17T00:00:00.000Z",
        generateProvider: async (_provider, request) => ({
          prompt: request.prompt,
          dimensions: request.dimensions,
          assetType: request.assetType,
          status: "completed",
          providerId: "openai",
          modelId: "gpt-image-1",
          imageBytes: Buffer.from("non-persona-output"),
        }),
        upload: async () => ({
          storagePath: `workspace/${WS}/reports/${reportId}/non-persona.png`,
          url: "https://temporary-output.example/non-persona.png",
        }),
      },
    );
    assert.equal(receivedIdentity, false);
    assert.equal(result.asset.generationProvenance?.identity, null);
    assert.equal(result.asset.status, "completed");
  });

  it("defaults paid provider execution closed", () => {
    assert.throws(
      () => assertImagePaidGenerationEnabled({}),
      ImagePaidGenerationSafetyError,
    );
    assert.doesNotThrow(() =>
      assertImagePaidGenerationEnabled({
        NEXHQ_IMAGE_PAID_GENERATION_ENABLED: "true",
      }),
    );
  });

  it("keeps identity and garment/design concepts separate", async () => {
    const fixture = await seedEligibleImageModel();
    const identity = await resolveBrandModelGenerationIdentity(
      scope,
      fixture.context.trace,
      { downloadMasterBytes: async () => Buffer.from("master") },
    );
    const prompt = buildOpenAiIdentityConditionedPrompt({
      prompt: "Faith Oversized Tee in cream cotton on a concrete rooftop.",
      dimensions: "1024x1536",
      assetType: "hero_image",
      identity,
    });
    assert.match(prompt, /authoritative Master portrait/i);
    assert.match(prompt, /Faith Oversized Tee/i);
    assert.match(prompt, /scene, garment, pose, and lighting may change/i);
  });
});
