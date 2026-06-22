/** Canonical Brain Core agent identity colors. */

export const BRAIN_CORE_AGENT_COLORS = {
  ceo: "#FFD54A",
  research: "#4BE7FF",
  commerce: "#56FF84",
  designer: "#FFFFFF",
  marketing: "#FFB347",
  content: "#B66BFF",
  image: "#FF62D8",
  shopify: "#5DFFD7",
} as const;

export type BrainCoreAgentColorId = keyof typeof BRAIN_CORE_AGENT_COLORS;

/** Lighter CEO core highlight for active states. */
export const BRAIN_CORE_CEO_ACTIVE = "#FFE566";

/** Warm amber secondary for CEO glow layers. */
export const BRAIN_CORE_CEO_AMBER_RGB = "255 193 30";

/** CEO primary as space-separated RGB for CSS. */
export const BRAIN_CORE_CEO_RGB = "255 213 74";
