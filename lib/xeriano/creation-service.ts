import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type {
  CreativeReferenceSnapshot,
  CreativeRun,
} from "@/lib/creative-studio/contracts";
import type { CreativeProviderReference } from "@/lib/creative-studio/provider";
import {
  CREATIVE_STUDIO_ASSET_BUCKET,
  SupabaseCreativeJobStore,
  type CreativeCreationReferenceManifest,
  type CreativeCreationReferenceRecord,
  type CreativeJobScope,
} from "@/lib/creative-studio/server-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import type { XerianoGenerationAuthority } from "@/lib/xeriano/customer-generation";

const LIBRARY_BUCKET = "xeriano-library-assets";
const LIBRARY_MAX_BYTES = 50 * 1024 * 1024;

export class XerianoCreationError extends Error {
  constructor(
    readonly code:
      | "XERIANO_CREATION_AUTHORITY_UNAVAILABLE"
      | "XERIANO_CREATION_REFERENCE_INVALID"
      | "XERIANO_CREATION_PERSISTENCE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "XerianoCreationError";
  }
}

export async function assertXerianoCreationAuthorityReady(): Promise<void> {
  const admin = createAdminClient();
  const [creations, references] = await Promise.all([
    admin.from("xeriano_creations").select("id").limit(1),
    admin.from("xeriano_creation_references").select("id").limit(1),
  ]);
  if (creations.error || references.error) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_AUTHORITY_UNAVAILABLE",
      "Die Xeriamo-Creation-Bibliothek ist noch nicht aktiviert.",
    );
  }
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function referenceSnapshotEntry(
  snapshot: CreativeReferenceSnapshot | null,
  referenceId: string,
) {
  return snapshot?.references.find((entry) => entry.referenceId === referenceId);
}

async function assertLibraryReferenceBytes(input: {
  accountId: string;
  assetId: string;
  bytes: Buffer;
}) {
  const admin = createAdminClient();
  const found = await admin
    .from("xeriano_library_assets")
    .select("storage_bucket,storage_path,mime_type,byte_length,checksum_sha256")
    .eq("account_id", input.accountId)
    .eq("id", input.assetId)
    .maybeSingle();
  if (found.error || !found.data) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_REFERENCE_INVALID",
      "Eine Bibliotheks-Referenz gehört nicht zum aktiven Konto.",
    );
  }
  const downloaded = await admin.storage
    .from(found.data.storage_bucket)
    .download(found.data.storage_path);
  if (downloaded.error) throw downloaded.error;
  const authorityBytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (
    authorityBytes.byteLength !== input.bytes.byteLength ||
    sha256(authorityBytes) !== sha256(input.bytes)
  ) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_REFERENCE_INVALID",
      "Die Bibliotheks-Referenz stimmt nicht mit dem ausgewählten Asset überein.",
    );
  }
}

/**
 * Customer-only outer persistence. It receives the already validated reference
 * buffers but never changes their order, bytes, or the frozen provider setup.
 */
