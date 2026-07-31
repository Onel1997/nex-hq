#!/usr/bin/env node
/**
 * Copy required @vladmandic/face-api model manifests + shards into
 * server-assets/face-api-models/ — a stable filesystem location for Next.js.
 *
 * Usage: node scripts/copy-face-api-models.mjs
 * Wired via package.json "postinstall" / "copy:face-api-models".
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "node_modules", "@vladmandic", "face-api", "model");
const DEST = path.join(ROOT, "server-assets", "face-api-models");

const REQUIRED_FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(
      `[copy-face-api-models] Source missing: ${SRC}\n` +
        `Install @vladmandic/face-api first (npm install).`,
    );
    process.exit(1);
  }

  const missingSource = REQUIRED_FILES.filter(
    (f) => !fs.existsSync(path.join(SRC, f)),
  );
  if (missingSource.length > 0) {
    console.error(
      `[copy-face-api-models] Source package is missing required files:\n  - ${missingSource.join("\n  - ")}`,
    );
    process.exit(1);
  }

  fs.mkdirSync(DEST, { recursive: true });

  for (const file of REQUIRED_FILES) {
    const from = path.join(SRC, file);
    const to = path.join(DEST, file);
    fs.copyFileSync(from, to);
  }

  const missingDest = REQUIRED_FILES.filter(
    (f) => !fs.existsSync(path.join(DEST, f)),
  );
  if (missingDest.length > 0) {
    console.error(
      `[copy-face-api-models] Copy verification failed. Missing:\n  - ${missingDest.join("\n  - ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[copy-face-api-models] Copied ${REQUIRED_FILES.length} files → ${DEST}`,
  );
}

main();
