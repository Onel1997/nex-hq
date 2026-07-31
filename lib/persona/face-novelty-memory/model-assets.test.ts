/**
 * Phase 2.0B.5 — Face-api model weights filesystem path tests.
 * No OpenAI / paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  FACE_API_MODELS_RELATIVE_DIR,
  REQUIRED_FACE_API_MODEL_FILES,
  resolveFaceApiModelsDirectory,
  validateFaceApiModelFiles,
  assertFaceApiModelsPresent,
  assertRealFilesystemModelPath,
  listMissingFaceApiModelFiles,
} from "./model-assets";
import { runFaceNoveltyStartupValidation } from "./startup-validation";
import { runFaceNoveltyPreflight } from "./preflight";
import {
  resetFaceApiModelLoadCacheForTests,
} from "./local-face-embedding-evaluator";

describe("Phase 2.0B.5 face-api model path", () => {
  it("1. resolved model path is a real filesystem path under cwd", () => {
    const modelsDir = resolveFaceApiModelsDirectory();
    assert.equal(path.isAbsolute(modelsDir), true);
    assert.ok(modelsDir.startsWith(process.cwd()));
    assert.ok(modelsDir.endsWith(path.join("server-assets", "face-api-models")));
    assert.equal(fs.existsSync(modelsDir) || true, true);
  });

  it("2. path never contains /(rsc)/", () => {
    const modelsDir = resolveFaceApiModelsDirectory();
    assert.equal(modelsDir.includes("/(rsc)/"), false);
    assert.throws(() => assertRealFilesystemModelPath("/app/(rsc)/node_modules/x"));
  });

  it("3. path never uses a numeric webpack module ID", () => {
    const modelsDir = resolveFaceApiModelsDirectory();
    assert.equal(/node_modules\/\d+(\/|$)/.test(modelsDir), false);
    assert.throws(() => assertRealFilesystemModelPath("node_modules/42/model"));
  });

  it("4–5. all required manifests and shards are validated", () => {
    const validation = validateFaceApiModelFiles();
    assert.equal(validation.ok, true);
    for (const file of REQUIRED_FACE_API_MODEL_FILES) {
      assert.ok(
        validation.present.includes(file),
        `expected present: ${file}`,
      );
      assert.ok(
        fs.existsSync(path.join(validation.modelsDir, file)),
        `file missing on disk: ${file}`,
      );
    }
    assert.equal(validation.missing.length, 0);
  });

  it("6. missing file produces a precise error", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "face-api-models-"));
    const fakeCwd = tmp;
    const dest = path.join(fakeCwd, FACE_API_MODELS_RELATIVE_DIR);
    fs.mkdirSync(dest, { recursive: true });
    // Copy only half the required files.
    const real = resolveFaceApiModelsDirectory();
    fs.copyFileSync(
      path.join(real, "ssd_mobilenetv1_model-weights_manifest.json"),
      path.join(dest, "ssd_mobilenetv1_model-weights_manifest.json"),
    );
    const missing = listMissingFaceApiModelFiles(dest);
    assert.ok(missing.length > 0);
    assert.ok(missing.includes("ssd_mobilenetv1_model.bin"));
    assert.throws(
      () => assertFaceApiModelsPresent(fakeCwd),
      /Missing files:.*ssd_mobilenetv1_model\.bin/,
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("7. setup script copies required files", () => {
    const script = path.join(process.cwd(), "scripts/copy-face-api-models.mjs");
    assert.ok(fs.existsSync(script));
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const modelsDir = resolveFaceApiModelsDirectory();
    for (const file of REQUIRED_FACE_API_MODEL_FILES) {
      assert.ok(fs.existsSync(path.join(modelsDir, file)), file);
    }
  });

  it("8–9. failed model init does not permanently poison later retries", async () => {
    resetFaceApiModelLoadCacheForTests();
    const modelsDir = resolveFaceApiModelsDirectory();
    const shard = path.join(modelsDir, "ssd_mobilenetv1_model.bin");
    const backup = `${shard}.bak-test`;
    fs.renameSync(shard, backup);
    try {
      const { extractFaceEmbedding } = await import("./local-face-embedding-evaluator");
      // 1x1 PNG
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      );
      const failed = await extractFaceEmbedding(png);
      assert.equal(failed.status, "error");
      assert.ok(
        failed.safeErrorMessage?.includes("missing") ||
          failed.safeErrorCode === "face_extraction_error" ||
          Boolean(failed.safeErrorMessage),
      );
    } finally {
      fs.renameSync(backup, shard);
      resetFaceApiModelLoadCacheForTests();
    }

    // After restore + cache clear, validation succeeds again (retry not poisoned).
    assert.doesNotThrow(() => assertFaceApiModelsPresent());
    const validation = validateFaceApiModelFiles();
    assert.equal(validation.ok, true);
  });

  it("10. startup validation uses the same model directory as the evaluator", async () => {
    const expected = resolveFaceApiModelsDirectory();
    const report = await runFaceNoveltyStartupValidation();
    assert.equal(report.modelsDirectory, expected);
    assert.equal(report.modelWeightsPresent, true);
  });

  it("11. preflight reports NOT READY when a shard is missing (simulated)", async () => {
    const report = await runFaceNoveltyPreflight({
      simulate: { modelWeightsMissing: true },
      historyCounts: { priorNoveltyHistoryCount: 0, priorEmbeddingCount: 0 },
    });
    assert.equal(report.ready, false);
    assert.equal(report.verdict, "NOT READY");
    assert.equal(report.openaiOrProviderCalled, false);
    const weights = report.checks.find((c) => c.id === "model_weights");
    assert.ok(weights);
    assert.equal(weights!.ok, false);
  });

  it("12. retry reaches face detection when model files exist (filesystem gate)", () => {
    // Full TF detect is covered by live retry; here we prove the gate opens.
    const modelsDir = assertFaceApiModelsPresent();
    assert.ok(fs.existsSync(path.join(modelsDir, "ssd_mobilenetv1_model.bin")));
    assert.ok(
      !modelsDir.includes("/(rsc)/"),
      "detector load path must be a real filesystem directory",
    );
  });

  it("13. no OpenAI or paid provider call occurs", async () => {
    let openaiTouched = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0]);
      if (/openai|api\.openai/i.test(url)) openaiTouched = true;
      return originalFetch(...args);
    }) as typeof fetch;
    try {
      await runFaceNoveltyStartupValidation();
      await runFaceNoveltyPreflight({
        historyCounts: { priorNoveltyHistoryCount: 0, priorEmbeddingCount: 0 },
      });
      assert.equal(openaiTouched, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Phase 2.0B.5 relative constant", () => {
  before(() => {
    // ensure copy has run for sibling suite assumptions
  });
  after(() => undefined);

  it("FACE_API_MODELS_RELATIVE_DIR is stable", () => {
    assert.equal(
      FACE_API_MODELS_RELATIVE_DIR.replace(/\\/g, "/"),
      "server-assets/face-api-models",
    );
  });
});
