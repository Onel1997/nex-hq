/** Preview-only canvas backgrounds — never sent to AI generation or exports. */
export type CanvasBackgroundId =
  | "transparent"
  | "black"
  | "white"
  | "cream"
  | "sand"
  | "washed-black"
  | "vintage-grey"
  | "olive"
  | "navy";

export type MockupGarmentId =
  | "black-tee"
  | "white-tee"
  | "beige-hoodie"
  | "cream-hoodie"
  | "oversized-tee";

export interface CanvasBackgroundOption {
  id: CanvasBackgroundId;
  label: string;
  /** Solid preview color — omitted for transparent (checkerboard). */
  color?: string;
}

export interface MockupGarmentOption {
  id: MockupGarmentId;
  label: string;
  /** Garment fill for CSS mockup silhouette. */
  garmentColor: string;
  kind: "tee" | "hoodie" | "oversized-tee";
}

export const DEFAULT_CANVAS_BACKGROUND: CanvasBackgroundId = "transparent";

export const CANVAS_BACKGROUND_OPTIONS: CanvasBackgroundOption[] = [
  { id: "transparent", label: "Transparent" },
  { id: "black", label: "Black", color: "#0a0a0a" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "cream", label: "Cream", color: "#f5f0e8" },
  { id: "sand", label: "Sand", color: "#d4c4a8" },
  { id: "washed-black", label: "Charcoal", color: "#2a2a2e" },
  { id: "vintage-grey", label: "Vintage Grey", color: "#8a8680" },
  { id: "olive", label: "Olive", color: "#4a5240" },
  { id: "navy", label: "Navy", color: "#1a2744" },
];

export const MOCKUP_GARMENT_OPTIONS: MockupGarmentOption[] = [
  { id: "black-tee", label: "Black T-Shirt", garmentColor: "#141414", kind: "tee" },
  { id: "white-tee", label: "White T-Shirt", garmentColor: "#f4f4f2", kind: "tee" },
  { id: "beige-hoodie", label: "Beige Hoodie", garmentColor: "#c8b89a", kind: "hoodie" },
  { id: "cream-hoodie", label: "Cream Hoodie", garmentColor: "#ede6d8", kind: "hoodie" },
  { id: "oversized-tee", label: "Oversized Tee", garmentColor: "#eceae4", kind: "oversized-tee" },
];

export const DEFAULT_MOCKUP_GARMENT: MockupGarmentId = "black-tee";

export function resolveCanvasBackgroundClass(background: CanvasBackgroundId): string {
  if (background === "transparent") return "has-checker";
  return `has-canvas-bg is-canvas-bg-${background}`;
}

export function resolveCanvasBackgroundStyle(
  background: CanvasBackgroundId,
): { backgroundColor?: string } | undefined {
  if (background === "transparent") return undefined;
  const option = CANVAS_BACKGROUND_OPTIONS.find((entry) => entry.id === background);
  if (!option?.color) return undefined;
  return { backgroundColor: option.color };
}
