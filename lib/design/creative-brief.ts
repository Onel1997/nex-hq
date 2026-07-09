import type { BrainDesignSections } from "@/brain/domains/reports";

const EXCERPT = 320;

function truncate(text: string, max = EXCERPT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function bullet(items: string[] | undefined, max = 8): string {
  if (!items?.length) return "";
  return items.slice(0, max).map((item) => `  - ${item}`).join("\n");
}

/**
 * Format structured design sections for downstream agent prompts (Image, Content, Marketing).
 */
export function formatDesignCreativeBrief(
  sections: BrainDesignSections,
): string {
  const story = sections.story ?? sections.collectionStory;
  const direction =
    sections.stylingDirection ?? sections.designDirection;
  const products = sections.products?.length
    ? sections.products
    : sections.productLineup.map((p) => ({
        name: p.name,
        category: p.category,
        fit: "—",
        material: "—",
        color: "—",
        details: p.description,
        pricePosition: "—",
        priority: "core" as const,
      }));

  const lines: string[] = [
    `Kollektion: ${sections.collectionName}`,
  ];

  if (sections.season) lines.push(`Saison: ${sections.season}`);
  if (sections.theme) lines.push(`Theme: ${sections.theme}`);
  lines.push(`Story: ${truncate(story, 500)}`);
  if (sections.targetAudience) {
    lines.push(`Zielgruppe: ${truncate(sections.targetAudience, 240)}`);
  }
  if (sections.moodDescription) {
    lines.push(`Mood: ${truncate(sections.moodDescription, 240)}`);
  }

  if (sections.colorPalette.length) {
    lines.push(
      "Farbpalette:",
      ...sections.colorPalette.slice(0, 8).map(
        (c) =>
          `  - ${c.name}${c.hex ? ` (${c.hex})` : ""}: ${c.role}`,
      ),
    );
  }

  if (sections.materials.length) {
    lines.push("Materialien:", bullet(sections.materials));
  }

  if (sections.silhouettes.length) {
    lines.push("Silhouetten:", bullet(sections.silhouettes));
  }

  if (sections.fits?.length) {
    lines.push("Fits:", bullet(sections.fits));
  }

  lines.push(`Styling Direction: ${truncate(direction, 400)}`);

  if (sections.photographyStyle) {
    lines.push(`Fotografie-Stil: ${truncate(sections.photographyStyle, 240)}`);
  }

  if (sections.visualKeywords?.length) {
    lines.push("Visual Keywords:", bullet(sections.visualKeywords, 12));
  }

  if (sections.mockupIdeas?.length) {
    lines.push("Mockup Ideas:", bullet(sections.mockupIdeas));
  }

  if (sections.imagePrompts?.length) {
    lines.push("Image Prompts:", bullet(sections.imagePrompts, 6));
  }

  if (sections.campaignIdeas?.length) {
    lines.push("Campaign References:", bullet(sections.campaignIdeas));
  } else if (sections.launchRecommendations.length) {
    lines.push("Campaign References:", bullet(sections.launchRecommendations));
  }

  if (products.length) {
    lines.push("Produktlinie:");
    for (const product of products.slice(0, 10)) {
      lines.push(
        `  - ${product.name} (${product.category}, ${product.priority})`,
        `    Fit: ${product.fit} · Material: ${product.material} · Farbe: ${product.color}`,
        `    ${truncate(product.details, 180)} · ${product.pricePosition}`,
      );
    }
  }

  return lines.filter(Boolean).join("\n");
}

/** Extract Image Agent inputs from the latest design report sections. */
export function extractImageInputsFromDesign(
  sections: BrainDesignSections,
): {
  visualKeywords: string[];
  colorPalette: BrainDesignSections["colorPalette"];
  moodDescription: string;
  stylingDirection: string;
  mockupIdeas: string[];
  imagePrompts: string[];
} {
  return {
    visualKeywords:
      sections.visualKeywords ??
      sections.silhouettes.slice(0, 6),
    colorPalette: sections.colorPalette,
    moodDescription:
      sections.moodDescription ??
      sections.story ??
      sections.collectionStory,
    stylingDirection:
      sections.stylingDirection ?? sections.designDirection,
    mockupIdeas:
      sections.mockupIdeas ??
      sections.launchRecommendations.slice(0, 6),
    imagePrompts: sections.imagePrompts ?? [],
  };
}
