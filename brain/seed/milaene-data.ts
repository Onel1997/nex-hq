import type { BrandRulesContent } from "@/brain/domains/brand-rules";
import type { BrandVisionContent } from "@/brain/domains/brand-vision";
import type { CompanyProfileContent } from "@/brain/domains/company-profile";
import { HQ_INDUSTRY_PACKS } from "@/brain/platform/industries";

export const MILAENE_COMPANY_PROFILE: CompanyProfileContent = {
  kind: "company_profile",
  companyName: "Milaene",
  industry: "fashion_hq",
  businessModel:
    "Direct-to-consumer streetwear. Premium-accessible pricing. Limited drops — not fast fashion. Every piece tells a chapter.",
  targetAudience:
    "Urban creatives aged 18–30 — photographers, musicians, designers, and culture-forward students in major cities (NYC, LA, London, Tokyo). Mobile-first buyers who value authenticity over hype, follow underground before mainstream, and respond to scarcity and story.",
  goals: [
    "4 major drops per year with 85%+ sell-through rate",
    "Build VIP repeat buyer base targeting 15% of revenue",
    "Maintain visual and voice coherence across every touchpoint",
    "Compound brand intelligence every season through the Brain",
  ],
  kpis: [
    { name: "Sell-through rate", target: ">85%", period: "per drop" },
    { name: "Email open rate", target: ">40%", period: "drop campaigns" },
    { name: "IG save rate", target: ">5%", period: "drop posts" },
    { name: "VIP revenue share", target: "15%", period: "annual" },
  ],
  integrations: [
    { id: "openai", name: "OpenAI", status: "active" },
    { id: "supabase", name: "Supabase", status: "active" },
    { id: "shopify", name: "Shopify", status: "planned" },
    { id: "instagram", name: "Instagram", status: "planned" },
  ],
  activeModules: HQ_INDUSTRY_PACKS.fashion_hq.availableModules,
};

export const MILAENE_BRAND_VISION: BrandVisionContent = {
  kind: "brand_vision",
  mission:
    "Milaene is a streetwear brand for urban creatives who move between culture, art, and the city — built on scarcity, story, and visual identity.",
  positioning:
    "Premium-accessible streetwear. Limited drops, not fast fashion. Every piece tells a chapter.",
  northStar:
    "Run a world-class streetwear brand with the clarity of a command center and the speed of an AI-native team.",
  voiceTone:
    "Confident, minimal, culturally fluent. Never try-hard. Speak like an insider, not a marketer.",
  culturalIdentity:
    "Streetwear rooted in city culture — photography, music, design, and the underground before the mainstream.",
  pillars: [
    {
      name: "Culture-first",
      description: "Every drop is a cultural statement, not just a product release.",
    },
    {
      name: "Drop cadence",
      description: "Scarcity by design. Limited runs that create urgency and community.",
    },
    {
      name: "Visual coherence",
      description: "Obsidian, concrete, signal green. One visual language across every touchpoint.",
    },
    {
      name: "Community scarcity",
      description: "VIP access, insider tone, and drops that reward loyalty.",
    },
  ],
  audienceSegments: [
    {
      name: "Primary — Urban Creatives",
      description:
        "Photographers, musicians, designers, and culture-forward students aged 18–30.",
      demographics: "18–30, urban, creative industries and students",
      psychographics:
        "Values authenticity over hype. Follows underground before mainstream. Buys drops, not catalogs.",
      geography: ["NYC", "LA", "London", "Tokyo"],
      tags: ["primary"],
    },
    {
      name: "VIP Repeat Buyers",
      description:
        "Customers who purchase within 2 drops. Early access, insider communication.",
      psychographics:
        "Responds to scarcity and story. Average cart $120–$280. Mobile-first.",
      tags: ["vip", "retention"],
    },
  ],
};

export const MILAENE_BRAND_RULES: BrandRulesContent = {
  kind: "brand_rules",
  globalConstraints: [
    "Never use exclamation spam in copy",
    "Product names always capitalized",
    "Drop dates always in local time",
    "Logo lockup never stretched or recolored outside brand sheet",
    "No neon overload — signal green is accent only, for drops",
  ],
  rules: [
    {
      id: "voice-confidence",
      category: "voice",
      rule: "Speak with confidence and minimal words. Never try-hard or use marketer-speak.",
      severity: "must",
      examples: {
        good: ["The drop lands Friday.", "Built for the city."],
        bad: ["OMG our AMAZING new drop!!!", "Don't miss this incredible opportunity!"],
      },
    },
    {
      id: "voice-insider",
      category: "voice",
      rule: "Speak like an insider, not a marketer. Culturally fluent, never corporate.",
      severity: "must",
    },
    {
      id: "copy-brevity",
      category: "copy",
      rule: "Short sentences. No exclamation spam. Let the product and story breathe.",
      severity: "must",
    },
    {
      id: "copy-product-names",
      category: "naming",
      rule: "Product names always capitalized in all copy.",
      severity: "must",
    },
    {
      id: "design-palette",
      category: "other",
      rule: "Core palette: obsidian black, off-white, concrete grey. Signal green for drops only.",
      severity: "must",
    },
    {
      id: "design-silhouettes",
      category: "other",
      rule: "Oversized hoodies, boxy tees, wide-leg cargos, structured caps. No skinny fits.",
      severity: "should",
    },
    {
      id: "values-authenticity",
      category: "voice",
      rule: "Authenticity over hype — never chase trends that conflict with brand identity.",
      severity: "must",
    },
    {
      id: "values-scarcity",
      category: "voice",
      rule: "Scarcity and story drive every drop. Limited runs, not endless catalog.",
      severity: "must",
    },
    {
      id: "values-culture",
      category: "voice",
      rule: "Culture-first — every piece must connect to city culture, art, or community.",
      severity: "must",
    },
    {
      id: "values-coherence",
      category: "compliance",
      rule: "Visual and voice coherence across all channels — IG, site, email, Shopify.",
      severity: "must",
    },
  ],
};

export const MILAENE_SEED_RECORDS = [
  {
    domain: "company_profile" as const,
    slug: "profile",
    title: "Milaene Company Profile",
    summary: "Core company identity and platform configuration for Milaene HQ.",
    content: MILAENE_COMPANY_PROFILE,
    tags: ["core", "bootstrap"],
  },
  {
    domain: "brand_vision" as const,
    slug: "vision",
    title: "Milaene Brand Vision",
    summary: "North star, positioning, pillars, and audience definition.",
    content: MILAENE_BRAND_VISION,
    tags: ["brand", "vision"],
  },
  {
    domain: "brand_rules" as const,
    slug: "rules",
    title: "Milaene Brand Rules",
    summary: "Voice, copy, design, and brand value guardrails.",
    content: MILAENE_BRAND_RULES,
    tags: ["brand", "rules"],
  },
];
