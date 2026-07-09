import { createAdminClient } from "@/lib/supabase/admin";

export const IMAGE_ASSETS_BUCKET = "image-assets";

const IMAGE_ASSETS_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const IMAGE_ASSETS_SIZE_LIMIT = 52_428_800; // 50 MB

export function buildImageStoragePath(params: {
  workspaceId: string;
  reportId: string;
  assetKey: string;
}): string {
  const safeKey = params.assetKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
  return `${params.workspaceId}/${params.reportId}/${safeKey}.png`;
}

let bucketEnsured = false;

/** Ensure the image-assets bucket exists (migration may not have been applied). */
export async function ensureImageAssetsBucket(): Promise<void> {
  if (bucketEnsured) return;

  const supabase = createAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("[Image Storage] listBuckets failed", {
      bucket: IMAGE_ASSETS_BUCKET,
      error: listError.message,
    });
    throw new Error(`Image storage setup failed: ${listError.message}`);
  }

  const exists = buckets?.some((b) => b.id === IMAGE_ASSETS_BUCKET);
  console.info("[Image Storage] Bucket check", {
    bucket: IMAGE_ASSETS_BUCKET,
    exists,
    availableBuckets: buckets?.map((b) => b.id) ?? [],
  });

  if (exists) {
    bucketEnsured = true;
    return;
  }

  const { data: created, error: createError } = await supabase.storage.createBucket(
    IMAGE_ASSETS_BUCKET,
    {
      public: true,
      fileSizeLimit: IMAGE_ASSETS_SIZE_LIMIT,
      allowedMimeTypes: [...IMAGE_ASSETS_MIME_TYPES],
    },
  );

  if (createError) {
    console.error("[Image Storage] createBucket failed", {
      bucket: IMAGE_ASSETS_BUCKET,
      error: createError.message,
    });
    throw new Error(`Image storage setup failed: ${createError.message}`);
  }

  console.info("[Image Storage] Bucket created", {
    bucket: IMAGE_ASSETS_BUCKET,
    result: created,
  });
  bucketEnsured = true;
}

export async function uploadImageAsset(params: {
  workspaceId: string;
  reportId: string;
  assetKey: string;
  imageBytes: Buffer;
  contentType?: string;
}): Promise<{ storagePath: string; url: string }> {
  await ensureImageAssetsBucket();

  const supabase = createAdminClient();
  const storagePath = buildImageStoragePath(params);
  const contentType = params.contentType ?? "image/png";

  console.info("[Image Storage] Upload starting", {
    bucket: IMAGE_ASSETS_BUCKET,
    storagePath,
    contentType,
    byteLength: params.imageBytes.length,
  });

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(IMAGE_ASSETS_BUCKET)
    .upload(storagePath, params.imageBytes, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[Image Storage] Upload failed", {
      bucket: IMAGE_ASSETS_BUCKET,
      storagePath,
      error: uploadError.message,
      errorName: uploadError.name,
    });
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(IMAGE_ASSETS_BUCKET)
    .getPublicUrl(storagePath);

  const result = {
    storagePath,
    url: urlData.publicUrl,
  };

  console.info("[Image Storage] Upload succeeded", {
    bucket: IMAGE_ASSETS_BUCKET,
    storagePath,
    imageUrl: result.url,
    uploadId: uploadData?.id,
    uploadPath: uploadData?.path,
  });

  return result;
}
