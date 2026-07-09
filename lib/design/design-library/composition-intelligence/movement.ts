import type { Rect } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import { range } from "@/lib/design/vector-engine/hash";

export type FlowDirection = "diagonal-down" | "diagonal-up" | "sweep-left" | "sweep-right" | "editorial-cascade";

export interface MovementVector {
  direction: FlowDirection;
  /** Primary eye-landing point */
  entry: { x: number; y: number };
  /** Where the eye should travel next */
  exit: { x: number; y: number };
  diagonalAngle: number;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const DIRECTIONS: FlowDirection[] = [
  "diagonal-down",
  "diagonal-up",
  "sweep-left",
  "sweep-right",
  "editorial-cascade",
];

/** Creates visual flow — never stack everything vertically. */
export function buildMovementVector(
  focal: FocalSystem,
  safeZone: Rect,
  seed: number,
): MovementVector {
  const direction = DIRECTIONS[seed % DIRECTIONS.length]!;

  const entry = { x: focal.primary.x, y: focal.primary.y };
  let exit: { x: number; y: number };
  let diagonalAngle: number;

  switch (direction) {
    case "diagonal-down":
      exit = {
        x: focal.secondary.x,
        y: focal.secondary.y + safeZone.height * 0.08,
      };
      diagonalAngle = range(seed, 1300, 18, 32);
      break;
    case "diagonal-up":
      exit = {
        x: focal.supporting[0]?.x ?? focal.secondary.x,
        y: (focal.supporting[0]?.y ?? focal.secondary.y) - safeZone.height * 0.06,
      };
      diagonalAngle = range(seed, 1301, -28, -14);
      break;
    case "sweep-left":
      exit = {
        x: safeZone.x + safeZone.width * 0.12,
        y: focal.secondary.y,
      };
      diagonalAngle = range(seed, 1302, -8, 8);
      break;
    case "sweep-right":
      exit = {
        x: safeZone.x + safeZone.width * 0.88,
        y: focal.micro[0]?.y ?? focal.secondary.y,
      };
      diagonalAngle = range(seed, 1303, -8, 8);
      break;
    default:
      exit = {
        x: focal.secondary.x,
        y: focal.supporting[1]?.y ?? focal.secondary.y + safeZone.height * 0.1,
      };
      diagonalAngle = range(seed, 1304, 12, 24);
  }

  let score = 55;
  const verticalStack =
    Math.abs(entry.x - exit.x) < safeZone.width * 0.05 &&
    exit.y > entry.y;
  if (!verticalStack) score += 18;
  else score -= 22;

  if (direction === "diagonal-down" || direction === "editorial-cascade") score += 10;

  return { direction, entry, exit, diagonalAngle, score: clamp(score) };
}

export function isStaticVerticalStack(vector: MovementVector, safeZone: Rect): boolean {
  const dx = Math.abs(vector.entry.x - vector.exit.x);
  const dy = vector.exit.y - vector.entry.y;
  return dx < safeZone.width * 0.04 && dy > safeZone.height * 0.15;
}

export function hasWeakMovement(vector: MovementVector): boolean {
  return vector.score < 50 || isStaticVerticalStack(vector, { x: 0, y: 0, width: 400, height: 500 });
}
