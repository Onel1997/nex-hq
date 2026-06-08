import type { BrainDomainContentMap } from "@/brain/domains";
import type { BrainDomain } from "@/brain/types";
import type { HqIndustryId } from "@/brain/platform/industries";

export interface WorkspaceSeedRecord<D extends keyof BrainDomainContentMap = keyof BrainDomainContentMap> {
  domain: D;
  slug: string;
  title: string;
  summary: string;
  content: BrainDomainContentMap[D];
  tags: string[];
}

export interface WorkspaceDefinition {
  slug: string;
  name: string;
  industryId: HqIndustryId;
  seedRecords: WorkspaceSeedRecord[];
}
