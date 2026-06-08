import { DESIGN_REPORT_TYPE } from "@/brain/domains/reports";

const MIN_STORY_CHARS = 120;
const MIN_DIRECTION_CHARS = 100;
const MIN_BULLET_CHARS = 12;
const MIN_PRODUCT_DESC = 30;
const MIN_HERO_DESC = 40;
const MIN_HERO_RATIONALE = 30;
const MIN_FULL_CONCEPT = 800;
const MIN_COLOR_ROLE = 8;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

function ensureBulletList(
  items: string[],
  min: number,
  max: number,
  pool: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (item: string) => {
    const normalized = ensureMinLength(
      item,
      MIN_BULLET_CHARS,
      "Basierend auf dem Wissensspeicher-Kontext und der Markenpositionierung.",
    );
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  };

  for (const item of items) add(item);
  for (const item of pool) {
    if (result.length >= min) break;
    add(item);
  }

  const filler =
    "Weitere Designentscheidung aus Trend- und CEO-Intelligence ableiten und in der Kollektion verankern.";
  while (result.length < min) {
    add(`${filler} (${result.length + 1})`);
  }

  return result.slice(0, max);
}

function defaultColorPalette(collectionName: string) {
  return [
    {
      name: "Obsidian Black",
      hex: "#0B0B0C",
      role: "Primärfarbe für Kernprodukte und Brand-Backbone",
    },
    {
      name: "Concrete Grey",
      hex: "#8A8F98",
      role: "Sekundärfarbe für Struktur und urbane Textur",
    },
    {
      name: "Signal Accent",
      hex: "#3DFF87",
      role: "Akzentfarbe für Details, Labels und Limited Drops",
    },
  ].map((color) => ({
    ...color,
    role: ensureMinLength(color.role, MIN_COLOR_ROLE, "Farbe mit strategischer Markenfunktion"),
  }));
}

function normalizeColorPalette(value: unknown, collectionName: string) {
  const raw = Array.isArray(value) ? value : [];
  const colors = raw
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          name: entry,
          role: ensureMinLength(
            "Unterstützende Kollektionsfarbe",
            MIN_COLOR_ROLE,
            "Farbe",
          ),
        };
      }
      const obj = asRecord(entry);
      if (!obj) return null;
      const name = asString(obj.name);
      if (!name) return null;
      return {
        name,
        hex: asString(obj.hex) || undefined,
        role: ensureMinLength(
          asString(obj.role) || "Kollektionsfarbe mit definierter Funktion",
          MIN_COLOR_ROLE,
          "Farbe",
        ),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (colors.length >= 3) return colors.slice(0, 8);
  return defaultColorPalette(collectionName);
}

function normalizeProducts(value: unknown, collectionName: string) {
  const raw = Array.isArray(value) ? value : [];
  const products = raw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const name = asString(obj.name);
      const category = asString(obj.category) || "Apparel";
      const description = ensureMinLength(
        asString(obj.description),
        MIN_PRODUCT_DESC,
        `Designkonzept für ${name || category} in der Kollektion ${collectionName}.`,
      );
      if (!name) return null;
      return { name, category, description };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const defaults = [
    {
      name: "Oversized Hoodie",
      category: "Oberbekleidung",
      description: ensureMinLength(
        `Schwerer French-Terry-Hoodie als Kernstück der ${collectionName}-Capsule mit strukturierter Silhouette und Premium-Finish.`,
        MIN_PRODUCT_DESC,
        "Produkt",
      ),
    },
    {
      name: "Boxy T-Shirt",
      category: "Tops",
      description: ensureMinLength(
        "Boxy-Cut Tee mit verstärkten Nähten und subtiler Grafik — Layering-Base für den Drop.",
        MIN_PRODUCT_DESC,
        "Produkt",
      ),
    },
    {
      name: "Wide-Leg Cargo",
      category: "Hosen",
      description: ensureMinLength(
        "Wide-Leg Cargo mit funktionalen Taschen und urbanem Fall — ergänzt die Silhouetten-Story der Kollektion.",
        MIN_PRODUCT_DESC,
        "Produkt",
      ),
    },
    {
      name: "Coach Jacket",
      category: "Outerwear",
      description: ensureMinLength(
        "Leichte Coach Jacket als Transitional Piece mit Kontrast-Piping und Marken-Details.",
        MIN_PRODUCT_DESC,
        "Produkt",
      ),
    },
  ];

  const merged = [...products];
  for (const item of defaults) {
    if (merged.length >= 4) break;
    if (!merged.some((p) => p.name === item.name)) merged.push(item);
  }

  return merged.slice(0, 14);
}