export async function prepareCreativeCreationReferences(input: {
  context: XerianoAccountContext;
  scope: CreativeJobScope;
  jobId: string;
  references: CreativeProviderReference[];
  snapshot: CreativeReferenceSnapshot | null;
}): Promise<CreativeCreationReferenceManifest> {
  if (input.snapshot && input.snapshot.jobId !== input.jobId) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_REFERENCE_INVALID",
      "Die Referenz-Herkunft passt nicht zum Auftrag.",
    );
  }
  const store = new SupabaseCreativeJobStore();
  const records: CreativeCreationReferenceRecord[] = [];
  for (const reference of [...input.references].sort(
    (a, b) => a.metadata.order - b.metadata.order,
  )) {
    const entry = referenceSnapshotEntry(input.snapshot, reference.metadata.id);
    if (
      entry &&
      (entry.order !== reference.metadata.order ||
        entry.filename !== reference.metadata.name ||
        entry.mimeType.toLowerCase() !==
          reference.metadata.mimeType.toLowerCase() ||
        entry.byteLength !== reference.bytes.byteLength)
    ) {
      throw new XerianoCreationError(
        "XERIANO_CREATION_REFERENCE_INVALID",
        "Die Referenz-Herkunft stimmt nicht mit dem Auftrag überein.",
      );
    }
    const source = entry?.source ?? { kind: "LOCAL_FILE_REFERENCE" as const };
    const checksumSha256 = sha256(reference.bytes);
    let storagePath: string | null = null;
    if (source.kind === "LIBRARY_REFERENCE") {
      await assertLibraryReferenceBytes({
        accountId: input.context.accountId,
        assetId: source.libraryAssetId,
        bytes: reference.bytes,
      });
    } else if (source.kind === "GENERATED_RESULT_REFERENCE") {
      const sourceAsset = await store.readResult({
        scope: input.scope,
        jobId: source.sourceJobId,
        resultId: source.sourceResultId,
      });
      if (
        !sourceAsset ||
        sourceAsset.bytes.byteLength !== reference.bytes.byteLength ||
        sha256(sourceAsset.bytes) !== checksumSha256
      ) {
        throw new XerianoCreationError(
          "XERIANO_CREATION_REFERENCE_INVALID",
          "Die Ergebnis-Referenz gehört nicht zum aktiven Studio-Kontext.",
        );
      }
    } else {
      storagePath = await store.persistCreationReference({
        scope: input.scope,
        jobId: input.jobId,
        referenceId: reference.metadata.id,
        bytes: reference.bytes,
        mimeType: reference.metadata.mimeType,
      });
    }
    records.push({
      referenceId: reference.metadata.id,
      order: reference.metadata.order,
      role: reference.metadata.role,
      sourceKind: source.kind,
      libraryAssetId:
        source.kind === "LIBRARY_REFERENCE" ? source.libraryAssetId : null,
      sourceJobId:
        source.kind === "GENERATED_RESULT_REFERENCE"
          ? source.sourceJobId
          : null,
      sourceResultId:
        source.kind === "GENERATED_RESULT_REFERENCE"
          ? source.sourceResultId
          : null,
      filename: reference.metadata.name,
      mimeType: reference.metadata.mimeType,
      byteLength: reference.bytes.byteLength,
      checksumSha256,
      storagePath,
    });
  }
  const manifest: CreativeCreationReferenceManifest = {
    version: "xeriano-creative-creation-references-v1",
    accountId: input.context.accountId,
    jobId: input.jobId,
    createdAt: new Date().toISOString(),
    references: records,
  };
  await store.writeCreationReferenceManifest({ scope: input.scope, manifest });
  return manifest;
}

function resultExtension(mimeType: string) {
  return mimeType === "image/jpeg"
    ? "jpg"
    : mimeType === "image/webp"
      ? "webp"
      : "png";
}

async function ensureCreativeLibraryAsset(input: {
  context: XerianoAccountContext;
  scope: CreativeJobScope;
  run: CreativeRun;
  result: CreativeRun["results"][number];
}) {
  const admin = createAdminClient();
  const existing = await admin
    .from("xeriano_library_assets")
    .select("id,title,mime_type")
    .eq("account_id", input.context.accountId)
    .eq("source_studio", "CREATIVE_STUDIO")
    .eq("source_job_id", input.run.id)
    .eq("source_result_id", input.result.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const asset = await new SupabaseCreativeJobStore().readResult({
    scope: input.scope,
    jobId: input.run.id,
    resultId: input.result.id,
  });
  if (!asset) throw new Error("creative_result_not_found");
  if (asset.bytes.byteLength > LIBRARY_MAX_BYTES) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_PERSISTENCE_FAILED",
      "Das Ergebnis ist für die Bibliothek zu groß.",
    );
  }
  const storagePath = `accounts/${input.context.accountId}/generated/creative_studio/${input.run.id}/${input.result.id}.${resultExtension(asset.mimeType)}`;
  const upload = await admin.storage.from(LIBRARY_BUCKET).upload(
    storagePath,
    asset.bytes,
    { contentType: asset.mimeType, upsert: false },
  );
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
    throw upload.error;
  }
  const title = `Creative Bild · ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(input.run.createdAt))}`;
  const inserted = await admin
    .from("xeriano_library_assets")
    .insert({
      account_id: input.context.accountId,
      owner_user_id: input.context.userId,
      asset_type: "IMAGE",
      title,
      description: null,
      source_studio: "CREATIVE_STUDIO",
      source_job_id: input.run.id,
      source_result_id: input.result.id,
      storage_bucket: LIBRARY_BUCKET,
      storage_path: storagePath,
      mime_type: asset.mimeType,
      byte_length: asset.bytes.byteLength,
      checksum_sha256: sha256(asset.bytes),
      favorite: false,
      tags: [],
      provenance: {
        contractVersion: "xeriano-creation-v1",
        automatic: true,
      },
    })
    .select("id,title,mime_type")
    .single();
  if (!inserted.error) return inserted.data;
  const raced = await admin
    .from("xeriano_library_assets")
    .select("id,title,mime_type")
    .eq("account_id", input.context.accountId)
    .eq("source_studio", "CREATIVE_STUDIO")
    .eq("source_job_id", input.run.id)
    .eq("source_result_id", input.result.id)
    .maybeSingle();
  if (raced.data) return raced.data;
  await admin.storage.from(LIBRARY_BUCKET).remove([storagePath]);
  throw inserted.error;
}

