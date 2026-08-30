import type { WorkspaceDefinition } from "../types";

/**
 * Explicit compatibility entry for the isolated Xeriamo staging runtime.
 * Unknown workspace slugs still fail closed; this is not a generic fallback.
 */
export const XERIAMO_STAGING_WORKSPACE: WorkspaceDefinition = {
  slug: "xeriano-staging",
  name: "Xeriamo Staging",
  industryId: "fashion_hq",
  seedRecords: [],
};
