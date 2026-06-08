/**
 * HQ OS modules — toggleable capabilities per workspace.
 *
 * Active modules are stored in Company Profile and control which
 * platform features and domain packs are available.
 */

export const HQ_MODULE_IDS = [
  "brain",
  "agents",
  "tasks",
  "reports",
  "integrations",
  "analytics",
  "commerce",
  "content_studio",
  "design_studio",
] as const;

export type HqModuleId = (typeof HQ_MODULE_IDS)[number];

export interface HqModuleDefinition {
  id: HqModuleId;
  label: string;
  description: string;
}

export const HQ_MODULE_REGISTRY: Record<HqModuleId, HqModuleDefinition> = {
  brain: {
    id: "brain",
    label: "Brain",
    description: "Central knowledge and memory layer.",
  },
  agents: {
    id: "agents",
    label: "Agents",
    description: "AI agent team orchestration.",
  },
  tasks: {
    id: "tasks",
    label: "Tasks",
    description: "Work management and delegation.",
  },
  reports: {
    id: "reports",
    label: "Reports",
    description: "Agent output review and approval.",
  },
  integrations: {
    id: "integrations",
    label: "Integrations",
    description: "External API connections and sync.",
  },
  analytics: {
    id: "analytics",
    label: "Analytics",
    description: "Performance dashboards and KPI tracking.",
  },
  commerce: {
    id: "commerce",
    label: "Commerce",
    description: "Storefront and product operations.",
  },
  content_studio: {
    id: "content_studio",
    label: "Content Studio",
    description: "Copy, editorial, and channel content.",
  },
  design_studio: {
    id: "design_studio",
    label: "Design Studio",
    description: "Visual design and asset management.",
  },
};
