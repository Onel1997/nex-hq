import {
  DEFAULT_BUSINESS_PROFILE_SLUG,
  getBusinessProfileForSlug,
  type BusinessProfile,
} from "@/lib/business/profile";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";

function resolveWorkspaceSlug(_workspaceId: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_BUSINESS_PROFILE_SLUG;
  }
}

/**
 * Load the business profile for a workspace.
 *
 * V1: local registry keyed by active workspace slug.
 * Future: Supabase `business_profiles` table keyed by workspaceId.
 */
export async function loadBusinessProfile(
  workspaceId: string,
): Promise<BusinessProfile> {
  // Future Supabase:
  // const { data } = await supabase.from("business_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle();
  // if (data) return mapRowToBusinessProfile(data);

  const slug = resolveWorkspaceSlug(workspaceId);
  return getBusinessProfileForSlug(slug);
}

/** Synchronous accessor when workspace slug is already known. */
export function loadBusinessProfileBySlug(slug: string): BusinessProfile {
  return getBusinessProfileForSlug(slug);
}
