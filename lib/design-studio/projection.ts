import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { type DesignRun } from "@/lib/design-studio/contracts";
import { DESIGN_PROVIDER_COST_VERSION } from "@/lib/design-studio/pricing-config";
import { designJobManifestSchema } from "@/lib/design-studio/server-contracts";
import { DESIGN_STUDIO_BUCKET, sha256, SupabaseDesignJobStore, type DesignJobScope } from "@/lib/design-studio/server-storage";
import type { XerianoAccountContext } from "@/lib/xeriano/access-policy";
import type { XerianoGenerationAuthority } from "@/lib/xeriano/customer-generation";
import { XERIANO_ECONOMIC_POLICY } from "@/lib/xeriano/pricing-engine";
import { DESIGN_UTILITY_PRICING_VERSION, type DesignUtilityOperation } from "@/lib/design-studio/utility-config";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import { SVG_TO_PNG_OPERATION, SVG_TO_PNG_VERSION } from "@/lib/design-studio/svg-to-png";

const LIBRARY_BUCKET = "xeriano-library-assets";
function ext(mime: string) { return mime === "image/svg+xml" ? "svg" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png"; }

export async function recordDesignProviderCostEvent(input: {
  context: XerianoAccountContext;
  jobId: string;
  providerModel: string;
  providerRequestId: string;
  estimatedCostUsdMicros: number;
  authorityId?: string;
  occurredAt: string;
  operation?: "DESIGN_GENERATION" | DesignUtilityOperation;
  costVersion?: string;
}) {
  const operation = input.operation ?? "DESIGN_GENERATION";
  const written = await createAdminClient().from("xeriano_provider_cost_events").upsert({
    account_id: input.context.accountId,
    generation_authority_id: input.authorityId ?? null,
    job_id: input.jobId,
    provider: "fal",
    provider_model: input.providerModel,
    operation,
    subcall_key: operation === "DESIGN_GENERATION" ? "primary" : "derived",
    estimated_cost_micros: input.estimatedCostUsdMicros,
    actual_cost_micros: null,
    original_currency: "USD",
    provider_cost_version: input.costVersion ?? DESIGN_PROVIDER_COST_VERSION,
    fx_economic_version: XERIANO_ECONOMIC_POLICY.fx.USD_EUR.version,
    provider_request_id: input.providerRequestId,
    idempotency_key: `design:${input.context.accountId}:${input.jobId}:${operation.toLowerCase()}`,
    occurred_at: input.occurredAt,
    metadata: { studio: "DESIGN_STUDIO", pricingPolicy: XERIANO_ECONOMIC_POLICY.version },
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (written.error) throw written.error;
}

export async function persistDesignUtilityResult(input: {
  context: XerianoAccountContext;
  jobId: string;
  operation: DesignUtilityOperation | typeof SVG_TO_PNG_OPERATION;
  sourceAssetId: string;
  bytes: Buffer;
  authority?: XerianoGenerationAuthority;
  ownerPricingVersion?: string;
}) {
  const dimensions = await readRasterDimensions(input.bytes);
  const admin = createAdminClient();
  const resultId = randomUUID();
  const presentation = input.operation === "BACKGROUND_REMOVE"
    ? { label: "Freigestelltes Design", tag: "Hintergrund entfernt", prompt: "Hintergrund entfernen", model: "design-background-remove" }
    : input.operation === "UPSCALE"
      ? { label: "Hochskaliertes Design", tag: "4K Upscale", prompt: "Auf 4K upscalen", model: "design-upscale" }
      : { label: "PNG-Version", tag: "PNG-Version", prompt: "SVG als PNG rendern", model: "design-svg-to-png" };
  const contractVersion = input.operation === SVG_TO_PNG_OPERATION ? SVG_TO_PNG_VERSION : "xeriamo-design-utility-v1";
  const existing = await admin.from("xeriano_library_assets").select("id")
    .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
    .eq("source_job_id", input.jobId).eq("source_result_id", "derived").maybeSingle();
  if (existing.error) throw existing.error;
  let assetId = existing.data?.id as string | undefined;
  if (!assetId) {
    assetId = randomUUID();
    const storagePath = `accounts/${input.context.accountId}/generated/design_studio/${input.jobId}/${resultId}.png`;
    const uploaded = await admin.storage.from(LIBRARY_BUCKET).upload(storagePath, input.bytes, { contentType: "image/png", upsert: false });
    if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error;
    const inserted = await admin.from("xeriano_library_assets").insert({
      id: assetId, account_id: input.context.accountId, owner_user_id: input.context.userId,
      asset_type: "DESIGN", title: presentation.label, description: null, source_studio: "DESIGN_STUDIO",
      source_job_id: input.jobId, source_result_id: "derived", storage_bucket: LIBRARY_BUCKET,
      storage_path: storagePath, mime_type: "image/png", byte_length: input.bytes.length,
      checksum_sha256: sha256(input.bytes), favorite: false,
      tags: [presentation.tag],
      provenance: {
        contractVersion, generated: true,
        derived_from_asset_id: input.sourceAssetId, operation: input.operation,
        width: dimensions.width, height: dimensions.height,
      },
    });
    if (inserted.error) throw inserted.error;
  }
  const creationFound = await admin.from("xeriano_creations").select("id")
    .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
    .eq("source_job_id", input.jobId).eq("source_result_id", "derived").maybeSingle();
  if (creationFound.error) throw creationFound.error;
  let creationId = creationFound.data?.id as string | undefined;
  if (!creationId) {
    creationId = randomUUID();
    const created = await admin.from("xeriano_creations").insert({
      id: creationId, account_id: input.context.accountId, actor_user_id: input.context.userId,
      library_asset_id: assetId, creation_type: "IMAGE", source_studio: "DESIGN_STUDIO",
      source_job_id: input.jobId, source_result_id: "derived",
      original_prompt: presentation.prompt,
      provider_prompt: null, model_id: presentation.model,
      settings: {
        contractVersion, utilityOperation: input.operation,
        derivedFromAssetId: input.sourceAssetId, width: dimensions.width, height: dimensions.height,
      },
      credit_cost: input.authority?.quotedCredits ?? 0,
      credit_pricing_version: input.authority?.pricingVersion ?? input.ownerPricingVersion
        ?? (input.operation === SVG_TO_PNG_OPERATION ? SVG_TO_PNG_VERSION : DESIGN_UTILITY_PRICING_VERSION),
      favorite: false, status: "SUCCEEDED", created_at: new Date().toISOString(),
    });
    if (created.error) throw created.error;
  }
  return { assetId, creationId, ...dimensions };
}

export async function finalizeDesignCreations(input: {
  context: XerianoAccountContext;
  scope: DesignJobScope;
  run: DesignRun;
  authority?: XerianoGenerationAuthority;
  ownerPricingVersion?: string;
}): Promise<DesignRun> {
  if (input.run.status !== "SUCCEEDED" && input.run.status !== "PARTIALLY_SUCCEEDED") return input.run;
  const admin = createAdminClient();
  const store = new SupabaseDesignJobStore();
  const manifest = await store.readManifest(input.scope, input.run.id);
  if (!manifest) throw new Error("DESIGN_MANIFEST_NOT_FOUND");
  if (manifest.providerRequestId) {
    await recordDesignProviderCostEvent({
      context: input.context,
      jobId: input.run.id,
      providerModel: manifest.providerModel,
      providerRequestId: manifest.providerRequestId,
      estimatedCostUsdMicros: manifest.estimatedCostUsdMicros,
      ...(input.authority ? { authorityId: input.authority.id } : {}),
      occurredAt: manifest.updatedAt,
    });
  }
  const mapped = [];
  for (const result of manifest.results) {
    const asset = await admin.from("xeriano_library_assets").select("id")
      .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
      .eq("source_job_id", input.run.id).eq("source_result_id", result.publicView.id).maybeSingle();
    if (asset.error) throw asset.error;
    let assetId = asset.data?.id as string | undefined;
    if (!assetId) {
      const stored = await store.readResult({ scope: input.scope, jobId: input.run.id, storagePath: result.storagePath });
      if (!stored) throw new Error("DESIGN_RESULT_NOT_FOUND");
      const storagePath = `accounts/${input.context.accountId}/generated/design_studio/${input.run.id}/${result.publicView.id}.${ext(result.publicView.mimeType)}`;
      const uploaded = await admin.storage.from(LIBRARY_BUCKET).upload(storagePath, stored.bytes, { contentType: result.publicView.mimeType, upsert: false });
      if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error;
      const inserted = await admin.from("xeriano_library_assets").insert({
        account_id: input.context.accountId, owner_user_id: input.context.userId,
        asset_type: "DESIGN", title: `Xeriamo Design · ${new Date(input.run.createdAt).toLocaleDateString("de-DE")}`,
        description: input.run.setup.prompt.slice(0, 2000), source_studio: "DESIGN_STUDIO",
        source_job_id: input.run.id, source_result_id: result.publicView.id,
        storage_bucket: LIBRARY_BUCKET, storage_path: storagePath, mime_type: result.publicView.mimeType,
        byte_length: stored.bytes.length, checksum_sha256: sha256(stored.bytes), favorite: false,
        tags: [input.run.setup.model === "IDEOGRAM_4" ? "Ideogram 4" : "Recraft 4"],
        provenance: {
          contractVersion: input.run.setup.contractVersion, generated: true,
          outputMode: input.run.setup.outputMode, resolution: result.publicView.resolution,
          width: result.publicView.width, height: result.publicView.height,
        },
      }).select("id").single();
      if (inserted.error) {
        const raced = await admin.from("xeriano_library_assets").select("id")
          .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
          .eq("source_job_id", input.run.id).eq("source_result_id", result.publicView.id).maybeSingle();
        if (!raced.data) throw inserted.error;
        assetId = raced.data.id;
      } else assetId = inserted.data.id;
    }
    const creation = await admin.from("xeriano_creations").select("id")
      .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
      .eq("source_job_id", input.run.id).eq("source_result_id", result.publicView.id).maybeSingle();
    if (creation.error) throw creation.error;
    let creationId = creation.data?.id as string | undefined;
    if (!creationId) {
      creationId = randomUUID();
      const inserted = await admin.from("xeriano_creations").insert({
        id: creationId, account_id: input.context.accountId, actor_user_id: input.context.userId,
        library_asset_id: assetId, creation_type: "IMAGE", source_studio: "DESIGN_STUDIO",
        source_job_id: input.run.id, source_result_id: result.publicView.id,
        original_prompt: input.run.setup.prompt, provider_prompt: manifest.providerPrompt,
        model_id: input.run.setup.model, settings: {
          contractVersion: input.run.setup.contractVersion, stylePreset: input.run.setup.stylePreset,
          outputMode: input.run.setup.outputMode, aspectRatio: input.run.setup.aspectRatio,
          quality: input.run.setup.quality, count: input.run.setup.count,
          resolution: result.publicView.resolution,
          width: result.publicView.width,
          height: result.publicView.height,
          reference: input.run.setup.reference ? { ...input.run.setup.reference, checksumSha256: manifest.referenceChecksumSha256 } : null,
        }, credit_cost: input.authority?.quotedCredits ?? 0,
        credit_pricing_version: input.authority?.pricingVersion ?? input.ownerPricingVersion ?? null,
        favorite: false, status: input.run.status === "PARTIALLY_SUCCEEDED" ? "PARTIAL" : "SUCCEEDED",
        created_at: input.run.createdAt,
      });
      if (inserted.error) {
        const raced = await admin.from("xeriano_creations").select("id")
          .eq("account_id", input.context.accountId).eq("source_studio", "DESIGN_STUDIO")
          .eq("source_job_id", input.run.id).eq("source_result_id", result.publicView.id).maybeSingle();
        if (!raced.data) throw inserted.error;
        creationId = raced.data.id;
      }
    }
    mapped.push({ ...result, publicView: { ...result.publicView, libraryAssetId: assetId!, creationId: creationId! } });
  }
  const updated = designJobManifestSchema.parse({ ...manifest, results: mapped, updatedAt: new Date().toISOString() });
  await store.writeManifest(updated);
  return { ...input.run, updatedAt: updated.updatedAt, results: mapped.map((item) => item.publicView) };
}

export const DESIGN_SOURCE_STORAGE_BUCKET = DESIGN_STUDIO_BUCKET;
