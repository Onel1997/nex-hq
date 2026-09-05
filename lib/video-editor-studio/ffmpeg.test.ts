import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import ffmpegPath from "ffmpeg-static";

import {
  analyzeVideoEditorClipPath,
  inspectVideoEditorMediaPath,
  renderVideoEditorMp4,
} from "./ffmpeg";

async function command(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg missing"));
    const child = spawn(ffmpegPath, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)));
  });
}

test("isolated renderer emits H.264-compatible 720x1280 MP4 at 30 fps without changing originals", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "video-editor-test-"));
  try {
    const paths = [path.join(directory, "one.mp4"), path.join(directory, "two.mp4")];
    await command(["-y", "-f", "lavfi", "-i", "color=c=red:s=180x320:r=30:d=1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", paths[0]!]);
    await command(["-y", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30:d=1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", paths[1]!]);
    const originals = await Promise.all(paths.map((entry) => readFile(entry)));
    const inspections = await Promise.all(paths.map((entry) => inspectVideoEditorMediaPath(entry, 20_000)));
    const outputPath = path.join(directory, "output.mp4");
    const rendered = await renderVideoEditorMp4({
      clips: paths.map((filePath, index) => ({
        id: String(index), filePath, trimStartSeconds: 0,
        durationSeconds: 1, inspection: inspections[index]!,
      })),
      keepOriginalAudio: false,
      music: null,
      outputPath,
      timeoutMs: 90_000,
    });
    assert.equal(rendered.inspection.width, 720);
    assert.equal(rendered.inspection.height, 1280);
    assert.ok(Math.abs(rendered.inspection.fps - 30) < 0.1);
    assert.equal(rendered.inspection.hasAudio, false);
    assert.equal((await readFile(outputPath)).subarray(4, 8).toString("ascii"), "ftyp");
    assert.deepEqual(await readFile(paths[0]!), originals[0], "source bytes remain unchanged");
    assert.deepEqual(await readFile(paths[1]!), originals[1], "source bytes remain unchanged");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Smart Cut returns a bounded manual suggestion and does not use a generative service", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "video-editor-analysis-test-"));
  try {
    const source = path.join(directory, "clip.mp4");
    await command(["-y", "-f", "lavfi", "-i", "testsrc2=s=180x320:r=30:d=2.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", source]);
    const analysis = await analyzeVideoEditorClipPath({ filePath: source, checksum: "a".repeat(64), timeoutMs: 50_000 });
    assert.ok(analysis.trimStartSeconds >= 0);
    assert.ok(analysis.trimEndSeconds <= analysis.inspection.durationSeconds + 0.01);
    assert.ok(analysis.trimEndSeconds - analysis.trimStartSeconds >= 2);
    assert.equal(analysis.contentKey, "a".repeat(20));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("optional music and requested original audio produce an AAC-compatible audio track", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "video-editor-audio-test-"));
  try {
    const first = path.join(directory, "audio-one.mp4");
    const second = path.join(directory, "silent-two.mp4");
    const musicPath = path.join(directory, "music.wav");
    await command([
      "-y", "-f", "lavfi", "-i", "color=c=purple:s=180x320:r=30:d=1.2",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.2",
      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", first,
    ]);
    await command(["-y", "-f", "lavfi", "-i", "color=c=green:s=180x320:r=30:d=1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", second]);
    await command(["-y", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=2.2", musicPath]);
    const paths = [first, second];
    const inspections = await Promise.all(paths.map((entry) => inspectVideoEditorMediaPath(entry, 20_000)));
    const outputPath = path.join(directory, "audio-output.mp4");
    const rendered = await renderVideoEditorMp4({
      clips: paths.map((filePath, index) => ({
        id: String(index), filePath, trimStartSeconds: 0,
        durationSeconds: 1, inspection: inspections[index]!,
      })),
      keepOriginalAudio: true,
      music: { filePath: musicPath, volume: 0.5, fade: true },
      outputPath,
      timeoutMs: 90_000,
    });
    assert.equal(rendered.inspection.hasAudio, true);
    assert.equal(rendered.inspection.width, 720);
    assert.equal(rendered.inspection.height, 1280);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
