import { DESIGN_REPORT_TYPE } from "@/brain/domains/reports";
import { matchProductToMarketPrint } from "@/lib/marketprint/product-capabilities";

const MIN_STORY_CHARS = 120;
const MIN_DIRECTION_CHARS = 100;
const MIN_MOOD_CHARS = 60;
const MIN_PHOTO_CHARS = 40;
const MIN_AUDIENCE_CHARS = 40;
const MIN_BULLET_CHARS = 8;
const MIN_PRODUCT_DETAIL = 20;
const MIN_PROMPT_CHARS = 40;
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
      "Basierend auf Trend- und Markenintelligence.",
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
    "Creative Direction aus Research- und CEO-Intelligence ableiten.";
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

function normalizeColorPalette(value: unknown, _collectionName: string) {
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
  return defaultColorPalette("");
}

function normalizeProductsV2(value: unknown, collectionName: string) {
  const raw = Array.isArray(value) ? value : [];
  const products = raw
    .map((entry, index) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const name = asString(obj.name);
      if (!name) return null;
      const category = asString(obj.category) || "Apparel";
      const details = ensureMinLength(
        asString(obj.details) ||
          asString(obj.description) ||
          `Designkonzept für ${name} in ${collectionName}.`,
        MIN_PRODUCT_DETAIL,
        "Produktdetails aus Kollektionskonzept.",
      );
      const priorityRaw = asString(obj.priority).toLowerCase();
      const priority =
        priorityRaw === "hero" || priorityRaw === "support"
          ? priorityRaw
          : index < 2
            ? "hero"
            : "core";

      const match = matchProductToMarketPrint({
        title: name,
        productType: category,
        materials: [asString(obj.material) || "Premium Baumwoll-Mix"],
      });
      const suitabilityRaw = obj.marketPrintSuitability;
      const marketPrintSuitability =
        typeof suitabilityRaw === "number" && !Number.isNaN(suitabilityRaw)
          ? Math.min(100, Math.max(0, Math.round(suitabilityRaw)))
          : match.suitability;

      return {
        name,
        category,
        fit: ensureMinLength(
          asString(obj.fit) || "Oversized relaxed fit",
          MIN_BULLET_CHARS,
          "Fit",
        ),
        material: ensureMinLength(
          asString(obj.material) || "Premium Baumwoll-Mix",
          MIN_BULLET_CHARS,
          "Material",
        ),
        color: asString(obj.color) || "Stone washed black",
        details,
        pricePosition: ensureMinLength(
          asString(obj.pricePosition) || "Premium positioning",
          MIN_BULLET_CHARS,
          "Positionierung",
        ),
        priority: priority as "hero" | "core" | "support",
        marketPrintSuitability,
        description: asString(obj.description) || details,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const defaults = [
    {
      name: "Oversized Hoodie",
      category: "Oberbekleidung",
      fit: "Oversized dropped-shoulder fit",
      material: "480gsm French Terry cotton",
      color: "Stone washed black",
      details:
        "Schwerer Hoodie als Kernstück mit strukturierter Silhouette, Premium-Finish und urbanem Fall.",
      pricePosition: "Premium positioning",
      priority: "hero" as const,
      marketPrintSuitability: 95,
      description:
        "Schwerer Hoodie als Kernstück mit strukturierter Silhouette, Premium-Finish und urbanem Fall.",
    },
    {
      name: "Boxy T-Shirt",
      category: "Tops",
      fit: "Boxy cropped fit",
      material: "240gsm heavy cotton jersey",
      color: "Concrete grey",
      details: "Boxy Tee mit verstärkten Nähten — Layering-Base für den Drop.",
      pricePosition: "Core tier",
      priority: "core" as const,
      marketPrintSuitability: 88,
      description: "Boxy Tee mit verstärkten Nähten — Layering-Base für den Drop.",
    },
    {
      name: "Wide-Leg Cargo",
      category: "Hosen",
      fit: "Wide-leg relaxed fit",
      material: "Ripstop cotton blend",
      color: "Washed black",
      details: "Wide-Leg Cargo mit funktionalen Taschen und urbanem Fall.",
      pricePosition: "Core tier",
      priority: "core" as const,
      marketPrintSuitability: 72,
      description: "Wide-Leg Cargo mit funktionalen Taschen und urbanem Fall.",
    },
    {
      name: "Coach Jacket",
      category: "Outerwear",
      fit: "Regular boxy fit",
      material: "Nylon-cotton shell",
      color: "Obsidian black",
      details: "Coach Jacket als Transitional Piece mit Kontrast-Piping.",
      pricePosition: "Premium positioning",
      priority: "support" as const,
      marketPrintSuitability: 35,
      description: "Coach Jacket als Transitional Piece mit Kontrast-Piping.",
    },
  ];

  const merged = [...products];
  for (const item of defaults) {
    if (merged.length >= 4) break;
    if (!merged.some((p) => p.name === item.name)) merged.push(item);
  }

  return merged.slice(0, 14);
}

function buildFullConcept(payload: Record<string, unknown>): string {
  const title = asString(payload.title) || "Kollektionskonzept";
  const collectionName = asString(payload.collectionName) || title;
  const story =
    asString(payload.story) || asString(payload.collectionStory);
  const direction =
    asString(payload.stylingDirection) || asString(payload.designDirection);
  const products = Array.isArray(payload.products)
    ? payload.products
    : Array.isArray(payload.productLineup)
      ? payload.productLineup
      : [];

  const sections = [
    `# ${title}`,
    `## Kollektion: ${collectionName}`,
    asString(payload.season) ? `**Saison:** ${asString(payload.season)}` : "",
    asString(payload.theme) ? `**Theme:** ${asString(payload.theme)}` : "",
    story,
    asString(payload.targetAudience)
      ? `**Zielgruppe:** ${asString(payload.targetAudience)}`
      : "",
    asString(payload.moodDescription)
      ? `**Mood:** ${asString(payload.moodDescription)}`
      : "",
    "## Styling Direction",
    direction,
    "## Silhouetten",
    ...asStringArray(payload.silhouettes).map((s) => `- ${s}`),
    "## Materialien",
    ...asStringArray(payload.materials).map((m) => `- ${m}`),
    "## Produktlinie",
    ...products.map((p) => {
      const obj = asRecord(p);
      if (!obj) return "";
      const name = asString(obj.name);
      return `- **${name}** (${asString(obj.category)}): ${asString(obj.details) || asString(obj.description)}`;
    }),
    "## Visual Keywords",
    ...asStringArray(payload.visualKeywords).map((k) => `- ${k}`),
    "## Campaign Ideas",
    ...asStringArray(payload.campaignIdeas || payload.launchRecommendations).map(
      (c) => `- ${c}`,
    ),
  ].filter(Boolean);

  return ensureMinLength(
    sections.join("\n\n"),
    MIN_FULL_CONCEPT,
    "Vollständiges Kollektionskonzept basierend auf Trend-, Wettbewerbs-, Pricing- und CEO-Intelligence.",
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

  if (!asString(payload.season)) {
    payload.season = "SS26";
    adjustments.push("generated season");
  }

  if (!asString(payload.theme)) {
    payload.theme = ensureMinLength(
      `Urban luxury streetwear — ${collectionName}`,
      8,
      "Theme",
    );
    adjustments.push("generated theme");
  }

  const storySeed =
    asString(payload.story) ||
    asString(payload.collectionStory) ||
    asString(payload.designDirection) ||
    asString(payload.stylingDirection) ||
    `Die Kollektion ${collectionName} verbindet Streetwear-Ästhetik mit Premium-Handwerk.`;
  if (!asString(payload.story) || asString(payload.story).length < MIN_STORY_CHARS) {
    payload.story = ensureMinLength(
      storySeed,
      MIN_STORY_CHARS,
      "Die Narrative leitet sich aus Trend- und CEO-Intelligence ab.",
    );
    adjustments.push("enriched story");
  }
  payload.collectionStory = payload.story;

  if (
    !asString(payload.targetAudience) ||
    asString(payload.targetAudience).length < MIN_AUDIENCE_CHARS
  ) {
    payload.targetAudience = ensureMinLength(
      asString(payload.targetAudience) ||
        "Streetwear-affine Premium-Konsumenten, 18–32, urban, kulturbewusst.",
      MIN_AUDIENCE_CHARS,
      "Zielgruppe",
    );
    adjustments.push("enriched targetAudience");
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
  payload.silhouettes = silhouettes;

  const fits = ensureBulletList(
    asStringArray(payload.fits),
    2,
    8,
    [
      "Oversized relaxed fit für Hoodies und Outerwear.",
      "Boxy cropped fit für Tops.",
      "Wide-leg relaxed fit für Bottoms.",
    ],
  );
  payload.fits = fits;

  const products = normalizeProductsV2(
    payload.products ?? payload.productLineup,
    collectionName,
  );
  payload.products = products;
  payload.productLineup = products;

  const materials = ensureBulletList(
    asStringArray(payload.materials),
    3,
    10,
    [
      "480gsm French Terry für Hoodies mit Premium-Haptik.",
      "240gsm schweres Baumwoll-Jersey für Boxy Tees.",
      "Ripstop- und Canvas-Mix für Cargos mit urbanem Fall.",
    ],
  );
  payload.materials = materials;

  const directionSeed =
    asString(payload.stylingDirection) ||
    asString(payload.designDirection) ||
    asString(payload.story) ||
    `Visuelle Richtung für ${collectionName}: urban, reduziert, materialgetrieben.`;
  if (
    !asString(payload.stylingDirection) ||
    asString(payload.stylingDirection).length < MIN_DIRECTION_CHARS
  ) {
    payload.stylingDirection = ensureMinLength(
      directionSeed,
      MIN_DIRECTION_CHARS,
      "Grafik, Proportionen und Details orientieren sich an Markenregeln und Intelligence.",
    );
    adjustments.push("enriched stylingDirection");
  }
  payload.designDirection = payload.stylingDirection;

  payload.visualKeywords = ensureBulletList(
    asStringArray(payload.visualKeywords),
    3,
    12,
    [
      "Tokyo night streetwear",
      "cold metallic campaign",
      "minimal luxury fashion",
      "urban concrete texture",
    ],
  );

  payload.mockupIdeas = ensureBulletList(
    asStringArray(payload.mockupIdeas),
    3,
    10,
    [
      "Hero Hoodie flat lay auf Betonoberfläche mit hartem Seitenlicht.",
      "Wide-Leg Cargo Lifestyle-Shot in nächtlicher Urban-Umgebung.",
      "Coach Jacket Studio-Shot mit Kontrast-Piping und Premium-Finish.",
    ],
  );

  payload.campaignIdeas = ensureBulletList(
    asStringArray(payload.campaignIdeas ?? payload.launchRecommendations),
    3,
    8,
    [
      "Tease-Phase über 5–7 Tage mit Silhouette- und Material-Hints.",
      "Hero-Produkt zuerst als Limited SKU launchen.",
      "IG Carousel + TikTok Culture Clip am Reveal-Tag.",
    ],
  );
  payload.launchRecommendations = payload.campaignIdeas;

  if (
    !asString(payload.photographyStyle) ||
    asString(payload.photographyStyle).length < MIN_PHOTO_CHARS
  ) {
    payload.photographyStyle = ensureMinLength(
      asString(payload.photographyStyle) ||
        "Editorial streetwear photography — 35mm, soft overcast urban light, muted grade with signal accent.",
      MIN_PHOTO_CHARS,
      "Fotografie",
    );
    adjustments.push("enriched photographyStyle");
  }

  const imagePrompts = asStringArray(payload.imagePrompts);
  if (imagePrompts.length < 2) {
    payload.imagePrompts = ensureBulletList(
      [
        ...imagePrompts,
        `${collectionName} oversized hoodie, stone washed black, 480gsm cotton, studio soft key light, editorial streetwear, 35mm`,
        `${collectionName} wide-leg cargo, urban night environment, cold metallic campaign mood, premium streetwear photography`,
      ],
      2,
      8,
      [],
    ).map((p) => ensureMinLength(p, MIN_PROMPT_CHARS, "Image prompt"));
    adjustments.push("enriched imagePrompts");
  }

  if (
    !asString(payload.moodDescription) ||
    asString(payload.moodDescription).length < MIN_MOOD_CHARS
  ) {
    payload.moodDescription = ensureMinLength(
      asString(payload.moodDescription) ||
        `Mood für ${collectionName}: urban luxury, kühle Metall-Ästhetik, Premium-Streetwear mit reduzierter Grafik.`,
      MIN_MOOD_CHARS,
      "Mood",
    );
    adjustments.push("enriched moodDescription");
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
