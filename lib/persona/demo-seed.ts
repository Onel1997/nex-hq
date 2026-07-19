/**
 * Test-only Brand Cast fixture. Never loaded by Supabase/production repository.
 */

import type { PersonaStudioSnapshot } from "./domain/types";

const WS = "11111111-1111-4111-8111-111111111111";
const now = "2026-07-19T12:00:00.000Z";

export const PERSONA_DEMO_SEED: PersonaStudioSnapshot = {
  personas: [],
  locations: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      workspace_id: WS,
      name: "Studio",
      category: "Controlled",
      setting: "indoor",
      description: "Neutral seamless studio.",
      tags: ["neutral"],
      active: true,
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ],
  camera_presets: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      workspace_id: WS,
      name: "Editorial",
      focal_length: "85mm",
      framing: "Mid-shot portrait",
      lighting_style: "Soft key",
      color_grade: "Neutral cool",
      notes: "",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ],
  poses: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      workspace_id: WS,
      name: "Quiet Stance",
      category: "Standing",
      description: "Relaxed stance.",
      body_direction: "3/4 toward camera",
      suitable_products: ["hoodie"],
      active: true,
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ],
  brand_looks: [
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      workspace_id: WS,
      name: "Quiet Luxury",
      description: "Restrained palette.",
      mood: "Composed",
      color_style: "Monochrome neutrals",
      styling_notes: "Minimal accessories.",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ],
  outfits: [
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      workspace_id: WS,
      name: "Black Wide Pants Set",
      description: "Core set.",
      items: ["Black Wide Pants", "White Sneakers"],
      tags: ["core"],
      active: true,
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ],
  reference_assets: [],
};

export const PERSONA_TEST_WORKSPACE_ID = WS;
