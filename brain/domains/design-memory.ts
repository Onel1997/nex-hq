/**
 * Design Memory — visual system, palettes, typography, silhouettes, assets.
 */

export interface ColorSwatch {
  name: string;
  hex: string;
  usage: string;
}

export interface TypographySpec {
  role: "headline" | "body" | "accent" | "logo";
  family: string;
  weights?: string[];
  constraints?: string;
}

export interface DesignAssetRef {
  id: string;
  label: string;
  type: "image" | "vector" | "moodboard" | "template";
  url?: string;
  storagePath?: string;
  approved: boolean;
}

export interface DesignMemoryContent {
  kind: "design_memory";
  colorPalette?: ColorSwatch[];
  typography?: TypographySpec[];
  silhouettes?: string[];
  graphicTreatment?: string;
  moodKeywords?: string[];
  assets?: DesignAssetRef[];
  dropVisualDirection?: string;
}
