import assert from "node:assert/strict";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  assessLocalPrintReadyStageA,
  assessRegisteredPrintReadyStageA,
  printReadyStageAPromptLines,
} from "@/lib/image/deterministic-runtime/print-ready-stage-a";

function base(): Buffer {
  const canvas = createCanvas(1000, 1000);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ddd";
  context.fillRect(0, 0, 1000, 1000);
  return canvas.toBuffer("image/png");
}

test("FRONT_LARGE preflight rejects tight portraits and accepts medium framing", async () => {
  const tight = await assessLocalPrintReadyStageA({
    bytes: base(),
    faceBounds: { x: 0.3, y: 0.08, width: 0.4, height: 0.3 },
  });
  assert.equal(tight.status, "FAIL");
  assert.equal(tight.reason, "TIGHT_PORTRAIT_CROP");

  const usable = await assessLocalPrintReadyStageA({
    bytes: base(),
    faceBounds: { x: 0.42, y: 0.06, width: 0.16, height: 0.16 },
  });
  assert.equal(usable.status, "PASS");
  assert.equal(usable.collarVisibility, "LIKELY");
  assert.ok(usable.torsoVisibility > 0.9);
});

test("SAM/torso postflight requires a visible unoccluded torso", () => {
  const ready = assessRegisteredPrintReadyStageA({
    imageWidth: 1024,
    imageHeight: 1024,
    faceBounds: { x: 0.43, y: 0.06, width: 0.14, height: 0.16 },
    garmentBounds: { x: 0.18, y: 0.2, width: 0.64, height: 0.72 },
    torsoBounds: { x: 0.29, y: 0.27, width: 0.42, height: 0.56 },
    torsoStatus: "READY",
    torsoConfidence: 0.81,
    maskCoverage: 0.995,
  });
  assert.equal(ready.status, "PASS");
  assert.equal(ready.collarVisibility, "CONFIRMED");

  const occluded = assessRegisteredPrintReadyStageA({
    imageWidth: 1024,
    imageHeight: 1024,
    faceBounds: { x: 0.43, y: 0.06, width: 0.14, height: 0.16 },
    garmentBounds: { x: 0.18, y: 0.2, width: 0.64, height: 0.72 },
    torsoBounds: { x: 0.29, y: 0.27, width: 0.42, height: 0.56 },
    torsoStatus: "READY",
    torsoConfidence: 0.81,
    maskCoverage: 0.91,
  });
  assert.equal(occluded.status, "FAIL");
  assert.equal(occluded.reason, "CENTRAL_OCCLUSION_UNSAFE");
});

test("print-ready prompt gives identity and garment usability priority", () => {
  const prompt = printReadyStageAPromptLines().join(" ");
  assert.match(prompt, /complete blank T-shirt front/i);
  assert.match(prompt, /arms, hands, hair/i);
  assert.match(prompt, /exact approved Brand Model identity/i);
  assert.match(prompt, /Print usability wins/i);
});
