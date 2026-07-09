import type { BrandRulesContent } from "@/brain/domains/brand-rules";
import type { BrandVisionContent } from "@/brain/domains/brand-vision";
import type { CompanyProfileContent } from "@/brain/domains/company-profile";
import { HQ_INDUSTRY_PACKS } from "@/brain/platform/industries";
import type { WorkspaceSeedRecord } from "../types";

export interface FashionHqSeedInput {
  name: string;
}

function buildCompanyProfile(name: string): CompanyProfileContent {
  return {
    kind: "company_profile",
    companyName: name,
    industry: "fashion_hq",
    businessModel:
      "Direct-to-Consumer-Streetwear. Premium-zugängliche Preisgestaltung. Limitierte Drops — kein Fast Fashion. Jedes Stück erzählt ein Kapitel.",
    targetAudience:
      "Urbane Kreative im Alter von 18–30 — Fotografen, Musiker, Designer und kulturaffine Studierende in Großstädten (NYC, LA, London, Tokio). Mobile-first Käufer, die Authentizität vor Hype schätzen, Underground vor Mainstream folgen und auf Knappheit und Story reagieren.",
    goals: [
      "4 Major Drops pro Jahr mit 85 %+ Sell-through-Rate",
      "VIP-Wiederholungskäufer-Basis mit Ziel 15 % des Umsatzes aufbauen",
      "Visuelle und stimmliche Kohärenz über jeden Touchpoint hinweg sicherstellen",
      "Markenintelligenz jede Saison über den Wissensspeicher verstärken",
    ],
    kpis: [
      { name: "Sell-through-Rate", target: ">85%", period: "pro Drop" },
      { name: "E-Mail-Öffnungsrate", target: ">40%", period: "Drop-Kampagnen" },
      { name: "IG-Save-Rate", target: ">5%", period: "Drop-Posts" },
      { name: "VIP-Umsatzanteil", target: "15%", period: "jährlich" },
    ],
    integrations: [
      { id: "openai", name: "OpenAI", status: "active" },
      { id: "supabase", name: "Supabase", status: "active" },
      { id: "shopify", name: "Shopify", status: "planned" },
      { id: "instagram", name: "Instagram", status: "planned" },
    ],
    activeModules: HQ_INDUSTRY_PACKS.fashion_hq.availableModules,
  };
}

function buildBrandVision(name: string): BrandVisionContent {
  return {
    kind: "brand_vision",
    mission: `${name} ist eine Streetwear-Marke für urbane Kreative, die zwischen Kultur, Kunst und Stadt leben — aufgebaut auf Knappheit, Story und visueller Identität.`,
    positioning:
      "Premium-zugängliche Streetwear. Limitierte Drops, kein Fast Fashion. Jedes Stück erzählt ein Kapitel.",
    northStar:
      "Eine Weltklasse-Streetwear-Marke führen — mit der Klarheit einer Kommandozentrale und der Geschwindigkeit eines KI-nativen Teams.",
    voiceTone:
      "Selbstbewusst, minimal, kulturell versiert. Nie aufdringlich. Wie ein Insider sprechen, nicht wie ein Marketer.",
    culturalIdentity:
      "Streetwear verwurzelt in Stadtkultur — Fotografie, Musik, Design und der Underground vor dem Mainstream.",
    pillars: [
      {
        name: "Kultur zuerst",
        description:
          "Jeder Drop ist ein kulturelles Statement, nicht nur ein Produktrelease.",
      },
      {
        name: "Drop-Kadenz",
        description:
          "Knappheit by Design. Limitierte Runs, die Dringlichkeit und Community erzeugen.",
      },
      {
        name: "Visuelle Kohärenz",
        description:
          "Obsidian, Beton, Signalgrün. Eine visuelle Sprache über jeden Touchpoint.",
      },
      {
        name: "Community-Knappheit",
        description:
          "VIP-Zugang, Insider-Ton und Drops, die Loyalität belohnen.",
      },
    ],
    audienceSegments: [
      {
        name: "Primär — Urbane Kreative",
        description:
          "Fotografen, Musiker, Designer und kulturaffine Studierende im Alter von 18–30.",
        demographics: "18–30, urban, Kreativbranchen und Studierende",
        psychographics:
          "Schätzt Authentizität vor Hype. Folgt Underground vor Mainstream. Kauft Drops, keine Kataloge.",
        geography: ["NYC", "LA", "London", "Tokio"],
        tags: ["primary"],
      },
      {
        name: "VIP-Wiederholungskäufer",
        description:
          "Kunden, die innerhalb von 2 Drops kaufen. Early Access, Insider-Kommunikation.",
        psychographics:
          "Reagiert auf Knappheit und Story. Durchschnittlicher Warenkorb 120–280 $. Mobile-first.",
        tags: ["vip", "retention"],
      },
    ],
  };
}

