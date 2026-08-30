import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
export const VIDEO_ASSET_BUCKET = "video-production-assets";
export async function persistVideoAsset(input: {
  workspaceId: string;
  path: string;
  bytes: Buffer;
  mimeType: string;
}) {
  if (!input.path.startsWith(`workspace/${input.workspaceId}/`))
    throw new PersonaDomainError(
      "Video storage path violates workspace scope.",
      "UNAUTHORIZED_WORKSPACE",
    );
  const { error } = await createAdminClient()
    .storage.from(VIDEO_ASSET_BUCKET)
    .upload(input.path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (error && !/already exists/i.test(error.message))
    throw new PersonaDomainError(
      "Video asset could not be stored privately.",
      "WORKFLOW",
    );
}
export async function signVideoAsset(input: {
  workspaceId: string;
  path: string;
}) {
  if (!input.path.startsWith(`workspace/${input.workspaceId}/`))
    throw new PersonaDomainError(
      "Video storage path violates workspace scope.",
      "UNAUTHORIZED_WORKSPACE",
    );
  const { data, error } = await createAdminClient()
    .storage.from(VIDEO_ASSET_BUCKET)
    .createSignedUrl(input.path, 300);
  if (error || !data?.signedUrl)
    throw new PersonaDomainError("Video preview unavailable.", "NOT_FOUND");
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
}
