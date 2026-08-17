export type QuadPoint = { x: number; y: number };
export type QuadCorners = [QuadPoint, QuadPoint, QuadPoint, QuadPoint];
export type CornerKey = "tl" | "tr" | "br" | "bl";
export type Axis = "x" | "y";
export type CornerFieldKey = `${CornerKey}${Axis}`;
export type CornerFieldValues = Record<CornerFieldKey, string>;

export const EMPTY_CORNER_FIELDS: CornerFieldValues = {
  tlx: "",
  tly: "",
  trx: "",
  try: "",
  brx: "",
  bry: "",
  blx: "",
  bly: "",
};

export const PRINT_SURFACE_MISSING_MESSAGE =
  "Define the four front_center print-area corners before preparing V2.";

const AREA_EPSILON = 1e-6;
const POINT_EPSILON = 1e-8;
const CORNER_FIELD_KEYS: CornerFieldKey[] = ["tlx", "tly", "trx", "try", "brx", "bry", "blx", "bly"];

export type QuadValidationResult =
  | { ok: true; quad: QuadCorners }
  | {
      ok: false;
      code: "MISSING_PRINT_SURFACE" | "INVALID_PRINT_SURFACE";
      message: string;
      fieldErrors: Partial<Record<CornerFieldKey, string>>;
    };

function parseField(raw: string): number | "empty" | "nan" {
  if (raw.trim() === "") return "empty";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "nan";
  return value;
}

function cross(a: QuadPoint, b: QuadPoint, c: QuadPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function shoelace(quad: QuadCorners): number {
  let area = 0;
  for (let index = 0; index < 4; index += 1) {
    const current = quad[index]!;
    const next = quad[(index + 1) % 4]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function validateHumanDefinedQuad(fields: CornerFieldValues): QuadValidationResult {
  const fieldErrors: Partial<Record<CornerFieldKey, string>> = {};
  const numbers: Partial<Record<CornerFieldKey, number>> = {};
  let missing = false;

  for (const key of CORNER_FIELD_KEYS) {
    const parsed = parseField(fields[key]);
    if (parsed === "empty") {
      missing = true;
      fieldErrors[key] = "Required";
      continue;
    }
    if (parsed === "nan") {
      fieldErrors[key] = "Must be a number";
      continue;
    }
    if (parsed < 0 || parsed > 1) {
      fieldErrors[key] = "Must be between 0 and 1";
      continue;
    }
    numbers[key] = parsed;
  }

  if (missing) {
    return {
      ok: false,
      code: "MISSING_PRINT_SURFACE",
      message: PRINT_SURFACE_MISSING_MESSAGE,
      fieldErrors,
    };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "INVALID_PRINT_SURFACE",
      message: "Each print-area corner must have X and Y between 0 and 1.",
      fieldErrors,
    };
  }

  const quad: QuadCorners = [
    { x: numbers.tlx!, y: numbers.tly! },
    { x: numbers.trx!, y: numbers.try! },
    { x: numbers.brx!, y: numbers.bry! },
    { x: numbers.blx!, y: numbers.bly! },
  ];

  for (let left = 0; left < 4; left += 1) {
    for (let right = left + 1; right < 4; right += 1) {
      const dx = quad[left]!.x - quad[right]!.x;
      const dy = quad[left]!.y - quad[right]!.y;
      if (Math.hypot(dx, dy) < POINT_EPSILON) {
        return {
          ok: false,
          code: "INVALID_PRINT_SURFACE",
          message: "Print-area corners must be distinct and form a non-degenerate quad.",
          fieldErrors,
        };
      }
    }
  }

  const area = shoelace(quad);
  if (Math.abs(area) < AREA_EPSILON) {
    return {
      ok: false,
      code: "INVALID_PRINT_SURFACE",
      message: "Print-area corners form a degenerate quad. Adjust TL/TR/BR/BL so the print area has area.",
      fieldErrors,
    };
  }

  const crosses = [0, 1, 2, 3].map((index) =>
    cross(quad[index]!, quad[(index + 1) % 4]!, quad[(index + 2) % 4]!),
  );
  const convexClockwise = crosses.every((value) => value > 0);
  const convexCounterclockwise = crosses.every((value) => value < 0);
  if (!convexClockwise && !convexCounterclockwise) {
    return {
      ok: false,
      code: "INVALID_PRINT_SURFACE",
      message: "Print-area corners must form a convex, non-self-intersecting quad in TL → TR → BR → BL order.",
      fieldErrors,
    };
  }

  if (area < 0) {
    return {
      ok: false,
      code: "INVALID_PRINT_SURFACE",
      message: "Print-area corners must be ordered TL → TR → BR → BL.",
      fieldErrors,
    };
  }

  const topY = (quad[0].y + quad[1].y) / 2;
  const bottomY = (quad[2].y + quad[3].y) / 2;
  const leftX = (quad[0].x + quad[3].x) / 2;
  const rightX = (quad[1].x + quad[2].x) / 2;
  if (!(topY < bottomY) || !(leftX < rightX)) {
    return {
      ok: false,
      code: "INVALID_PRINT_SURFACE",
      message: "Print-area corners must be ordered TL → TR → BR → BL.",
      fieldErrors,
    };
  }

  return { ok: true, quad };
}

export function assertUsableNormalizedQuad(quad: QuadCorners): void {
  const result = validateHumanDefinedQuad({
    tlx: String(quad[0].x),
    tly: String(quad[0].y),
    trx: String(quad[1].x),
    try: String(quad[1].y),
    brx: String(quad[2].x),
    bry: String(quad[2].y),
    blx: String(quad[3].x),
    bly: String(quad[3].y),
  });
  if (!result.ok) throw new Error(result.message);
}
