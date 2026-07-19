import { z } from "zod";
import {
  FRAMINGS,
  LOCATION_SETTINGS,
  PERSONA_STATUSES,
  REFERENCE_ASSET_TYPES,
  REFERENCE_STATUSES,
  SOURCE_TYPES,
  VIEW_ANGLES,
  type PersonaRelationKind,
} from "../domain/types";

const idListSchema = z.array(z.string().uuid()).default([]);

export const createPersonaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  status: z.enum(PERSONA_STATUSES).optional(),
  gender: z.string().trim().max(60).default(""),
  age_range: z.string().trim().max(60).default(""),
  height: z.string().trim().max(60).default(""),
  body_type: z.string().trim().max(60).default(""),
  skin_tone: z.string().trim().max(60).default(""),
  hair: z.string().trim().max(120).default(""),
  beard: z.string().trim().max(120).default(""),
  eye_color: z.string().trim().max(60).default(""),
  expression: z.string().trim().max(120).default(""),
  personality: z.string().trim().max(500).default(""),
  style: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(2000).default(""),
  brand_fit_score: z.number().min(0).max(100).default(0),
  image_use_approved: z.boolean().optional(),
  video_use_approved: z.boolean().optional(),
  visual_identity_notes: z.string().trim().max(4000).default(""),
  distinguishing_features: z.string().trim().max(2000).default(""),
  prohibited_changes: z.string().trim().max(4000).default(""),
  default_hair_style: z.string().trim().max(200).default(""),
  default_facial_hair: z.string().trim().max(200).default(""),
  default_expression: z.string().trim().max(200).default(""),
  default_body_proportions: z.string().trim().max(200).default(""),
  default_styling_notes: z.string().trim().max(2000).default(""),
  preferred_location_ids: idListSchema.optional(),
  preferred_camera_preset_ids: idListSchema.optional(),
  preferred_pose_ids: idListSchema.optional(),
  preferred_brand_look_ids: idListSchema.optional(),
  preferred_outfit_ids: idListSchema.optional(),
});

export const updatePersonaSchema = createPersonaSchema
  .extend({
    primary_reference_asset_id: z.string().uuid().nullable().optional(),
    identity_lock_version: z.number().int().min(1).optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  setting: z.enum(LOCATION_SETTINGS),
  description: z.string().trim().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  active: z.boolean().default(true),
});

export const updateLocationSchema = createLocationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createCameraPresetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  focal_length: z.string().trim().min(1).max(40),
  framing: z.string().trim().min(1).max(120),
  lighting_style: z.string().trim().min(1).max(120),
  color_grade: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).default(""),
});

export const updateCameraPresetSchema = createCameraPresetSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createPoseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).default(""),
  body_direction: z.string().trim().min(1).max(120),
  suitable_products: z.array(z.string().trim().min(1).max(80)).default([]),
  active: z.boolean().default(true),
});

export const updatePoseSchema = createPoseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createBrandLookSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  mood: z.string().trim().min(1).max(120),
  color_style: z.string().trim().min(1).max(120),
  styling_notes: z.string().trim().max(2000).default(""),
});

export const updateBrandLookSchema = createBrandLookSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createOutfitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  items: z.array(z.string().trim().min(1).max(120)).min(1),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  active: z.boolean().default(true),
});

export const updateOutfitSchema = createOutfitSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const personaRelationKindSchema = z.enum([
  "locations",
  "camera_presets",
  "poses",
  "brand_looks",
  "outfits",
] as const satisfies readonly PersonaRelationKind[]);

export const setPersonaRelationsSchema = z.object({
  kind: personaRelationKindSchema,
  ids: z.array(z.string().uuid()),
});

export const updateReferenceAssetSchema = z
  .object({
    asset_type: z.enum(REFERENCE_ASSET_TYPES).optional(),
    status: z.enum(REFERENCE_STATUSES).optional(),
    is_primary: z.boolean().optional(),
    view_angle: z.enum(VIEW_ANGLES).optional(),
    framing: z.enum(FRAMINGS).optional(),
    expression: z.string().trim().max(200).optional(),
    body_visibility: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    source_type: z.enum(SOURCE_TYPES).optional(),
    rights_confirmed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const referenceUploadMetaSchema = z.object({
  asset_type: z.enum(REFERENCE_ASSET_TYPES).default("portrait"),
  view_angle: z.enum(VIEW_ANGLES).default("front"),
  framing: z.enum(FRAMINGS).default("head_shoulders"),
  expression: z.string().trim().max(200).default(""),
  body_visibility: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
  source_type: z.enum(SOURCE_TYPES).default("user_upload"),
  rights_confirmed: z.boolean().default(false),
});
