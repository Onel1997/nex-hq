import { spawn } from "node:child_process";
import { statfs } from "node:fs/promises";
import { tmpdir } from "node:os";

import ffmpegPath from "ffmpeg-static";

import { VIDEO_EDITOR_MAX_OUTPUT_BYTES } from "./contracts";
import type { VideoEditorAnalysisSuggestion } from "./project";

const LOG_LIMIT = 512 * 1024;

export type VideoEditorMediaInspection = {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
};

export type VideoEditorRenderInput = {
  clips: Array<{
    id: string;
    filePath: string;
    trimStartSeconds: number;
    durationSeconds: number;
    inspection: VideoEditorMediaInspection;
  }>;
  keepOriginalAudio: boolean;
  music: null | { filePath: string; volume: number; fade: boolean };
  outputPath: string;
  timeoutMs: number;
};

function executable() {
  if (!ffmpegPath) throw new Error("VIDEO_EDITOR_FFMPEG_UNAVAILABLE");
  return ffmpegPath;
}

async function runFfmpeg(args: string[], timeoutMs: number) {
  if (timeoutMs < 1_000) throw new Error("VIDEO_EDITOR_TIMEOUT");
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable(), args, { stdio: "pipe" });
    child.stdin.end();
    let stderr = "";
    let timedOut = false;
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < LOG_LIMIT) stderr += chunk.toString("utf8").slice(0, LOG_LIMIT - stderr.length);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error("VIDEO_EDITOR_TIMEOUT"));
      if (code !== 0) return reject(new Error("VIDEO_EDITOR_FFMPEG_FAILED"));
      resolve(stderr);
    });
  });
}

function parseInspection(stderr: string): VideoEditorMediaInspection {
  const duration = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  const videoLine = stderr.split("\n").find((line) => /Stream .*Video:/i.test(line));
  const dimensions = videoLine?.match(/(?:^|[,\s])(\d{2,5})x(\d{2,5})(?:\s|\[|,)/);
  const fps = videoLine?.match(/(\d+(?:\.\d+)?)\s+fps\b/i) ?? videoLine?.match(/(\d+(?:\.\d+)?)\s+tbr\b/i);
  if (!duration || !dimensions || !fps) throw new Error("VIDEO_EDITOR_CLIP_UNREADABLE");
  let width = Number(dimensions[1]);
  let height = Number(dimensions[2]);
  const rotation = stderr.match(/rotation of\s+(-?\d+(?:\.\d+)?)\s+degrees/i);
  if (rotation && Math.abs(Math.round(Number(rotation[1])) / 90) % 2 === 1) [width, height] = [height, width];
  return {
    durationSeconds: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]),
    width,
    height,
    fps: Number(fps[1]),
    hasAudio: stderr.split("\n").some((line) => /Stream .*Audio:/i.test(line)),
  };
}

export function videoEditorExtension(mimeType: string) {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/x-m4v") return "m4v";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "mp4";
}