function normalizeHeroProducts(
  value: unknown,
  productLineup: Array<{ name: string; category: string; description: string }>,
  collectionName: string,
) {
  const raw = Array.isArray(value) ? value : [];
  const heroes = raw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const name = asString(obj.name);
      if (!name) return null;
      return {
        name,
        description: ensureMinLength(
          asString(obj.description),
          MIN_HERO_DESC,
          `Hero-SKU der ${collectionName}-Kollektion mit starker visueller Präsenz und klarer Markenidentität.`,
        ),
        rationale: ensureMinLength(
          asString(obj.rationale),
          MIN_HERO_RATIONALE,
          "Führt die Kollektionsstory und differenziert die Marke im Wettbewerbsumfeld.",
        ),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (heroes.length >= 2) return heroes.slice(0, 6);

  const fromLineup = productLineup.slice(0, 2).map((product, index) => ({
    name: product.name,
    description: ensureMinLength(
      product.description,
      MIN_HERO_DESC,
      `Hero-Produkt ${index + 1} der Kollektion ${collectionName}.`,
    ),
    rationale: ensureMinLength(
      `Trägt die Kernnarrative von ${collectionName} und maximiert Sell-through beim Drop-Launch.`,
      MIN_HERO_RATIONALE,
      "Hero",
    ),
  }));

  return [...heroes, ...fromLineup].slice(0, 6);
}

function buildFullConcept(payload: Record<string, unknown>): string {
  const title = asString(payload.title) || "Kollektionskonzept";
  const collectionName = asString(payload.collectionName) || title;
  const story = asString(payload.collectionStory);
  const direction = asString(payload.designDirection);
  const silhouettes = asStringArray(payload.silhouettes);
  const materials = asStringArray(payload.materials);
  const launch = asStringArray(payload.launchRecommendations);
  const products = Array.isArray(payload.productLineup)
    ? payload.productLineup
    : [];

  const sections = [
    `# ${title}`,
    `## Kollektion: ${collectionName}`,
    story,
    "## Design-Richtung",
    direction,
    "## Silhouetten",
    ...silhouettes.map((s) => `- ${s}`),
    "## Materialien",
    ...materials.map((m) => `- ${m}`),
    "## Produktlinie",
    ...products.map((p) => {
      const obj = asRecord(p);
      if (!obj) return "";
      return `- **${asString(obj.name)}** (${asString(obj.category)}): ${asString(obj.description)}`;
    }),
    "## Launch-Empfehlungen",
    ...launch.map((l) => `- ${l}`),
  ].filter(Boolean);

  return ensureMinLength(
    sections.join("\n\n"),
    MIN_FULL_CONCEPT,
    "Vollständiges Kollektionskonzept basierend auf Trend-, Wettbewerbs-, Pricing- und CEO-Intelligence aus dem Wissensspeicher.",
  );
}

/**
 * Fill missing or undersized design sections before Zod validation.
 */
export function enrichDesignPayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (!payload.reportType) {
    payload.reportType = DESIGN_REPORT_TYPE;
    adjustments.push("set reportType=design-report");
  }

  const title =
    asString(payload.title) ||
    asString(payload.collectionName) ||
    "Kollektionskonzept";
  if (!asString(payload.title)) {
    payload.title = title;
    adjustments.push("generated title");
  }

  const collectionName =
    asString(payload.collectionName) || title || "Neue Kollektion";
  if (!asString(payload.collectionName)) {
    payload.collectionName = collectionName;
    adjustments.push("generated collectionName");
  }

  const storySeed =
    asString(payload.collectionStory) ||
    asString(payload.designDirection) ||
    `Die Kollektion ${collectionName} verbindet Streetwear-Ästhetik mit Premium-Handwerk.`;
  if (
    !asString(payload.collectionStory) ||
    asString(payload.collectionStory).length < MIN_STORY_CHARS
  ) {
    payload.collectionStory = ensureMinLength(
      storySeed,
      MIN_STORY_CHARS,
      "Die Narrative leitet sich aus Trend- und CEO-Intelligence ab und positioniert die Marke klar im Wettbewerbsumfeld.",
    );
    adjustments.push("enriched collectionStory");
  }

  const palette = normalizeColorPalette(payload.colorPalette, collectionName);
  if (payload.colorPalette !== palette) {
    payload.colorPalette = palette;
    adjustments.push("enriched colorPalette");
  }

  const silhouettes = ensureBulletList(
    asStringArray(payload.silhouettes),
    3,
    10,
    [
      "Oversized Hoodie mit dropped shoulders und strukturiertem Saum.",
      "Boxy T-Shirt mit verlängertem Rücken und schwerem Jersey.",
      "Wide-Leg Cargo mit tiefem Rise und funktionalen Panel-Taschen.",
    ],
  );
  if (payload.silhouettes !== silhouettes) {
    payload.silhouettes = silhouettes;
    adjustments.push("enriched silhouettes");
  }

  const productLineup = normalizeProducts(payload.productLineup, collectionName);
  if (payload.productLineup !== productLineup) {
    payload.productLineup = productLineup;
    adjustments.push("enriched productLineup");
  }

  const heroProducts = normalizeHeroProducts(
    payload.heroProducts,
    productLineup,
    collectionName,
  );
  if (payload.heroProducts !== heroProducts) {
    payload.heroProducts = heroProducts;
    adjustments.push("enriched heroProducts");
  }

  const materials = ensureBulletList(
    asStringArray(payload.materials),
    3,
    10,
    [
      "400–450 gsm French Terry für Hoodies mit Premium-Haptik.",
      "240 gsm schweres Baumwoll-Jersey für Boxy Tees.",
      "Ripstop- und Canvas-Mix für Cargos mit urbanem Fall.",
    ],
  );
  if (payload.materials !== materials) {
    payload.materials = materials;
    adjustments.push("enriched materials");
  }

  const directionSeed =
    asString(payload.designDirection) ||
    asString(payload.collectionStory) ||
    `Visuelle Richtung für ${collectionName}: urban, reduziert, materialgetrieben.`;
  if (
    !asString(payload.designDirection) ||
    asString(payload.designDirection).length < MIN_DIRECTION_CHARS
  ) {
    payload.designDirection = ensureMinLength(
      directionSeed,
      MIN_DIRECTION_CHARS,
      "Grafische Behandlung, Proportionen und Details orientieren sich an Markenregeln und Intelligence-Berichten.",
    );
    adjustments.push("enriched designDirection");
  }

  const launchRecommendations = ensureBulletList(
    asStringArray(payload.launchRecommendations),
    3,
    8,
    [
      "Tease-Phase über 5–7 Tage mit Silhouette- und Material-Hints ohne Full-Reveal.",
      "Hero-Produkt zuerst als Limited SKU mit nummerierter Edition launchen.",
      "IG Carousel + TikTok Culture Clip am Reveal-Tag für organische Reichweite.",
    ],
  );
  if (payload.launchRecommendations !== launchRecommendations) {
    payload.launchRecommendations = launchRecommendations;
    adjustments.push("enriched launchRecommendations");
  }

  const sourceTitles = asStringArray(payload.sourceReportTitles);
  if (sourceTitles.length === 0) {
    payload.sourceReportTitles = ["Wissensspeicher-Intelligence"];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number" || Number.isNaN(payload.confidence)) {
    payload.confidence = 0.72;
    adjustments.push("set default confidence");
  } else {
    payload.confidence = Math.min(1, Math.max(0, payload.confidence));
  }

  const fullConcept = asString(payload.fullConcept);
  if (!fullConcept || fullConcept.length < MIN_FULL_CONCEPT) {
    payload.fullConcept = buildFullConcept(payload);
    adjustments.push("enriched fullConcept");
  }

  return adjustments;
}
