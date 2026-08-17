import { createHash } from "node:crypto";
import { createCanvas } from "canvas";

import type { ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";

export interface BaseImageResult {
  bytes: Buffer;
  checksumSha256: string;
  providerRequestId: string;
  provenance: Record<string, unknown>;
}

export interface BaseImageProvider {
  generate(snapshot: ImageGenerationInputSnapshotV2): Promise<BaseImageResult>;
}

/** Long-edge floor for synthetic Stage A. Screen mockup quality is pixel count, not DPI. */
export const SYNTHETIC_BASE_MIN_LONG_EDGE = 2048;
const REFERENCE_WIDTH = 768;
const REFERENCE_HEIGHT = 1024;

export function resolveSyntheticBaseDimensions(requested?: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(requested?.trim() ?? "");
  let width = match ? Number(match[1]) : SYNTHETIC_BASE_MIN_LONG_EDGE;
  let height = match ? Number(match[2]) : Math.round(SYNTHETIC_BASE_MIN_LONG_EDGE * REFERENCE_HEIGHT / REFERENCE_WIDTH);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    width = SYNTHETIC_BASE_MIN_LONG_EDGE;
    height = Math.round(SYNTHETIC_BASE_MIN_LONG_EDGE * REFERENCE_HEIGHT / REFERENCE_WIDTH);
  }
  const longEdge = Math.max(width, height);
  if (longEdge < SYNTHETIC_BASE_MIN_LONG_EDGE) {
    const scale = SYNTHETIC_BASE_MIN_LONG_EDGE / longEdge;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  return { width, height };
}

/** Local deterministic fixture provider. It never performs network I/O. */
export class DeterministicSyntheticBaseProvider implements BaseImageProvider {
  calls = 0;
  async generate(snapshot: ImageGenerationInputSnapshotV2): Promise<BaseImageResult> {
    this.calls += 1;
    const { width, height } = resolveSyntheticBaseDimensions(snapshot.baseGeneration.dimensions);
    const x = (value: number) => value / REFERENCE_WIDTH * width;
    const y = (value: number) => value / REFERENCE_HEIGHT * height;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ddd8ce";
    context.fillRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f5f1e8"); gradient.addColorStop(1, "#c8c1b5");
    context.fillStyle = gradient; context.fillRect(x(36), y(36), width - x(72), height - y(72));
    context.fillStyle = "#6f6258";
    context.beginPath(); context.arc(width / 2, y(190), x(90), 0, Math.PI * 2); context.fill();
    context.fillStyle = snapshot.product.color?.toLowerCase().includes("black") ? "#191919" : "#34383c";
    context.beginPath();
    context.moveTo(x(210), y(315)); context.quadraticCurveTo(x(120), y(360), x(105), y(535)); context.lineTo(x(170), y(815));
    context.quadraticCurveTo(width / 2, y(865), width - x(170), y(815)); context.lineTo(width - x(105), y(535));
    context.quadraticCurveTo(width - x(120), y(360), width - x(210), y(315)); context.closePath(); context.fill();
    context.strokeStyle = "rgba(255,255,255,0.22)"; context.lineWidth = Math.max(1, x(5));
    context.beginPath(); context.moveTo(width / 2, y(325)); context.lineTo(width / 2, y(810)); context.stroke();
    const quad = snapshot.printSurface.quad!;
    context.strokeStyle = "rgba(255,190,0,0.5)"; context.lineWidth = Math.max(1, x(2)); context.setLineDash([x(8), x(8)]);
    context.beginPath();
    context.moveTo(quad[0].x * width, quad[0].y * height);
    for (let index = 1; index < quad.length; index += 1) context.lineTo(quad[index]!.x * width, quad[index]!.y * height);
    context.closePath(); context.stroke(); context.setLineDash([]);
    context.fillStyle = "rgba(255,255,255,0.7)"; context.font = `${Math.max(12, Math.round(x(16)))}px sans-serif`;
    context.fillText("SYNTHETIC BASE — NO ARTWORK", x(52), height - y(55));
    const bytes = canvas.toBuffer("image/png");
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    return {
      bytes,
      checksumSha256,
      providerRequestId: `fake-v2:${snapshot.production.projectId}:${snapshot.shot.assetId}`,
      provenance: {
        providerMode: "FAKE_SYNTHETIC",
        networkCalls: 0,
        deterministic: true,
        source: "canvas garment-like fixture",
        width,
        height,
        requestedDimensions: snapshot.baseGeneration.dimensions,
      },
    };
  }
}
