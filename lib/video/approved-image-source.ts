import { createAdminClient } from "@/lib/supabase/admin";
import {
  PersonaDomainError,
  PersonaStoreError,
} from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  approvedImageVideoSourceSchema,
  type VideoGenerationInputV1,
} from "./types";
export type ApprovedImageVideoSource = VideoGenerationInputV1["sourceVisual"];
export interface ApprovedImageSourceRepository {
  getApproved(
    scope: WorkspaceScope,
    id: string,
  ): Promise<ApprovedImageVideoSource | null>;
  listApproved(scope: WorkspaceScope): Promise<ApprovedImageVideoSource[]>;
}
function traceBrandModel(raw: Record<string, unknown>) {
  return {
    contractVersion: "brand-model-v1",
    brandModelId: raw.brandModelId,
    personaId: raw.personaId,
    identityLockSnapshotId: raw.identityLockSnapshotId,
    identityLockVersion: raw.identityLockVersion,
    identityFingerprint: raw.identityFingerprint,
    referencePackageVersion: raw.referencePackageVersion,
    referencePackageFingerprint: raw.referencePackageFingerprint,
  };
}
async function mapRows(
  rows: Record<string, unknown>[],
): Promise<ApprovedImageVideoSource[]> {
  const db = createAdminClient();
  const result: ApprovedImageVideoSource[] = [];
  for (const row of rows) {
    const stage = await db
      .from("image_production_stage_outputs")
      .select("checksum")
      .eq("id", row.composite_stage_output_id)
      .maybeSingle();
    if (stage.error) throw new PersonaStoreError(stage.error.message);
    const bm = row.brand_model as Record<string, unknown>;
    const art = row.master_artwork as Record<string, unknown>;
    const provenance = row.provenance as Record<string, unknown>;
    const paid = (provenance?.paidGeneration ?? {}) as Record<string, unknown>;
    const product = (paid.product ?? row.product_context ?? {}) as Record<
      string,
      unknown
    >;
    const parsed = approvedImageVideoSourceSchema.safeParse({
      sourceAssetId: row.id,
      workspaceId: row.workspace_id,
      imageProductionProjectId: row.production_project_id,
      imageGenerationJobId: row.generation_job_id,
      inputFingerprint: row.input_fingerprint,
      checksum: stage.data?.checksum,
      storagePath: row.storage_path,
      reviewStatus: row.review_status,
      brandModel: traceBrandModel(bm),
      artwork: {
        artworkId: art.id ?? art.artworkId,
        designId: art.designId,
        version: art.version,
        checksum: art.checksum,
      },
      product: {
        productProfileId: product.productProfileId,
        profileVersion: product.profileVersion,
        authority: product.authority,
        variantId: product.variantId,
      },
      shotId: row.shot_id,
      approvedBy: row.reviewed_by,
      approvedAt: row.reviewed_at,
      generatedAt: row.generated_at,
    });
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}
export class SupabaseApprovedImageSourceRepository implements ApprovedImageSourceRepository {
  async getApproved(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient()
      .from("image_production_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .eq("review_status", "APPROVED")
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data
      ? ((await mapRows([data as Record<string, unknown>]))[0] ?? null)
      : null;
  }
  async listApproved(scope: WorkspaceScope) {
    const { data, error } = await createAdminClient()
      .from("image_production_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("review_status", "APPROVED")
      .order("reviewed_at", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return mapRows((data ?? []) as Record<string, unknown>[]);
  }
}
export class MemoryApprovedImageSourceRepository implements ApprovedImageSourceRepository {
  constructor(private values: ApprovedImageVideoSource[]) {}
  async getApproved(scope: WorkspaceScope, id: string) {
    const v = this.values.find(
      (x) => x.sourceAssetId === id && x.workspaceId === scope.workspaceId,
    );
    if (!v) return null;
    return approvedImageVideoSourceSchema.parse(v);
  }
  async listApproved(scope: WorkspaceScope) {
    return this.values
      .filter((v) => v.workspaceId === scope.workspaceId)
      .map((v) => approvedImageVideoSourceSchema.parse(v));
  }
}
export function assertApprovedImageLineage(
  source: ApprovedImageVideoSource,
  input: {
    workspaceId: string;
    brandModelId: string;
    identityFingerprint: string;
    artworkId: string;
    artworkChecksum: string;
    productProfileId: string;
    profileVersion: number;
    variantId: string;
  },
) {
  if (source.workspaceId !== input.workspaceId)
    throw new PersonaDomainError(
      "Ausgangsbild gehört zu einem anderen Workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  if (source.reviewStatus !== "APPROVED")
    throw new PersonaDomainError(
      "Nur freigegebene Image-Studio-Assets sind als Video-Ausgangsbild zulässig.",
      "WORKFLOW",
    );
  if (
    source.brandModel.brandModelId !== input.brandModelId ||
    source.brandModel.identityFingerprint !== input.identityFingerprint
  )
    throw new PersonaDomainError(
      "Ausgangsbild und Markenmodel stimmen nicht überein.",
      "WORKFLOW",
    );
  if (
    source.artwork.artworkId !== input.artworkId ||
    source.artwork.checksum !== input.artworkChecksum
  )
    throw new PersonaDomainError(
      "Ausgangsbild und Artwork stimmen nicht überein.",
      "WORKFLOW",
    );
  if (
    source.product.productProfileId !== input.productProfileId ||
    source.product.profileVersion !== input.profileVersion ||
    source.product.variantId !== input.variantId
  )
    throw new PersonaDomainError(
      "Ausgangsbild und Produktversion stimmen nicht überein.",
      "WORKFLOW",
    );
}
