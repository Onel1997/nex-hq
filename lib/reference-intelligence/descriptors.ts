import type {
  ReferenceCameraDescriptor,
  ReferenceDescriptor,
  ReferenceEnvironmentDescriptor,
  ReferenceExpressionDescriptor,
  ReferenceExtractionMethod,
  ReferenceLightingDescriptor,
  ReferencePersonaDirectionDescriptor,
  ReferencePoseDescriptor,
  ReferenceStylingDescriptor,
  ReferenceVisualMoodDescriptor,
} from "./types";

/** Empty descriptor template for manual entry UI. */
export function createEmptyDescriptorTemplate(params: {
  id: string;
  assetId: string;
  boardId: string;
  now?: string;
}): ReferenceDescriptor {
  const now = params.now ?? new Date().toISOString();
  return {
    id: params.id,
    assetId: params.assetId,
    boardId: params.boardId,
    extractionMethod: "manual",
    camera: {},
    lighting: {},
    pose: {},
    expression: {},
    styling: {},
    environment: {},
    visualMood: {},
    personaDirection: {},
    notes: "",
    createdAt: now,
    updatedAt: now,
    version: "1",
  };
}

/** Suggested option lists for manual descriptor pickers (not auto-extracted). */
export const MANUAL_DESCRIPTOR_OPTIONS = {
  shotType: ["head-and-shoulders", "half-body", "three-quarter", "close portrait"],
  cameraDistance: ["intimate close", "medium close", "medium", "far"],
  cameraAngle: ["eye level", "slightly above", "slightly below"],
  lensFeeling: ["natural", "soft editorial", "documentary"],
  depthOfField: ["shallow soft", "moderate", "deep"],
  softness: ["soft", "diffused", "hard"],
  direction: ["front soft", "window side", "overhead soft"],
  contrast: ["low", "medium", "gentle high"],
  temperature: ["neutral", "warm daylight", "cool daylight"],
  posture: ["relaxed upright", "slight weight shift", "calm seated feel"],
  mood: ["calm", "friendly", "quiet confidence", "soft approachable"],
  intensity: ["low", "medium", "restrained"],
  approachability: ["high", "medium", "reserved"],
  confidence: ["quiet", "steady", "understated"],
  smileLevel: ["none", "soft", "subtle"],
  silhouette: ["oversized", "relaxed", "boxy"],
  fit: ["oversized heavyweight", "relaxed", "boxy"],
  environmentType: ["neutral studio", "plain wall", "soft interior"],
  campaignEnergy: ["understated", "calm premium", "community soft"],
  authenticity: ["high", "natural", "uncorrected soft"],
  polish: ["clean commercial", "light editorial", "raw natural"],
  grain: ["none", "subtle film", "soft digital"],
  socialMediaFeel: ["Instagram-ready natural", "TikTok calm", "lookbook soft"],
  hairDirection: ["natural texture", "short clean", "relaxed medium"],
  grooming: ["clean casual", "light stubble ok", "natural"],
  socialPresence: ["approachable", "camera-ready calm", "community credible"],
  streetwearCredibility: ["high", "everyday premium", "cast-friendly"],
} as const;

export function isVisionExtractionEnabled(): boolean {
  return false;
}

export function assertVisionExtractionDisabled(
  method: ReferenceExtractionMethod,
): void {
  if (method === "vision_model") {
    throw new Error(
      "Reference Intelligence: vision_model extraction is reserved and disabled in Phase 1.7C.",
    );
  }
}

export function flattenDescriptorValues(
  descriptor: ReferenceDescriptor,
): string[] {
  const bags: Array<Record<string, unknown>> = [
    descriptor.camera,
    descriptor.lighting,
    descriptor.pose,
    descriptor.expression,
    descriptor.styling,
    descriptor.environment,
    descriptor.visualMood,
    descriptor.personaDirection,
  ];
  const out: string[] = [];
  for (const bag of bags) {
    for (const value of Object.values(bag)) {
      if (typeof value === "string" && value.trim()) out.push(value.trim());
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.trim()) out.push(item.trim());
        }
      }
    }
  }
  if (descriptor.notes?.trim()) out.push(descriptor.notes.trim());
  return out;
}

export function personaCastingFieldsFromDescriptor(
  descriptor: ReferenceDescriptor,
): string[] {
  const lines: string[] = [];
  const e = descriptor.expression;
  const p = descriptor.personaDirection;
  const cam = descriptor.camera;
  const light = descriptor.lighting;
  const mood = descriptor.visualMood;

  if (e.mood) lines.push(`Facial mood: ${e.mood}.`);
  if (e.intensity) lines.push(`Expression intensity: ${e.intensity}.`);
  if (e.approachability) lines.push(`Approachability: ${e.approachability}.`);
  if (e.confidence) lines.push(`Confidence: ${e.confidence}.`);
  if (e.smileLevel) lines.push(`Smile level: ${e.smileLevel}.`);
  if (p.hairDirection) lines.push(`Hair direction: ${p.hairDirection}.`);
  if (p.grooming) lines.push(`Grooming: ${p.grooming}.`);
  if (p.bodyDirection) lines.push(`Body direction: ${p.bodyDirection}.`);
  if (p.socialPresence) lines.push(`Social presence: ${p.socialPresence}.`);
  if (p.streetwearCredibility) {
    lines.push(`Streetwear credibility: ${p.streetwearCredibility}.`);
  }
  if (p.ageFeeling) lines.push(`Age feeling: ${p.ageFeeling}.`);
  if (mood.campaignEnergy) lines.push(`Casting energy: ${mood.campaignEnergy}.`);
  if (mood.authenticity) lines.push(`Authenticity: ${mood.authenticity}.`);
  if (cam.shotType || cam.cameraDistance) {
    lines.push(
      `Camera restraint: ${[cam.shotType, cam.cameraDistance].filter(Boolean).join(", ")}.`,
    );
  }
  if (light.softness || light.sourceType) {
    lines.push(
      `Lighting restraint: ${[light.softness, light.sourceType].filter(Boolean).join(", ")}.`,
    );
  }
  return lines;
}

export type DescriptorSectionKey =
  | "camera"
  | "lighting"
  | "pose"
  | "expression"
  | "styling"
  | "environment"
  | "visualMood"
  | "personaDirection";

export function emptyCamera(): ReferenceCameraDescriptor {
  return {};
}
export function emptyLighting(): ReferenceLightingDescriptor {
  return {};
}
export function emptyPose(): ReferencePoseDescriptor {
  return {};
}
export function emptyExpression(): ReferenceExpressionDescriptor {
  return {};
}
export function emptyStyling(): ReferenceStylingDescriptor {
  return {};
}
export function emptyEnvironment(): ReferenceEnvironmentDescriptor {
  return {};
}
export function emptyVisualMood(): ReferenceVisualMoodDescriptor {
  return {};
}
export function emptyPersonaDirection(): ReferencePersonaDirectionDescriptor {
  return {};
}