export async function inspectVideoEditorMediaPath(filePath: string, timeoutMs: number) {
  const stderr = await runFfmpeg(["-hide_banner", "-i", filePath, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"], timeoutMs);
  return parseInspection(stderr);
}

type Interval = { start: number; end: number };
function parseIntervals(stderr: string, prefix: "black" | "freeze", duration: number): Interval[] {
  const starts = [...stderr.matchAll(new RegExp(`${prefix}_start:\\s*(-?\\d+(?:\\.\\d+)?)`, "g"))].map((match) => Number(match[1]));
  const ends = [...stderr.matchAll(new RegExp(`${prefix}_end:\\s*(-?\\d+(?:\\.\\d+)?)`, "g"))].map((match) => Number(match[1]));
  return starts.map((start, index) => ({ start: Math.max(0, start), end: Math.min(duration, ends[index] ?? duration) }));
}
function overlap(start: number, end: number, interval: Interval) {
  return Math.max(0, Math.min(end, interval.end) - Math.max(start, interval.start));
}

export async function analyzeVideoEditorClipPath(input: {
  filePath: string;
  checksum: string;
  timeoutMs: number;
}): Promise<VideoEditorAnalysisSuggestion & { inspection: VideoEditorMediaInspection }> {
  const analysisLog = await runFfmpeg([
    "-hide_banner", "-i", input.filePath,
    "-vf", "blackdetect=d=0.18:pix_th=0.10,freezedetect=n=-50dB:d=0.45,blurdetect=block_width=32:block_height=32:block_pct=80,select='gt(scene,0.32)',showinfo",
    "-an", "-fps_mode", "vfr", "-f", "null", "-",
  ], input.timeoutMs);
  const inspection = parseInspection(analysisLog);
  const bad = [
    ...parseIntervals(analysisLog, "black", inspection.durationSeconds),
    ...parseIntervals(analysisLog, "freeze", inspection.durationSeconds),
  ];
  const window = Math.min(4, Math.max(2, inspection.durationSeconds - 0.2));
  let best = { start: 0, penalty: Number.POSITIVE_INFINITY };
  const lastStart = Math.max(0, inspection.durationSeconds - window);
  for (let start = 0; start <= lastStart + 0.001; start += 0.2) {
    const end = Math.min(inspection.durationSeconds, start + window);
    const edgePenalty = start < 0.12 || end > inspection.durationSeconds - 0.12 ? 0.12 : 0;
    const badPenalty = bad.reduce((sum, interval) => sum + overlap(start, end, interval), 0) / Math.max(0.25, end - start);
    if (badPenalty + edgePenalty < best.penalty) best = { start, penalty: badPenalty + edgePenalty };
  }
  const blurValues = (analysisLog.match(/blur_mean:\s*(\d+(?:\.\d+)?)/gi) ?? []).map((entry) => Number(entry.split(":")[1]));
  const meanBlur = blurValues.length ? blurValues.reduce((sum, value) => sum + value, 0) / blurValues.length : null;
  const sceneTimes = [...analysisLog.matchAll(/pts_time:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  const warnings = [
    bad.some((interval) => interval.end - interval.start >= 0.45) ? "Technisch schwache Abschnitte wurden ausgelassen." : null,
    meanBlur !== null && meanBlur > 12 ? "Der Clip wirkt stellenweise unscharf." : null,
    sceneTimes.length > 1 ? "Mehrere brauchbare Szenenwechsel erkannt." : null,
  ].filter((value): value is string => Boolean(value));
  return {
    trimStartSeconds: Number(best.start.toFixed(2)),
    trimEndSeconds: Number(Math.min(inspection.durationSeconds, best.start + window).toFixed(2)),
    qualityScore: Number(Math.max(0, Math.min(1, 1 - best.penalty)).toFixed(3)),
    contentKey: input.checksum.slice(0, 20),
    warnings,
    inspection,
  };
}

export async function assertVideoEditorProcessingSpace(requiredInputBytes: number) {
  try {
    const stats = await statfs(tmpdir());
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (available < requiredInputBytes + VIDEO_EDITOR_MAX_OUTPUT_BYTES + 96 * 1024 * 1024) throw new Error("VIDEO_EDITOR_PROCESSING_SPACE_LOW");
  } catch (error) {
    if (error instanceof Error && error.message === "VIDEO_EDITOR_PROCESSING_SPACE_LOW") throw error;
  }
}

export async function renderVideoEditorMp4(input: VideoEditorRenderInput) {
  const inputArgs = input.clips.flatMap((clip) => ["-i", clip.filePath]);
  if (input.music) inputArgs.push("-i", input.music.filePath);
  const totalDuration = input.clips.reduce((total, clip) => total + clip.durationSeconds, 0);
  const filters: string[] = [];
  const concatLabels: string[] = [];
  input.clips.forEach((clip, index) => {
    filters.push(`[${index}:v]trim=start=${clip.trimStartSeconds.toFixed(3)}:duration=${clip.durationSeconds.toFixed(3)},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,fps=30,setsar=1,format=yuv420p[v${index}]`);
    concatLabels.push(`[v${index}]`);
    if (input.keepOriginalAudio) {
      filters.push(clip.inspection.hasAudio
        ? `[${index}:a]atrim=start=${clip.trimStartSeconds.toFixed(3)}:duration=${clip.durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${clip.durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`);
      concatLabels.push(`[a${index}]`);
    }
  });
  filters.push(`${concatLabels.join("")}concat=n=${input.clips.length}:v=1:a=${input.keepOriginalAudio ? 1 : 0}[video]${input.keepOriginalAudio ? "[original]" : ""}`);
  let audioLabel: string | null = input.keepOriginalAudio ? "[original]" : null;
  if (input.music) {
    const fadeOutStart = Math.max(0, totalDuration - 0.8);
    filters.push(`[${input.clips.length}:a]atrim=duration=${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${input.music.volume.toFixed(3)},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo${input.music.fade ? `,afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.8` : ""}[music]`);
    if (audioLabel) {
      filters.push(`${audioLabel}[music]amix=inputs=2:duration=first:dropout_transition=0[audio]`);
      audioLabel = "[audio]";
    } else audioLabel = "[music]";
  }
  await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-y", ...inputArgs,
    "-filter_complex", filters.join(";"), "-map", "[video]",
    ...(audioLabel ? ["-map", audioLabel, "-c:a", "aac", "-b:a", "192k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "6M", "-bufsize", "12M",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", totalDuration.toFixed(3), input.outputPath,
  ], input.timeoutMs);
  const inspection = await inspectVideoEditorMediaPath(input.outputPath, Math.min(15_000, Math.max(1_000, input.timeoutMs)));
  if (inspection.width !== 720 || inspection.height !== 1280 || Math.abs(inspection.fps - 30) > 0.1) throw new Error("VIDEO_EDITOR_OUTPUT_INVALID");
  return { inspection };
}
