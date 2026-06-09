import type { AgentId } from "@/lib/constants/agents";

/** Supported facility visual themes — only Neural Dark is fully implemented. */
export type FacilityThemeId =
  | "neural-dark"
  | "cyber-blue"
  | "matrix-green"
  | "stark-gold"
  | "void-black";

export const ACTIVE_FACILITY_THEME: FacilityThemeId = "neural-dark";

/** Permanent agent identity colors — drive glows, rings, transmissions. */
export const AGENT_IDENTITY_COLORS: Record<AgentId, string> = {
  ceo: "#FFD166",
  research: "#A855F7",
  designer: "#22D3EE",
  marketing: "#F59E0B",
  content: "#3B82F6",
  shopify: "#22C55E",
  image: "#EC4899",
};

export interface FacilityThemeTokens {
  id: FacilityThemeId;
  label: string;
  cssClass: string;
  /** CSS custom properties applied to `.facility-shell` */
  vars: Record<string, string>;
  brain: {
    coreWhite: string;
    reactorGold: string;
    neuralBlue: string;
    veinBlue: string;
  };
}

const NEURAL_DARK: FacilityThemeTokens = {
  id: "neural-dark",
  label: "Neural Dark",
  cssClass: "facility-theme-neural-dark",
  vars: {
    "--facility-bg": "#05070B",
    "--facility-bg-deep": "#071019",
    "--facility-bg-elevated": "#0A1320",
    "--facility-bg-glass": "rgb(8 14 22 / 0.78)",
    "--facility-border": "#152030",
    "--facility-border-subtle": "rgb(21 32 48 / 0.55)",
    "--facility-text": "#EAF2FF",
    "--facility-text-dim": "#A8B4C8",
    "--facility-text-muted": "#7E8CA3",
    "--facility-glow-gold": "rgb(255 209 102 / 0.55)",
    "--facility-glow-ceo": "rgb(255 209 102 / 0.45)",
    "--facility-glow-brain": "rgb(234 242 255 / 0.65)",
    "--facility-glow-blue": "rgb(56 189 248 / 0.4)",
    "--facility-glow-red": "rgb(248 113 113 / 0.4)",
    "--facility-glow-green": "rgb(34 197 94 / 0.4)",
    "--facility-shadow-deep": "0 8px 32px rgb(0 0 0 / 0.55)",
    "--facility-shadow-glass": "0 4px 24px rgb(0 0 0 / 0.35)",
    "--facility-bloom": "rgb(56 189 248 / 0.08)",
  },
  brain: {
    coreWhite: "#EAF2FF",
    reactorGold: "#FFD166",
    neuralBlue: "#38BDF8",
    veinBlue: "#22D3EE",
  },
};

/** Placeholder tokens for future themes — inherit Neural Dark structure. */
const THEME_REGISTRY: Record<FacilityThemeId, FacilityThemeTokens> = {
  "neural-dark": NEURAL_DARK,
  "cyber-blue": { ...NEURAL_DARK, id: "cyber-blue", label: "Cyber Blue", cssClass: "facility-theme-cyber-blue" },
  "matrix-green": { ...NEURAL_DARK, id: "matrix-green", label: "Matrix Green", cssClass: "facility-theme-matrix-green" },
  "stark-gold": { ...NEURAL_DARK, id: "stark-gold", label: "Stark Gold", cssClass: "facility-theme-stark-gold" },
  "void-black": { ...NEURAL_DARK, id: "void-black", label: "Void Black", cssClass: "facility-theme-void-black" },
};

export function getFacilityTheme(id: FacilityThemeId = ACTIVE_FACILITY_THEME): FacilityThemeTokens {
  return THEME_REGISTRY[id];
}

export function getAgentColor(agentId: AgentId): string {
  return AGENT_IDENTITY_COLORS[agentId];
}

export function getAgentGlow(agentId: AgentId, alpha = 0.45): string {
  const hex = AGENT_IDENTITY_COLORS[agentId];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

export function themeStyleProps(
  id: FacilityThemeId = ACTIVE_FACILITY_THEME,
): Record<string, string> {
  return getFacilityTheme(id).vars;
}

/** Future: sound, voice, conversation hooks per theme */
export interface FacilityThemeExtensions {
  soundEnabled: boolean;
  voiceAnnouncements: boolean;
  agentConversations: boolean;
}

export const THEME_EXTENSIONS: FacilityThemeExtensions = {
  soundEnabled: false,
  voiceAnnouncements: false,
  agentConversations: false,
};
