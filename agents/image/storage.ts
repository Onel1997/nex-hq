import { createAdminClient } from "@/lib/supabase/admin";

export const IMAGE_ASSETS_BUCKET = "image-assets";

export function buildImageStoragePath(params: {
  workspaceId: string;
  reportId: string;
  assetKey: string;
}): string {
  const safeKey = params.assetKey.replace(/[^a-zA-Z0-9:_-]/g, "_");
  return `${params.workspaceId}/${params.reportId}/${safeKey}.png`;
}

export async function uploadImageAsset(params: {
  workspaceId: string;
  reportId: string;
  assetKey: string;
  imageBytes: Buffer;
  contentType?: string;
}): Promise<{ storagePath: string; url: string }> {
  const supabase = createAdminClient();
  const storagePath = buildImageStoragePath(params);

  const { error: uploadError } = await supabase.storage
    .from(IMAGE_ASSETS_BUCKET)
    .upload(storagePath, params.imageBytes, {
      contentType: params.contentType ?? "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(IMAGE_ASSETS_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    url: data.publicUrl,
  };
}