export type FinalizedCreativeCreation = {
  creationId: string;
  assetId: string;
  resultId: string;
};

/** Idempotently materialize one customer Creation for each persisted result. */
export async function finalizeCreativeCreations(input: {
  context: XerianoAccountContext;
  scope: CreativeJobScope;
  run: CreativeRun;
  authority?: XerianoGenerationAuthority;
  ownerUnlimitedPricingVersion?: string;
}): Promise<FinalizedCreativeCreation[]> {
  if (
    input.run.status !== "SUCCEEDED" &&
    input.run.status !== "PARTIALLY_SUCCEEDED"
  ) {
    return [];
  }
  const store = new SupabaseCreativeJobStore();
  const referenceManifest = await store.readCreationReferenceManifest(
    input.scope,
    input.run.id,
  );
  if (!referenceManifest || referenceManifest.accountId !== input.context.accountId) {
    throw new XerianoCreationError(
      "XERIANO_CREATION_PERSISTENCE_FAILED",
      "Die verwendeten Referenzen sind nicht dauerhaft verfügbar.",
    );
  }
  const admin = createAdminClient();
  const finalized: FinalizedCreativeCreation[] = [];
  for (const result of input.run.results) {
    const asset = await ensureCreativeLibraryAsset({
      context: input.context,
      scope: input.scope,
      run: input.run,
      result,
    });
    const existing = await admin
      .from("xeriano_creations")
      .select("id,library_asset_id")
      .eq("account_id", input.context.accountId)
      .eq("source_studio", "CREATIVE_STUDIO")
      .eq("source_job_id", input.run.id)
      .eq("source_result_id", result.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    let creationId = existing.data?.id as string | undefined;
    if (!creationId) {
      creationId = randomUUID();
      const inserted = await admin.from("xeriano_creations").insert({
        id: creationId,
        account_id: input.context.accountId,
        actor_user_id: input.context.userId,
        library_asset_id: asset.id,
        creation_type: "IMAGE",
        source_studio: "CREATIVE_STUDIO",
        source_job_id: input.run.id,
        source_result_id: result.id,
        original_prompt: input.run.setup.prompt,
        provider_prompt: input.run.providerPrompt ?? null,
        model_id: input.run.setup.modelId,
        settings: {
          contractVersion: input.run.setup.contractVersion,
          aspectRatio: input.run.setup.aspectRatio,
          quality: input.run.setup.quality,
          batchSize: input.run.setup.batchSize,
          outputType: input.run.setup.outputType,
          advanced: input.run.setup.advanced,
          width: result.width,
          height: result.height,
        },
        credit_cost: input.authority?.quotedCredits ?? 0,
        credit_pricing_version:
          input.authority?.pricingVersion ?? input.ownerUnlimitedPricingVersion ?? null,
        favorite: false,
        status:
          input.run.status === "PARTIALLY_SUCCEEDED" ? "PARTIAL" : "SUCCEEDED",
        created_at: input.run.createdAt,
      });
      if (inserted.error) {
        const raced = await admin
          .from("xeriano_creations")
          .select("id")
          .eq("account_id", input.context.accountId)
          .eq("source_studio", "CREATIVE_STUDIO")
          .eq("source_job_id", input.run.id)
          .eq("source_result_id", result.id)
          .maybeSingle();
        if (!raced.data) throw inserted.error;
        creationId = raced.data.id;
      }
    }

    const { count, error: countError } = await admin
      .from("xeriano_creation_references")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.context.accountId)
      .eq("creation_id", creationId);
    if (countError) throw countError;
    if (!count && referenceManifest.references.length) {
      const references = referenceManifest.references.map((reference) => ({
        account_id: input.context.accountId,
        creation_id: creationId,
        reference_order: reference.order,
        role: reference.role,
        source_kind: reference.sourceKind,
        library_asset_id: reference.libraryAssetId,
        source_job_id: reference.sourceJobId,
        source_result_id: reference.sourceResultId,
        filename: reference.filename,
        mime_type: reference.mimeType,
        byte_length: reference.byteLength,
        checksum_sha256: reference.checksumSha256,
        storage_bucket:
          reference.sourceKind === "LOCAL_FILE_REFERENCE"
            ? CREATIVE_STUDIO_ASSET_BUCKET
            : null,
        storage_path: reference.storagePath,
      }));
      const insertedReferences = await admin
        .from("xeriano_creation_references")
        .insert(references);
      if (insertedReferences.error && !/duplicate/i.test(insertedReferences.error.message)) {
        throw insertedReferences.error;
      }
    }
    if (!creationId) throw new Error("creation_id_missing");
    finalized.push({ creationId, assetId: asset.id, resultId: result.id });
  }
  return finalized;
}
