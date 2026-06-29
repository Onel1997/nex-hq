import { fmt } from "@/lib/design/vector-engine/tokens";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function group(id: string, content: string, attrs?: Record<string, string>): string {
  const extra = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
        .join("")
    : "";
  return `<g id="${id}"${extra}>${content}</g>`;
}

export function path(d: string, attrs: Record<string, string | number>): string {
  const parts = Object.entries(attrs).map(([k, v]) => ` ${k}="${typeof v === "number" ? fmt(v) : escapeXml(String(v))}"`);
  return `<path d="${d}"${parts.join("")}/>`;
}

export function circle(cx: number, cy: number, r: number, attrs: Record<string, string | number>): string {
  const parts = Object.entries(attrs).map(([k, v]) => ` ${k}="${typeof v === "number" ? fmt(v) : escapeXml(String(v))}"`);
  return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"${parts.join("")}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, attrs: Record<string, string | number>): string {
  const parts = Object.entries(attrs).map(([k, v]) => ` ${k}="${typeof v === "number" ? fmt(v) : escapeXml(String(v))}"`);
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"${parts.join("")}/>`;
}

export function rect(x: number, y: number, w: number, h: number, attrs: Record<string, string | number>): string {
  const parts = Object.entries(attrs).map(([k, v]) => ` ${k}="${typeof v === "number" ? fmt(v) : escapeXml(String(v))}"`);
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"${parts.join("")}/>`;
}
