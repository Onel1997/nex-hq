import type { Rect } from "@/lib/design/design-library/types";
import { snap } from "@/lib/design/vector-engine/tokens";

const CM = 36;

export function parseArtboard(dimensions: string): Rect {
  const numbers = dimensions.match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  const w = numbers.length >= 2 ? Math.max(2, numbers[0]) : numbers[0] ?? 28;
  const h = numbers.length >= 2 ? Math.max(2, numbers[1]) : w * 1.15;
  return { x: 0, y: 0, width: snap(w * CM), height: snap(h * CM) };
}

export { getLayout, LAYOUT_REGISTRY, ALL_LAYOUT_IDS } from "@/lib/design/design-library/layouts/registry";
export { selectLayout } from "@/lib/design/design-library/layouts/select";
