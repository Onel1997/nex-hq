import { z } from "zod";

const directionScoresSchema = z.object({
  brandFit: z.number().min(0).max(100),
  commercial: z.number().min(0).max(100),
  originality: z.number().min(0).max(100),
  manufacturingDifficulty: z.number().min(0).max(100),
  conversionPotential: z.number().min(0).max(100),
  printComplexity: z.number().min(0).max(100).optional(),
  luxury: z.number().min(0).max(100).optional(),
  virality: z.number().min(0).max(100).optional(),
  collectionFit: z.number().min(0).max(100).optional(),
});

const teamInsightsSchema = z.object({
  researchDirector: z.string().min(10).optional(),
  creativeDirector: z.string().min(10).optional(),
  typographyDirector: z.string().min(10).optional(),
  fashionDesigner: z.string().min(10).optional(),
  commercialDirector: z.string().min(10).optional(),
  printEngineer: z.string().min(10).optional(),
});

export const generatedDirectionSchema = z.object({
  title: z.string().min(2).max(80),
  philosophy: z.string().min(20),
  designStory: z.string().min(40),
  fashionLanguage: z.string().min(20),
  silhouetteIdeas: z.string().min(10),
  typography: z.string().min(5),
  graphicStyle: z.string().min(5),
  colorSystem: z.string().min(5),
  materials: z.string().min(5),
  printStyle: z.string().min(5),
  commercialReasoning: z.string().min(20),
  targetAudience: z.string().min(10),
  mood: z.string().min(3),
  composition: z.string().min(10),
  trendAlignment: z.string().min(10),
  colorHexes: z.array(z.string()).min(2).max(5).optional(),
  scores: directionScoresSchema,
  teamInsights: teamInsightsSchema.optional(),
});

export const generatedDirectionsPayloadSchema = z.object({
  directions: z.array(generatedDirectionSchema).min(3).max(5),
});

export type GeneratedDirection = z.infer<typeof generatedDirectionSchema>;
export type GeneratedDirectionsPayload = z.infer<typeof generatedDirectionsPayloadSchema>;

export class DesignDirectionsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignDirectionsParseError";
  }
}

export function parseGeneratedDirections(raw: string): GeneratedDirectionsPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DesignDirectionsParseError("AI response was not valid JSON");
  }

  const result = generatedDirectionsPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new DesignDirectionsParseError(
      `Invalid direction payload: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const titles = result.data.directions.map((d) => d.title.toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size !== titles.length) {
    throw new DesignDirectionsParseError("Each direction must have a unique title");
  }

  return result.data;
}
