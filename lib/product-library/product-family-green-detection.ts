import { createCanvas, loadImage } from "canvas";

import {
  normalizedPrintAreaSchema,
  type NormalizedPrintArea,
} from "@/lib/product-library/product-family";

function isMarketPrintGreen(red: number, green: number, blue: number): boolean {
  const maximumOther = Math.max(red, blue);
  return green >= 55 && green - maximumOther >= 22 && green >= red * 1.18 && green >= blue * 1.12;
}

/** Local-only detection. No provider, network, or mutable external input. */
export async function detectMarketPrintGreenArea(bytes: Buffer): Promise<NormalizedPrintArea> {
  const source = await loadImage(bytes);
  const maximumDimension = 900;
  const scale = Math.min(1, maximumDimension / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  let matches = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!isMarketPrintGreen(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!)) continue;
      matches += 1;
      mask[y * width + x] = 1;
    }
  }
  if (matches < Math.max(64, width * height * 0.0025)) {
    throw new Error("Die grüne Druckfläche wurde nicht sicher erkannt. Passe das Rechteck bitte visuell an.");
  }
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = { count: 0, minX: width, minY: height, maxX: -1, maxY: -1 };
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let read = 0;
    let write = 0;
    queue[write++] = start;
    visited[start] = 1;
    const component = { count: 0, minX: width, minY: height, maxX: -1, maxY: -1 };
    while (read < write) {
      const current = queue[read++]!;
      const x = current % width;
      const y = Math.floor(current / width);
      component.count += 1;
      component.minX = Math.min(component.minX, x);
      component.minY = Math.min(component.minY, y);
      component.maxX = Math.max(component.maxX, x);
      component.maxY = Math.max(component.maxY, y);
      for (const next of [current - 1, current + 1, current - width, current + width]) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nextX = next % width;
        if (Math.abs(nextX - x) > 1) continue;
        visited[next] = 1;
        queue[write++] = next;
      }
    }
    if (component.count > best.count) best = component;
  }
  const { minX, minY, maxX, maxY } = best;
  if (best.count < Math.max(64, width * height * 0.0025) || maxX <= minX || maxY <= minY) {
    throw new Error("Die grüne Druckfläche wurde nicht sicher erkannt. Passe das Rechteck bitte visuell an.");
  }
  const box = normalizedPrintAreaSchema.parse({
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  });
  if (box.width * box.height > 0.85) {
    throw new Error("Die erkannte grüne Fläche ist nicht eindeutig. Passe das Rechteck bitte visuell an.");
  }
  return box;
}
