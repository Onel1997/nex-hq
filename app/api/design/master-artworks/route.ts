import {
  approveMasterArtworkRequestSchema,
  toApprovedMasterArtworkView,
} from "@/lib/design/master-artwork-authority/types";
import { approveDurableMasterArtwork } from "@/lib/design/master-artwork-authority/service";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";

export async function GET(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const designId = new URL(request.url).searchParams.get("designId") ?? undefined;
    const records = await new SupabaseMasterArtworkAuthorityRepository().list(
      gated.scope,
      designId,
    );
    return jsonOk({
      success: true,
      artworks: records.map(toApprovedMasterArtworkView),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = approveMasterArtworkRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonOk(
        {
          success: false,
          error: "Invalid durable Master Artwork approval request.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    const artwork = await approveDurableMasterArtwork(gated.scope, parsed.data);
    return jsonOk(
      { success: true, artwork: toApprovedMasterArtworkView(artwork) },
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
