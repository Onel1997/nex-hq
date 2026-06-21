/** Facility wing routes — all non-scene HQ sections live under /facility/* */

export const FACILITY_ROUTES = {
  home: "/",
  agents: "/facility/agents",
  missions: "/facility/missions",
  /** @deprecated use missions */
  tasks: "/facility/missions",
  reports: "/facility/reports",
  knowledge: "/facility/knowledge",
  brain: "/facility/brain",
  settings: "/settings",
} as const;

export type FacilityWingId =
  | "agents"
  | "reports"
  | "knowledge"
  | "brain-core"
  | "mission-control"
  | "analytics";

export interface FacilityWingDefinition {
  id: FacilityWingId;
  label: string;
  href: string | null;
  comingSoon?: boolean;
}

export const FACILITY_WINGS: FacilityWingDefinition[] = [
  { id: "agents", label: "Agent Wing", href: FACILITY_ROUTES.agents },
  {
    id: "mission-control",
    label: "Mission Control",
    href: FACILITY_ROUTES.missions,
  },
  { id: "reports", label: "Reports Center", href: FACILITY_ROUTES.reports },
  { id: "knowledge", label: "Knowledge Vault", href: FACILITY_ROUTES.knowledge },
  { id: "brain-core", label: "Brain Core", href: FACILITY_ROUTES.brain },
  { id: "analytics", label: "Analytics Chamber", href: null, comingSoon: true },
];

export function getFacilityWingFromPath(pathname: string): FacilityWingId | null {
  if (pathname.startsWith(FACILITY_ROUTES.agents)) return "agents";
  if (pathname.startsWith(FACILITY_ROUTES.missions)) return "mission-control";
  if (pathname.startsWith(FACILITY_ROUTES.reports)) return "reports";
  if (pathname.startsWith(FACILITY_ROUTES.knowledge)) return "knowledge";
  if (pathname.startsWith(FACILITY_ROUTES.brain)) return "brain-core";
  return null;
}

export function isFacilityWingPath(pathname: string): boolean {
  return getFacilityWingFromPath(pathname) !== null;
}
