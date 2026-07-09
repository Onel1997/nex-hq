/**
 * Company Profile — core domain, shared by all HQ OS industries.
 *
 * The canonical workspace bootstrap record. Stores company identity,
 * industry selection, goals, and platform configuration.
 */

import type { HqIndustryId } from "../platform/industries";
import type { HqModuleId } from "../platform/modules";

export interface CompanyKpi {
  name: string;
  target: string;
  current?: string;
  period?: string;
}

export type CompanyIntegrationStatus = "active" | "planned" | "disconnected";

export interface CompanyIntegration {
  id: string;
  name: string;
  status: CompanyIntegrationStatus;
}

export interface CompanyProfileContent {
  kind: "company_profile";
  companyName: string;
  industry: HqIndustryId;
  businessModel: string;
  targetAudience: string;
  goals: string[];
  kpis: CompanyKpi[];
  integrations: CompanyIntegration[];
  activeModules: HqModuleId[];
}
