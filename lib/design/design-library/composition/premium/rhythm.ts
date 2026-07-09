import type { Rect } from "@/lib/design/design-library/types";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export interface RhythmGrid {
  baseline: number;
  /** Staggered x positions — never uniform spacing. */
  columns: number[];
  /** Editorial vertical rhythm offsets. */
  rows: number[];
  tensionX: number;
  tensionY: number;
}

/** Controlled imbalance and editorial rhythm — avoids perfect symmetry. */
export function buildRhythmGrid(safeZone: Rect, seed: number): RhythmGrid {
  const baseline = DESIGN_TOKENS.grid.baseline;
  const colCount = 5 + (seed % 3);
  const columns: number[] = [];

  let cursor = safeZone.x + safeZone.width * range(seed, 201, 0.08, 0.14);
  for (let i = 0; i < colCount; i++) {
    columns.push(snap(cursor));
    const jump = safeZone.width * range(seed, 210 + i, 0.1, 0.2) * DESIGN_TOKENS.rhythm.editorial;
    cursor += jump;
  }

  const rowCount = 4 + (seed % 2);
  const rows: number[] = [];
  let rowY = safeZone.y + safeZone.height * range(seed, 220, 0.16, 0.24);
  for (let i = 0; i < rowCount; i++) {
    rows.push(snap(rowY));
    rowY += baseline * range(seed, 230 + i, 5, 9) * (i % 2 === 0 ? 1 : 1.35);
  }

  return {
    baseline,
    columns,
    rows,
    tensionX: range(seed, 240, -safeZone.width * 0.08, safeZone.width * 0.08),
    tensionY: range(seed, 241, -safeZone.height * 0.06, safeZone.height * 0.06),
  };
}

export function rhythmOffset(
  seed: number,
  index: number,
  amplitude: number,
): { x: number; y: number } {
  return {
    x: range(seed, 300 + index, -amplitude, amplitude),
    y: range(seed, 310 + index, -amplitude * 0.6, amplitude * 0.6),
  };
}
