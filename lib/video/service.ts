import { createHash, randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { buildVideoStudioPersonaHandoff } from "@/lib/persona/future/video-studio-hooks";
import {
  traceBrandModelContract,
  type BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import {
  productProductionBindingV2Schema,
  type ProductProfile,
} from "@/lib/product-library/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import type { MasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/repository";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { fingerprintVideoInput } from "./fingerprint";
import { DeterministicFakeVideoProvider } from "./fake-provider";
import type { VideoProvider } from "./provider";
import {
  SupabaseApprovedImageSourceRepository,
  assertApprovedImageLineage,
  type ApprovedImageSourceRepository,
} from "./approved-image-source";
import type { VideoRepository } from "./repository";
import {
  videoAssetSchema,
  videoBrandModelEligibilitySchema,
  videoDirectionSchema,
  videoGenerationInputV1Schema,
  videoJobSchema,
  videoProjectSchema,
  videoReviewChecklistSchema,
  type VideoGenerationInputV1,
  type VideoJob,
} from "./types";

export type PrepareVideoRequest = {
  projectName: string;
  brandModelTrace: BrandModelTrace;
  artworkId: string;
  productProfileId: string;
  productProfileVersion: number;
  variantId: string;
  sourceImageAssetId: string;
  productionMode: "IMAGE_TO_VIDEO_APPROVED_ASSET";
  direction: unknown;
};
type D = {
  repository: VideoRepository;
  artworks: MasterArtworkAuthorityRepository;
  products: ProductProfileRepository;
  sources: ApprovedImageSourceRepository;
  resolvePersona: typeof buildVideoStudioPersonaHandoff;
  provider: VideoProvider;
  persist: (input: {
    workspaceId: string;
    path: string;
    bytes: Buffer;
    mimeType: string;
  }) => Promise<void>;
  now: () => string;
  id: () => string;
};
function requireActor(
  scope: WorkspaceScope,
): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId)
    throw new PersonaDomainError(
      "Authentifizierter Owner erforderlich.",
      "AUTHENTICATION_REQUIRED",
    );
}
function deterministicProjectId(parts: string[]) {
  const hex = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16]!, 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function visualInput(profile: ProductProfile, variantId: string) {
  const variant = profile.variants.find((v) => v.variantId === variantId);
  if (!variant)
    throw new PersonaDomainError(
      "Die Produktvariante existiert nicht in dieser Profilversion.",
      "WORKFLOW",
    );
  if (
    !profile.references.length ||
    profile.references.some(
      (r) => !r.privateStoragePath || !r.contentChecksumSha256,
    )
  )
    throw new PersonaDomainError(
      "Eingefrorene Produktreferenzen sind für Video erforderlich.",
      "WORKFLOW",
    );
  return productVisualInputSchema.parse({
    contractVersion: "product-visual-input-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    status: profile.status,
    productType: profile.productType,
    sourceContext: profile.sourceContext,
    shopifyProductId: profile.shopifyProductId,
    variantId,
    color: variant.color,
    size: variant.size,
    material:
      profile.construction.primaryMaterial ?? profile.construction.material,
    gsm: profile.construction.gsm,
    fit: profile.construction.fit,
    construction: profile.construction,
    referencePackage: {
      schemaVersion: "product-reference-package-v1",
      packageId: `${profile.productProfileId}:v${profile.version}`,
      authority: profile.authority,
      productProfileId: profile.productProfileId,
      shopifyProductId: profile.shopifyProductId,
      productVersion: profile.provenance.sourceVersion,
      references: profile.references,
      capturedAt: profile.provenance.capturedAt,
      provenance: profile.provenance.source,
    },
  });
}
export async function prepareVideoJob(
  scope: WorkspaceScope,
  request: PrepareVideoRequest,
  d: D,
): Promise<VideoJob> {
  requireActor(scope);
  const direction = videoDirectionSchema.parse(request.direction);
  const handoff = await d.resolvePersona(
    scope,
    request.brandModelTrace.personaId,
    {
      expectedIdentity: {
        identityLockSnapshotId: request.brandModelTrace.identityLockSnapshotId,
        identityLockVersion: request.brandModelTrace.identityLockVersion,
        identityFingerprint: request.brandModelTrace.identityFingerprint,
      },
      resolveAssetAccess: false,
    },
  );
  const contract = handoff.contract;
  const trace = traceBrandModelContract(contract);
  if (!contract.eligibility.videoEligible)
    throw new PersonaDomainError(
      "Dieses Markenmodel ist noch nicht für Video freigegeben.",
      "BRAND_MODEL_INELIGIBLE",
      { blockers: contract.eligibility.videoBlockingReasons },
    );
  const eligibility = videoBrandModelEligibilitySchema.parse({
    personaId: contract.personaId,
    brandModelId: contract.brandModelId,
    lockVersion: trace.identityLockVersion,
    identityFingerprint: trace.identityFingerprint,
    identityLocked: contract.eligibility.identityLocked,
    videoIdentityReady: contract.eligibility.videoIdentityReady,
    videoUseApproved: contract.eligibility.videoUseApproved,
    referenceRightsConfirmed: contract.eligibility.referenceRightsConfirmed,
    eligible: contract.eligibility.videoEligible,
    blockers: contract.eligibility.videoBlockingReasons,
  });
  const artwork = await d.artworks.get(scope, request.artworkId);
  if (!artwork || artwork.status !== "APPROVED")
    throw new PersonaDomainError(
      "Freigegebenes Artwork nicht gefunden.",
      "NOT_FOUND",
    );
  const profile = await d.products.getVersion(
    scope,
    request.productProfileId,
    request.productProfileVersion,
  );
  if (
    !profile ||
    !["SHOPIFY_LIVE", "MANUAL_PROFILE"].includes(profile.authority)
  )
    throw new PersonaDomainError(
      "Produktprofilversion nicht gefunden.",
      "NOT_FOUND",
    );
  const variant = profile.variants.find(
    (v) => v.variantId === request.variantId,
  );
  if (!variant)
    throw new PersonaDomainError(
      "Genaue Produktvariante erforderlich.",
      "WORKFLOW",
    );
  const source = await d.sources.getApproved(scope, request.sourceImageAssetId);
  if (!source)
    throw new PersonaDomainError(
      "Freigegebenes Image-Ausgangsbild nicht gefunden.",
      "NOT_FOUND",
    );
  assertApprovedImageLineage(source, {
    workspaceId: scope.workspaceId,
    brandModelId: trace.brandModelId,
    identityFingerprint: trace.identityFingerprint,
    artworkId: artwork.id,
    artworkChecksum: artwork.checksum,
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    variantId: variant.variantId,
  });
  const now = d.now();
  const projectId = deterministicProjectId([
    scope.workspaceId,
    request.projectName,
    trace.brandModelId,
    artwork.id,
    profile.productProfileId,
    source.sourceAssetId,
  ]);
  const product = productProductionBindingV2Schema.parse({
    version: "product-production-binding-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    shopifyProductId: profile.shopifyProductId,
    variantId: variant.variantId,
    productName: profile.name,
    productType: profile.productType,
    color: variant.color,
    size: variant.size,
    material:
      profile.construction.primaryMaterial ?? profile.construction.material,
    fit: profile.construction.fit,
    collection: profile.collections[0] ?? null,
    availability:
      variant.available == null
        ? "UNKNOWN"
        : variant.available
          ? "AVAILABLE"
          : "UNAVAILABLE",
    active: variant.active,
    sourceContext: profile.sourceContext,
    provenance: profile.provenance,
  });
  const snapshot: VideoGenerationInputV1 = videoGenerationInputV1Schema.parse({
    version: "video-generation-input-v1",
    workspaceId: scope.workspaceId,
    productionMode: request.productionMode,
    persona: { trace, displayName: contract.displayName, eligibility },
    product,
    productVisualInput: visualInput(profile, variant.variantId),
    artwork: {
      artworkId: artwork.id,
      designId: artwork.designId,
      version: artwork.version,
      checksum: artwork.checksum,
      mimeType: artwork.mimeType,
      byteLength: artwork.byteLength,
      sourceType: artwork.sourceType,
      approvalStatus: "APPROVED",
      sourceReportId: artwork.sourceReportId,
      sourceHandoffAt: artwork.sourceHandoffAt,
      placement: artwork.placement,
      printMethod: artwork.printMethod,
      provenance: "DESIGN_STUDIO_DURABLE",
    },
    sourceVisual: source,
    direction,
    production: {
      projectId,
      projectVersion: 1,
      shotId: `video-shot-${d.id()}`,
    },
    provider: {
      provider: "nexhq-synthetic-video-v1",
      model: "metadata-fixture-v1",
      executionMode: "FAKE",
      assetCount: 1,
      sourceStrategy: "APPROVED_IMAGE_TO_VIDEO",
      identityStrategy: "APPROVED_IMAGE_PLUS_PERSONA_TRACE",
      productStrategy: "FROZEN_PRODUCT_REFERENCES",
      artworkStrategy: "SOURCE_IMAGE_ONLY_NO_REDRAW_GUARANTEE",
    },
  });
  await d.repository.createProject(
    scope,
    videoProjectSchema.parse({
      id: projectId,
      workspaceId: scope.workspaceId,
      version: 1,
      name: request.projectName,
      status: "READY",
      currentSnapshot: null,
      createdBy: scope.actorId,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const estimate = await d.provider.estimate(snapshot);
  const fingerprint = fingerprintVideoInput(snapshot);
  return d.repository.createJob(
    scope,
    videoJobSchema.parse({
      id: d.id(),
      workspaceId: scope.workspaceId,
      projectId,
      createdBy: scope.actorId,
      inputSnapshot: snapshot,
      inputFingerprint: fingerprint,
      estimate,
      status: "awaiting_confirmation",
      confirmationExpiresAt: new Date(
        new Date(now).getTime() + 30 * 60 * 1000,
      ).toISOString(),
      confirmedBy: null,
      confirmedAt: null,
      attemptCount: 0,
      providerRequestId: null,
      resultAssetId: null,
      failureCode: null,
      failureMessage: null,
      safeRetryAllowed: false,
      unknownOutcomeReason: null,
      createdAt: now,
      updatedAt: now,
    }),
  );
}
export async function confirmVideoJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  d: Pick<D, "repository" | "now">,
) {
  requireActor(scope);
  return d.repository.confirm(scope, jobId, fingerprint, d.now());
}
export async function cancelVideoJob(
  scope: WorkspaceScope,
  jobId: string,
  d: Pick<D, "repository" | "now">,
) {
  requireActor(scope);
  return d.repository.cancel(scope, jobId, d.now());
}
export async function executeFakeVideoJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  d: Pick<D, "repository" | "provider" | "persist" | "now" | "id">,
) {
  requireActor(scope);
  if (!(d.provider instanceof DeterministicFakeVideoProvider))
    throw new PersonaDomainError(
      "Nur der synthetische Video-Provider ist in diesem Meilenstein zulässig.",
      "WORKFLOW",
    );
  const claimed = await d.repository.claim(scope, jobId, fingerprint, d.now());
  if (!claimed)
    throw new PersonaDomainError(
      "Video-Auftrag ist nicht bestätigt, abgelaufen oder bereits beansprucht.",
      "WORKFLOW",
    );
  try {
    const out = await d.provider.generate(claimed.inputSnapshot);
    const path = `workspace/${scope.workspaceId}/video-production/${jobId}/${out.checksum}.json`;
    await d.persist({
      workspaceId: scope.workspaceId,
      path,
      bytes: out.bytes,
      mimeType: out.mimeType,
    });
    const now = d.now();
    const asset = videoAssetSchema.parse({
      id: d.id(),
      workspaceId: scope.workspaceId,
      projectId: claimed.projectId,
      jobId: claimed.id,
      inputFingerprint: claimed.inputFingerprint,
      storagePath: path,
      checksum: out.checksum,
      mimeType: out.mimeType,
      provider: claimed.inputSnapshot.provider.provider,
      model: claimed.inputSnapshot.provider.model,
      providerRequestId: out.providerRequestId,
      sourceImageAssetId: claimed.inputSnapshot.sourceVisual.sourceAssetId,
      durationSeconds: claimed.inputSnapshot.direction.durationSeconds,
      aspectRatio: claimed.inputSnapshot.direction.aspectRatio,
      width: out.width,
      height: out.height,
      codec: out.codec,
      container: out.container,
      provenance: {
        ...out.provenance,
        persona: claimed.inputSnapshot.persona.trace,
        product: claimed.inputSnapshot.product,
        artwork: claimed.inputSnapshot.artwork,
        sourceVisual: claimed.inputSnapshot.sourceVisual,
        direction: claimed.inputSnapshot.direction,
      },
      reviewStatus: "REVIEW_REQUIRED",
      reviewChecklist: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    });
    return d.repository.finish(scope, jobId, asset, now);
  } catch (error) {
    await d.repository.markUnknown(
      scope,
      jobId,
      "Ausführung wurde beansprucht, aber kein eindeutig persistiertes Ergebnis bestätigt. Kein Blind-Retry.",
      d.now(),
    );
    throw error;
  }
}
export async function recoverVideoJob(
  scope: WorkspaceScope,
  jobId: string,
  repository: VideoRepository,
) {
  const job = await repository.getJob(scope, jobId);
  if (!job)
    throw new PersonaDomainError("Video-Auftrag nicht gefunden.", "NOT_FOUND");
  return {
    job,
    asset: await repository.getAssetByJob(scope, jobId),
    state:
      job.status === "succeeded" ? "REVIEW_REQUIRED" : job.status.toUpperCase(),
  };
}
export async function reviewVideoAsset(
  scope: WorkspaceScope,
  assetId: string,
  input: {
    decision: "APPROVED" | "REJECTED";
    checklist: unknown;
    note: string | null;
  },
  repository: VideoRepository,
  now: () => string,
) {
  requireActor(scope);
  return repository.review(
    scope,
    assetId,
    {
      decision: input.decision,
      checklist: videoReviewChecklistSchema.parse(input.checklist),
      note: input.note,
    },
    now(),
  );
}
export function defaultVideoDependencies(
  repository: VideoRepository,
  persist: D["persist"],
): D {
  return {
    repository,
    artworks: new SupabaseMasterArtworkAuthorityRepository(),
    products: new SupabaseProductProfileRepository(),
    sources: new SupabaseApprovedImageSourceRepository(),
    resolvePersona: buildVideoStudioPersonaHandoff,
    provider: new DeterministicFakeVideoProvider(),
    persist,
    now: () => new Date().toISOString(),
    id: randomUUID,
  };
}
