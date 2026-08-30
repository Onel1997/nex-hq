import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { listImageStudioBrandModels } from "@/lib/persona/future/image-studio-hooks";
import { listVideoStudioBrandModels } from "@/lib/persona/future/video-studio-hooks";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import { toApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import {
  listProductProfiles,
  toOwnerProductProfileView,
} from "@/lib/product-library/service";
import { SupabaseApprovedImageSourceRepository } from "@/lib/video/approved-image-source";
import { createImageProductionAssetAccess } from "@/lib/image/production-project/asset-access";
export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const [imageModels, videoModels, artworks, products, sources] =
      await Promise.all([
        listImageStudioBrandModels(gated.scope),
        listVideoStudioBrandModels(gated.scope),
        new SupabaseMasterArtworkAuthorityRepository().list(gated.scope),
        listProductProfiles(gated.scope),
        new SupabaseApprovedImageSourceRepository().listApproved(gated.scope),
      ]);
    const videoIds = new Set(videoModels.map((m) => m.brandModelId));
    return jsonOk({
      success: true,
      brandModels: imageModels.map((m) => ({
        ...m,
        videoEligible: videoIds.has(m.brandModelId),
        videoBlocker: videoIds.has(m.brandModelId)
          ? null
          : "Dieses Markenmodel ist noch nicht für Video freigegeben.",
      })),
      artworks: artworks.map(toApprovedMasterArtworkView),
      products: await Promise.all(
        products.map((p) => toOwnerProductProfileView(gated.scope, p)),
      ),
      sources: await Promise.all(
        sources.map(async (s) => {
          const access = await createImageProductionAssetAccess(
            gated.scope.workspaceId,
            s.storagePath,
          ).catch(() => null);
          return {
            ...s,
            storagePath: undefined,
            previewUrl: access?.accessUrl ?? null,
            previewExpiresAt: access?.expiresAt ?? null,
          };
        }),
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
