/**
 * Brain workspace — multi-tenant scoping for HQ OS platforms.
 *
 * Each workspace (company) has one industry pack, a set of active modules,
 * and a resolved list of enabled Brain domains.
 */

import type { BrainDomain } from "../types";
import type { HqIndustryId } from "./industries";
import type { HqModuleId } from "./modules";

export interface BrainWorkspace {
  id: string;
  slug: string;
  name: string;
  industryId: HqIndustryId;
  activeModules: HqModuleId[];
  /** Core domains + industry pack domains provisioned for this workspace. */
  enabledDomains: BrainDomain[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for provisioning a new HQ OS workspace.
 * enabledDomains is resolved from industry pack at provisioning time.
 */
export interface BrainWorkspaceProvisionInput {
  slug: string;
  name: string;
  industryId: HqIndustryId;
  activeModules: HqModuleId[];
}

export interface BrainWorkspaceConfig {
  workspaceId: string;
  industryId: HqIndustryId;
  activeModules: HqModuleId[];
  enabledDomains: BrainDomain[];
}
