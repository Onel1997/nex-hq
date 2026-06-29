import type { DesignStudioColor } from "@/agents/design/studio-brief";
import type { ColorMode, ColorScheme } from "@/lib/design/vector-engine/types";
import { hashString } from "@/lib/design/vector-engine/hash";

const NAMED: Record<string, string> = {
  black: "#0a0a0a",
  obsidian: "#0a0a0a",
  charcoal: "#1c1c1c",
  white: "#f4f2ed",
  cream: "#ebe6dc",
  ivory: "#f8f6f0",
  stone: "#8a8680",
  grey: "#7a7874",
  gray: "#7a7874",
  sand: "#c4b8a8",
  gold: "#b8a066",
  brass: "#9a8458",
  navy: "#1a2432",
  forest: "#2d3b32",
  burgundy: "#4a1f28",
  rust: "#8b4a38",
  sage: "#6b7f6e",
};

export function resolveHex(color: DesignStudioColor, fallback: string): string {
  const raw = color.hex?.trim();
  if (raw && /^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw.toLowerCase();
  const key = color.name.toLowerCase();
  for (const [name, hex] of Object.entries(NAMED)) {
    if (key.includes(name)) return hex;
  }
  return fallback;
}

function mix(hex: string, target: string, amount: number): string {
  const parse = (h: string) => {
    const c = h.replace("#", "");
    const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(target);
  const t = Math.min(1, Math.max(0, amount));
  const blend = (a: number, b: number) => Math.round(a + (b - a) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(blend(r1, r2))}${toHex(blend(g1, g2))}${toHex(blend(b1, b2))}`;
}

function detectColorMode(
  paletteLen: number,
  material: string,
  seed: number,
): ColorMode {
  const m = material.toLowerCase();
  if (m.includes("vintage") || m.includes("faded") || m.includes("washed")) {
    return m.includes("vintage") ? "vintage-ink" : "washed-ink";
  }
  if (m.includes("tone") || m.includes("subtle") || m.includes("muted")) return "tone-on-tone";
  if (m.includes("contrast") || m.includes("bold")) return "high-contrast";
  if (paletteLen >= 3) return "three-color";
  if (paletteLen === 2) return "two-color";
  if (paletteLen === 1) return seededMode(seed) ? "tone-on-tone" : "single";
  return "single";
}

function seededMode(seed: number): boolean {
  return (seed % 3) === 0;
}

export function buildColorScheme(
  palette: DesignStudioColor[],
  garmentColor: string,
  materialEffects: string,
  seed: number,
): ColorScheme {
  const primary = resolveHex(palette[0] ?? { name: garmentColor, usage: "primary" }, "#0a0a0a");
  const secondary = resolveHex(
    palette[1] ?? palette[0] ?? { name: "stone", usage: "secondary" },
    mix(primary, "#7a7874", 0.45),
  );
  const accent = resolveHex(
    palette[2] ?? palette[1] ?? palette[0] ?? { name: "accent", usage: "accent" },
    mix(primary, "#b8a066", 0.35),
  );

  const mode = detectColorMode(palette.length, materialEffects, hashString(garmentColor + String(seed)));
  const garmentKey = garmentColor.toLowerCase();
  const isDarkGarment =
    garmentKey.includes("black") ||
    garmentKey.includes("charcoal") ||
    garmentKey.includes("navy");

  const background = isDarkGarment ? "#0a0a0a" : "#f4f2ed";
  const lightInk = "#ebe6dc";
  const darkInk = "#0a0a0a";
  let ink = isDarkGarment ? lightInk : darkInk;

  switch (mode) {
    case "tone-on-tone":
      ink = isDarkGarment ? mix(lightInk, primary, 0.35) : mix(darkInk, primary, 0.65);
      break;
    case "high-contrast":
      ink = isDarkGarment ? lightInk : darkInk;
      break;
    case "washed-ink":
      ink = isDarkGarment ? mix(lightInk, primary, 0.4) : mix(darkInk, primary, 0.55);
      break;
    case "vintage-ink":
      ink = isDarkGarment ? mix(lightInk, "#b8a066", 0.45) : mix(darkInk, "#8b7355", 0.55);
      break;
    case "two-color":
    case "three-color":
      ink = isDarkGarment ? mix(lightInk, primary, 0.25) : mix(darkInk, primary, 0.85);
      break;
    case "single":
      ink = isDarkGarment ? mix(lightInk, primary, 0.15) : mix(darkInk, primary, 0.9);
      break;
    default:
      ink = isDarkGarment ? mix(lightInk, primary, 0.2) : mix(darkInk, primary, 0.88);
      break;
  }

  return {
    mode,
    primary: ink,
    secondary: mode === "tone-on-tone" ? mix(ink, background, 0.35) : mix(ink, secondary, 0.5),
    accent: mode === "single" ? mix(ink, accent, 0.3) : mix(ink, accent, 0.45),
    ink,
    background,
  };
}

export function opacityForMode(mode: ColorMode, layer: "primary" | "secondary" | "accent"): number {
  if (mode === "washed-ink") return layer === "primary" ? 0.62 : 0.38;
  if (mode === "vintage-ink") return layer === "primary" ? 0.78 : 0.48;
  if (mode === "tone-on-tone") return layer === "primary" ? 0.92 : 0.42;
  return layer === "secondary" ? 0.7 : 1;
}
