import type { WorkspaceDefinition } from "../types";
import { createFashionHqSeedRecords } from "./seed-data";

const WORKSPACE_NAME = "Milaene";

/** Fashion HQ reference workspace (streetwear). */
export const MILAENE_WORKSPACE: WorkspaceDefinition = {
  slug: "milaene",
  name: WORKSPACE_NAME,
  industryId: "fashion_hq",
  seedRecords: createFashionHqSeedRecords({ name: WORKSPACE_NAME }),
};
