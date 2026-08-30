import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const IMAGE_PRODUCTION_ASSETS_BUCKET = "image-production-assets";
export const IMAGE_PRODUCTION_ASSET_ACCESS_SECONDS = 900;

export function assertImageProductionAssetPath(
  workspaceId: string,
  storagePath: string,
): void {
  if (!storagePath.startsWith(`workspace/${workspaceId}/`)) {
    throw new PersonaDomainError(
      "Image production asset belongs to another workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
}

export async function createImageProductionAssetAccess(
  workspaceId: string,
  storagePath: string,
): Promise<{ accessUrl: string; expiresAt: string }> {
  assertImageProductionAssetPath(workspaceId, storagePath);
  const { data, error } = await createAdminClient().storage
    .from(IMAGE_PRODUCTION_ASSETS_BUCKET)
    .createSignedUrl(storagePath, IMAGE_PRODUCTION_ASSET_ACCESS_SECONDS);
  if (error || !data?.signedUrl) {
    throw new PersonaDomainError(
      `Private Image asset access failed: ${error?.message ?? "missing object"}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  return {
    accessUrl: data.signedUrl,
    expiresAt: new Date(
      Date.now() + IMAGE_PRODUCTION_ASSET_ACCESS_SECONDS * 1000,
    ).toISOString(),
  };
}

export async function createImageProductionAssetAccessBatch(
  workspaceId: string,
  storagePaths: readonly string[],
): Promise<Map<string, { accessUrl: string; expiresAt: string }>> {
  const uniquePaths = [...new Set(storagePaths)];
  uniquePaths.forEach((path) => assertImageProductionAssetPath(workspaceId, path));
  if (!uniquePaths.length) return new Map();
  const { data, error } = await createAdminClient().storage
    .from(IMAGE_PRODUCTION_ASSETS_BUCKET)
    .createSignedUrls(uniquePaths, IMAGE_PRODUCTION_ASSET_ACCESS_SECONDS);
  if (error) {
    throw new PersonaDomainError(
      `Private Image asset batch access failed: ${error.message}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  const expiresAt = new Date(
    Date.now() + IMAGE_PRODUCTION_ASSET_ACCESS_SECONDS * 1000,
  ).toISOString();
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl
        ? [[entry.path, { accessUrl: entry.signedUrl, expiresAt }] as const]
        : [],
    ),
  );
}