function buildBrandRules(): BrandRulesContent {
  return {
    kind: "brand_rules",
    globalConstraints: [
      "Kein Ausrufezeichen-Spam in Copy",
      "Produktnamen immer großgeschrieben",
      "Drop-Daten immer in lokaler Zeit",
      "Logo-Lockup nie gestreckt oder außerhalb des Brand Sheets eingefärbt",
      "Kein Neon-Overload — Signalgrün nur als Akzent für Drops",
    ],
    rules: [
      {
        id: "voice-confidence",
        category: "voice",
        rule: "Mit Selbstbewusstsein und wenigen Worten sprechen. Nie aufdringlich oder mit Marketer-Sprech.",
        severity: "must",
        examples: {
          good: ["Der Drop landet Freitag.", "Gebaut für die Stadt."],
          bad: [
            "OMG unser TOLLESTER neuer Drop!!!",
            "Verpasse nicht diese unglaubliche Chance!",
          ],
        },
      },
      {
        id: "voice-insider",
        category: "voice",
        rule: "Wie ein Insider sprechen, nicht wie ein Marketer. Kulturell versiert, nie corporate.",
        severity: "must",
      },
      {
        id: "copy-brevity",
        category: "copy",
        rule: "Kurze Sätze. Kein Ausrufezeichen-Spam. Produkt und Story atmen lassen.",
        severity: "must",
      },
      {
        id: "copy-product-names",
        category: "naming",
        rule: "Produktnamen in allen Texten immer großgeschrieben.",
        severity: "must",
      },
      {
        id: "design-palette",
        category: "other",
        rule: "Kernpalette: Obsidian-Schwarz, Off-White, Betongrau. Signalgrün nur für Drops.",
        severity: "must",
      },
      {
        id: "design-silhouettes",
        category: "other",
        rule: "Oversized Hoodies, Boxy Tees, Wide-Leg-Cargos, strukturierte Caps. Keine Skinny Fits.",
        severity: "should",
      },
      {
        id: "values-authenticity",
        category: "voice",
        rule: "Authentizität vor Hype — nie Trends jagen, die der Markenidentität widersprechen.",
        severity: "must",
      },
      {
        id: "values-scarcity",
        category: "voice",
        rule: "Knappheit und Story treiben jeden Drop. Limitierte Runs, kein endloser Katalog.",
        severity: "must",
      },
      {
        id: "values-culture",
        category: "voice",
        rule: "Kultur zuerst — jedes Stück muss mit Stadtkultur, Kunst oder Community verbunden sein.",
        severity: "must",
      },
      {
        id: "values-coherence",
        category: "compliance",
        rule: "Visuelle und stimmliche Kohärenz über alle Kanäle — IG, Site, E-Mail, Shopify.",
        severity: "must",
      },
    ],
  };
}

/** Build Fashion HQ seed records scoped to a workspace display name. */
export function createFashionHqSeedRecords(
  input: FashionHqSeedInput,
): WorkspaceSeedRecord[] {
  const { name } = input;
  const companyProfile = buildCompanyProfile(name);
  const brandVision = buildBrandVision(name);
  const brandRules = buildBrandRules();

  return [
    {
      domain: "company_profile",
      slug: "profile",
      title: `${name} Unternehmensprofil`,
      summary: `Kernidentität des Unternehmens und Workspace-Konfiguration für den ${name}-Workspace.`,
      content: companyProfile,
      tags: ["core", "bootstrap"],
    },
    {
      domain: "brand_vision",
      slug: "vision",
      title: `${name} Markenvision`,
      summary: "Nordstern, Positionierung, Säulen und Zielgruppendefinition.",
      content: brandVision,
      tags: ["brand", "vision"],
    },
    {
      domain: "brand_rules",
      slug: "rules",
      title: `${name} Markenregeln`,
      summary: "Stimme, Copy, Design und Markenwert-Leitplanken.",
      content: brandRules,
      tags: ["brand", "rules"],
    },
  ];
}
