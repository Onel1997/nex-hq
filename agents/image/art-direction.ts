import type { ImageAiPrompts } from "./normalized";

const MIN_PROMPT = 80;

function padPrompt(text: string, suffix: string): string {
  let result = text.trim();
  while (result.length < MIN_PROMPT) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

export function buildArtDirectionPrompt(params: {
  subject: string;
  collectionName: string;
  campaignName?: string;
  camera?: string;
  lens?: string;
  composition?: string;
  lighting?: string;
  colorGrade?: string;
  styling?: string;
  environment?: string;
  mood?: string;
  references?: string;
}): ImageAiPrompts {
  const {
    subject,
    collectionName,
    campaignName = collectionName,
    camera = "35mm full-frame digital camera",
    lens = "50mm f/1.4 prime lens",
    composition = "three-quarter editorial composition with intentional negative space",
    lighting = "soft overcast urban daylight, controlled contrast, no harsh flash",
    colorGrade = "muted obsidian and concrete palette, signal green accent, desaturated luxury grade",
    styling = "structured heavyweight streetwear, confident model posture, premium material focus",
    environment = "concrete architecture, glass reflections, minimal urban backdrop",
    mood = "urban luxury streetwear, scarcity drop energy, editorial confidence",
    references = "reference: Tyrone LeBon and Mert Alas streetwear editorials, SSENSE campaign aesthetic",
  } = params;

  const base = [
    `Creative direction for ${collectionName} (${campaignName}): ${subject}.`,
    `Camera: ${camera}. Lens: ${lens}.`,
    `Composition: ${composition}.`,
    `Lighting: ${lighting}.`,
    `Color grading: ${colorGrade}.`,
    `Styling: ${styling}.`,
    `Environment: ${environment}.`,
    `Mood: ${mood}.`,
    references,
    "Photorealistic, premium fashion production quality, no stock aesthetic.",
  ].join(" ");

  return {
    midjourney: padPrompt(
      `${base} --ar 4:5 --style raw --v 6`,
      "Midjourney art direction from Brain intelligence.",
    ),
    openai: padPrompt(
      base,
      "OpenAI image art direction from design and marketing reports.",
    ),
    flux: padPrompt(
      `${subject}, ${collectionName} collection, ${camera}, ${lighting}, ${colorGrade}, ${environment}, 8k editorial detail`,
      "Flux art direction from creative director brief.",
    ),
  };
}
