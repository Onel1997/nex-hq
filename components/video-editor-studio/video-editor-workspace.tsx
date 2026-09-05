"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Film,
  FolderOpen,
  Library,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { XerianoMediaSaveLink } from "@/components/xeriano/media-save-link";
import { createSecureBrowserUuid } from "@/lib/browser/secure-uuid";
import type {
  VideoEditorPublicJob,
  VideoEditorSource,
  VideoEditorTempo,
} from "@/lib/video-editor-studio/contracts";
import {
  VIDEO_EDITOR_CONTRACT_VERSION,
  VIDEO_EDITOR_MAX_CLIP_BYTES,
  VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES,
  VIDEO_EDITOR_MAX_MUSIC_BYTES,
  VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS,
  VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES,
  VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS,
} from "@/lib/video-editor-studio/contracts";
import {
  clampVideoEditorTrim,
  composeVideoEditorSuggestion,
  moveVideoEditorClip,
  selectedVideoEditorDuration,
  type VideoEditorAnalysisSuggestion,
} from "@/lib/video-editor-studio/project";
import { uploadXerianoTempReference } from "@/lib/xeriano/temp-references/client";

type EditorClip = {
  id: string;
  source: VideoEditorSource | null;
  title: string;
  order: number;
  durationSeconds: number;
  byteLength: number;
  width: number | null;
  height: number | null;
  trimStartSeconds: number;
  trimEndSeconds: number;
  enabled: boolean;
  state: "UPLOADING" | "READY" | "FAILED";
  previewUrl: string | null;
  analysis: VideoEditorAnalysisSuggestion | null;
  message: string | null;
};

type EditorMusic = {
  source: VideoEditorSource;
  title: string;
  volume: number;
  fade: boolean;
  byteLength: number;
};

type EditorProject = {
  projectId: string;
  title: string;
  clips: EditorClip[];
  targetDurationSeconds: 15 | 20 | 25 | 30;
  tempo: VideoEditorTempo;
  keepOriginalAudio: boolean;
  music: EditorMusic | null;
  renderJobId: string | null;
};

type LibraryVideo = {
  id: string;
  title: string;
  mimeType: string;
  byteLength: number;
  contentUrl?: string;
};

const PROJECT_STORAGE_KEY = "xeriamo-video-editor-owner-project-v1";

function newProject(): EditorProject {
  return {
    projectId: createSecureBrowserUuid(),
    title: "Fashion Reel",
    clips: [],
    targetDurationSeconds: 20,
    tempo: "DYNAMIC",
    keepOriginalAudio: false,
    music: null,
    renderJobId: null,
  };
}

function sourceUrl(source: VideoEditorSource) {
  const kind = source.kind === "TEMP_REFERENCE" ? "temp" : "library";
  return `/api/video-editor-studio/sources/${kind}/${encodeURIComponent(source.id)}`;
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function browserVideoMetadata(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => resolve({
        duration: finite(video.duration, 0),
        width: video.videoWidth,
        height: video.videoHeight,
      });
      video.onerror = () => reject(new Error("CLIP_UNREADABLE"));
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function restoredProject(value: unknown): EditorProject | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<EditorProject>;
  if (typeof candidate.projectId !== "string" || !Array.isArray(candidate.clips)) return null;
  return {
    ...newProject(),
    ...candidate,
    clips: candidate.clips.slice(0, 12).map((clip, order) => ({
      ...clip,
      order,
      previewUrl: clip.source && clip.state === "READY" ? sourceUrl(clip.source) : null,
      analysis: clip.analysis ?? null,
      message: clip.message ?? null,
      byteLength: Number.isFinite(clip.byteLength) ? clip.byteLength : 0,
    })),
  } as EditorProject;
}

function formatSeconds(value: number) {
  return `${value.toFixed(1).replace(".", ",")} Sek.`;
}

export function VideoEditorStudioWorkspace() {
  const [project, setProject] = useState<EditorProject>(() => newProject());
  const [hydrated, setHydrated] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [sequencePreviewIndex, setSequencePreviewIndex] = useState<number | null>(null);
  const [job, setJob] = useState<VideoEditorPublicJob | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const renderStartRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (stored) {
        const restored = restoredProject(JSON.parse(stored));
        if (restored) setProject(restored);
      }
    } catch {
      // A private/local draft is optional; the editor remains fully usable.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const serializable = {
        ...project,
        clips: project.clips.map((clip) => ({ ...clip, previewUrl: null })),
      };
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Rendering does not depend on localStorage authority.
    }
  }, [hydrated, project]);

  const observeJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/video-editor-studio/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { job?: VideoEditorPublicJob; error?: string } | null;
    if (!response.ok || !payload?.job) throw new Error(payload?.error ?? "Exportstatus konnte nicht geladen werden.");
    setJob((current) => {
      if (current && ["SUCCEEDED", "FAILED"].includes(current.status)) return current;
      return payload.job!;
    });
    return payload.job;
  }, []);

  useEffect(() => {
    const jobId = project.renderJobId;
    if (!hydrated || !jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const observed = await observeJob(jobId);
        if (!cancelled && ["PREPARING", "RENDERING"].includes(observed.status)) {
          pollingRef.current = window.setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) pollingRef.current = window.setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (pollingRef.current !== null) window.clearTimeout(pollingRef.current);
    };
  }, [hydrated, observeJob, project.renderJobId]);

  const readyClips = useMemo(() => project.clips.filter((clip) => clip.state === "READY"), [project.clips]);
  const totalSelected = useMemo(() => selectedVideoEditorDuration(project.clips.map((clip) => ({
    id: clip.id,
    source: clip.source ?? { kind: "TEMP_REFERENCE", id: "00000000-0000-4000-8000-000000000000" },
    title: clip.title,
    order: clip.order,
    enabled: clip.enabled,
    trimStartSeconds: clip.trimStartSeconds,
    trimEndSeconds: clip.trimEndSeconds,
    sourceDurationSeconds: clip.durationSeconds,
  }))), [project.clips]);
  const exportDuration = Math.min(project.targetDurationSeconds, totalSelected);
  const shortfall = Math.max(0, project.targetDurationSeconds - totalSelected);
  const sequenceClips = useMemo(
    () => project.clips.filter((clip) => clip.enabled && clip.state === "READY" && clip.previewUrl).sort((a, b) => a.order - b.order),
    [project.clips],
  );
  const sequencePreviewClip = sequencePreviewIndex === null ? null : sequenceClips[sequencePreviewIndex] ?? null;

  const patchClip = useCallback((id: string, patch: Partial<EditorClip>) => {
    setProject((current) => ({
      ...current,
      clips: current.clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip),
    }));
  }, []);

  async function addFiles(files: FileList | File[]) {
    const available = Math.max(0, 12 - project.clips.length);
    const selected = Array.from(files).slice(0, available);
    let acceptedBytes = project.clips.reduce((sum, clip) => sum + clip.byteLength, 0) + (project.music?.byteLength ?? 0);
    for (const file of selected) {
      if (file.size > VIDEO_EDITOR_MAX_CLIP_BYTES) {
        setNotice("Ein Video darf höchstens 100 MiB groß sein.");
        continue;
      }
      if (acceptedBytes + file.size > VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES) {
        setNotice("Alle ausgewählten Dateien dürfen zusammen höchstens 240 MiB groß sein.");
        continue;
      }
      const id = createSecureBrowserUuid();
      const previewUrl = URL.createObjectURL(file);
      const pending: EditorClip = {
        id,
        source: null,
        title: file.name,
        order: project.clips.length,
        durationSeconds: 0,
        byteLength: file.size,
        width: null,
        height: null,
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        enabled: true,
        state: "UPLOADING",
        previewUrl,
        analysis: null,
        message: "Clip wird sicher hochgeladen …",
      };
      setProject((current) => ({ ...current, clips: [...current.clips, { ...pending, order: current.clips.length }] }));
      try {
        const metadata = await browserVideoMetadata(file);
        if (!metadata.duration) throw new Error("CLIP_UNREADABLE");
        if (metadata.duration > VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS + 0.05) throw new Error("CLIP_TOO_LONG");
        const uploaded = await uploadXerianoTempReference({ studio: "VIDEO_EDITOR_STUDIO", kind: "VIDEO", file });
        const source = { kind: "TEMP_REFERENCE" as const, id: uploaded.tempReferenceId };
        URL.revokeObjectURL(previewUrl);
        patchClip(id, {
          source,
          durationSeconds: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          trimEndSeconds: metadata.duration,
          state: "READY",
          previewUrl: sourceUrl(source),
          message: null,
        });
        acceptedBytes += file.size;
      } catch {
        URL.revokeObjectURL(previewUrl);
        patchClip(id, { state: "FAILED", byteLength: 0, message: "Dieser Clip konnte nicht gelesen oder hochgeladen werden." });
      }
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    if (libraryVideos.length) return;
    setLibraryLoading(true);
    try {
      const response = await fetch("/api/xeriano/library?type=VIDEO", { cache: "no-store" });
      const payload = (await response.json()) as { assets?: LibraryVideo[] };
      if (!response.ok || !payload.assets) throw new Error();
      setLibraryVideos(payload.assets);
    } catch {
      setNotice("Die Video-Bibliothek konnte nicht geladen werden.");
    } finally {
      setLibraryLoading(false);
    }
  }

  function addLibraryVideo(asset: LibraryVideo) {
    if (project.clips.length >= 12 || project.clips.some((clip) => clip.source?.kind === "LIBRARY_ASSET" && clip.source.id === asset.id)) return;
    if (asset.byteLength > VIDEO_EDITOR_MAX_CLIP_BYTES) {
      setNotice("Ein Video darf höchstens 100 MiB groß sein.");
      return;
    }
    const totalBytes = project.clips.reduce((sum, clip) => sum + clip.byteLength, 0) + (project.music?.byteLength ?? 0);
    if (totalBytes + asset.byteLength > VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES) {
      setNotice("Alle ausgewählten Dateien dürfen zusammen höchstens 240 MiB groß sein.");
      return;
    }
    const source = { kind: "LIBRARY_ASSET" as const, id: asset.id };
    setProject((current) => ({
      ...current,
      clips: [...current.clips, {
        id: createSecureBrowserUuid(), source, title: asset.title, order: current.clips.length,
        durationSeconds: 1, byteLength: asset.byteLength, width: null, height: null, trimStartSeconds: 0, trimEndSeconds: 1,
        enabled: true, state: "UPLOADING", previewUrl: sourceUrl(source), analysis: null, message: "Metadaten werden gelesen …",
      }],
    }));
  }

  function receiveVideoMetadata(id: string, video: HTMLVideoElement) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const clip = project.clips.find((entry) => entry.id === id);
    if (!clip || (clip.durationSeconds > 1 && clip.message !== "Metadaten werden gelesen …")) return;
    if (video.duration > VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS + 0.05) {
      patchClip(id, { state: "FAILED", message: "Ein Quellvideo darf höchstens 60 Sekunden lang sein." });
      return;
    }
    patchClip(id, {
      durationSeconds: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      trimEndSeconds: video.duration,
      message: null,
      state: "READY",
    });
  }

  async function runSmartCut() {
    const candidates = readyClips.filter((clip) => clip.source);
    if (!candidates.length) return;
    setAnalysisBusy(true);
    setNotice("Die besten Abschnitte werden gesucht …");
    const results: PromiseSettledResult<{ id: string; analysis: VideoEditorAnalysisSuggestion & { inspection?: { durationSeconds: number; width: number; height: number } } }>[] = new Array(candidates.length);
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES, candidates.length) }, async () => {
      while (nextIndex < candidates.length) {
        const index = nextIndex++;
        const clip = candidates[index]!;
        try {
      const response = await fetch("/api/video-editor-studio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: clip.source }),
      });
      const payload = (await response.json().catch(() => null)) as { analysis?: VideoEditorAnalysisSuggestion & { inspection?: { durationSeconds: number; width: number; height: number } }; error?: string } | null;
      if (!response.ok || !payload?.analysis) throw new Error(payload?.error ?? "Analyse fehlgeschlagen");
          results[index] = { status: "fulfilled", value: { id: clip.id, analysis: payload.analysis } };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }));
    let successes = 0;
    setProject((current) => ({
      ...current,
      clips: current.clips.map((clip) => {
        const index = candidates.findIndex((candidate) => candidate.id === clip.id);
        if (index < 0) return clip;
        const result = results[index];
        if (result?.status !== "fulfilled") return { ...clip, message: "Automatische Analyse nicht verfügbar – manueller Schnitt bleibt möglich." };
        successes += 1;
        return {
          ...clip,
          analysis: result.value.analysis,
          trimStartSeconds: result.value.analysis.trimStartSeconds,
          trimEndSeconds: result.value.analysis.trimEndSeconds,
          durationSeconds: result.value.analysis.inspection?.durationSeconds ?? clip.durationSeconds,
          width: result.value.analysis.inspection?.width ?? clip.width,
          height: result.value.analysis.inspection?.height ?? clip.height,
          message: result.value.analysis.warnings[0] ?? null,
        };
      }),
    }));
    setNotice(successes ? `Vorschläge für ${successes} Clip${successes === 1 ? "" : "s"} erstellt.` : "Die automatische Analyse war nicht verfügbar. Du kannst alle Clips manuell schneiden.");
    setAnalysisBusy(false);
  }

  function composeCut() {
    const analyses = Object.fromEntries(project.clips.map((clip) => [clip.id, clip.analysis ?? undefined]));
    const composed = composeVideoEditorSuggestion({
      clips: project.clips.filter((clip) => clip.source).map((clip) => ({
        id: clip.id, source: clip.source!, title: clip.title, order: clip.order, enabled: clip.enabled,
        trimStartSeconds: clip.trimStartSeconds, trimEndSeconds: clip.trimEndSeconds,
        sourceDurationSeconds: clip.durationSeconds,
      })),
      analyses,
      targetDurationSeconds: project.targetDurationSeconds,
      tempo: project.tempo,
    });
    setProject((current) => ({
      ...current,
      clips: composed.clips.map((item) => ({ ...current.clips.find((clip) => clip.id === item.id)!, ...item, durationSeconds: item.sourceDurationSeconds })),
    }));
    setNotice(composed.shortfallSeconds > 0.1
      ? "Für ein gutes Video fehlen noch einige Sekunden. Füge weitere Clips hinzu oder wähle eine kürzere Zieldauer."
      : "Schnittvorschlag erstellt. Du kannst ihn jetzt weiter anpassen.");
  }

  async function uploadMusic(file: File) {
    if (file.size > VIDEO_EDITOR_MAX_MUSIC_BYTES) {
      setNotice("Eine Musikdatei darf höchstens 15 MiB groß sein.");
      return;
    }
    const clipBytes = project.clips.reduce((sum, clip) => sum + clip.byteLength, 0);
    if (clipBytes + file.size > VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES) {
      setNotice("Alle ausgewählten Dateien dürfen zusammen höchstens 240 MiB groß sein.");
      return;
    }
    setMusicBusy(true);
    try {
      const uploaded = await uploadXerianoTempReference({ studio: "VIDEO_EDITOR_STUDIO", kind: "AUDIO", file });
      setProject((current) => ({
        ...current,
        music: { source: { kind: "TEMP_REFERENCE", id: uploaded.tempReferenceId }, title: file.name, volume: 0.7, fade: true, byteLength: file.size },
      }));
    } catch {
      setNotice("Die Musikdatei konnte nicht hochgeladen werden.");
    } finally {
      setMusicBusy(false);
    }
  }

  async function startRender() {
    if (renderStartRef.current) return;
    if (project.renderJobId && (!job || ["PREPARING", "RENDERING"].includes(job.status))) return;
    const clips = project.clips.filter((clip) => clip.state === "READY" && clip.source);
    if (clips.filter((clip) => clip.enabled).length < 2) {
      setNotice("Wähle mindestens zwei verwendbare Clips für den Export aus.");
      return;
    }
    const actualDurationTotal = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
    if (actualDurationTotal > VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS + 0.05) {
      setNotice("Deine ausgewählten Videos dürfen zusammen höchstens 180 Sekunden lang sein.");
      return;
    }
    renderStartRef.current = true;
    const jobId = createSecureBrowserUuid();
    setRenderBusy(true);
    setProject((current) => ({ ...current, renderJobId: jobId }));
    setJob(null);
    try {
      const response = await fetch("/api/video-editor-studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractVersion: VIDEO_EDITOR_CONTRACT_VERSION,
          jobId,
          projectId: project.projectId,
          title: project.title,
          clips: clips.map((clip) => ({
            id: clip.id,
            source: clip.source,
            title: clip.title,
            order: clip.order,
            enabled: clip.enabled,
            trimStartSeconds: clip.trimStartSeconds,
            trimEndSeconds: clip.trimEndSeconds,
            sourceDurationSeconds: clip.durationSeconds,
          })),
          targetDurationSeconds: project.targetDurationSeconds,
          aspectRatio: "9:16",
          resolution: "720x1280",
          fps: 30,
          tempo: project.tempo,
          preset: "STREETWEAR_PRODUCT_REEL",
          keepOriginalAudio: project.keepOriginalAudio,
          music: project.music,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { job?: VideoEditorPublicJob; error?: string } | null;
      if (!response.ok || !payload?.job) throw new Error(payload?.error ?? "Export konnte nicht gestartet werden.");
      setJob(payload.job);
      setNotice("Der Fashion-Reel-Export wurde sicher gestartet.");
    } catch (error) {
      // The known id remains observable. A network ambiguity never triggers a
      // second POST and therefore cannot duplicate the render.
      try {
        await observeJob(jobId);
      } catch {
        setNotice(error instanceof Error ? error.message : "Export konnte nicht gestartet werden.");
      }
    } finally {
      setRenderBusy(false);
      renderStartRef.current = false;
    }
  }

  function resetProject() {
    setProject(newProject());
    setJob(null);
    setSequencePreviewIndex(null);
    setNotice("Neues Projekt gestartet. Originale und Exporte bleiben erhalten.");
  }

  const currentJobRunning = Boolean(project.renderJobId && (!job || ["PREPARING", "RENDERING"].includes(job.status)));

  return (
    <main className="ve-studio">
      <header className="ve-hero">
        <div>
          <span className="ve-kicker">OWNER PILOT · VIDEO EDITOR</span>
          <h1>Fashion-Clips. Ein starker Reel.</h1>
          <p>Stelle kurze Videos zu einem hochwertigen, mobilen Fashion-Reel zusammen.</p>
        </div>
        <button type="button" className="ve-ghost-button" onClick={resetProject}><Plus /> Neues Projekt</button>
      </header>

      {notice ? <div className="ve-notice" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Hinweis schließen">×</button></div> : null}

      <section className="ve-panel" aria-labelledby="ve-clips-title">
        <div className="ve-section-head">
          <div><span>01</span><h2 id="ve-clips-title">Clips</h2><p>2 bis 12 Videos – je höchstens 100 MiB und 60 Sekunden.</p></div>
          <strong>{project.clips.length}/12</strong>
        </div>
        <div className="ve-source-actions">
          <label className="ve-primary-action"><Upload /> Videos hochladen<input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple onChange={(event) => event.target.files && void addFiles(event.target.files)} /></label>
          <button type="button" className="ve-secondary-action" onClick={() => void openLibrary()}><Library /> Aus Bibliothek</button>
        </div>
        {libraryOpen ? <div className="ve-library-picker">
          <div><h3>Eigene Videos</h3><button type="button" onClick={() => setLibraryOpen(false)}>Schließen</button></div>
          {libraryLoading ? <p><LoaderCircle className="ve-spin" /> Bibliothek wird geladen …</p> : libraryVideos.length ? <div className="ve-library-grid">{libraryVideos.map((asset) => <button type="button" onClick={() => addLibraryVideo(asset)} key={asset.id}><video src={`/api/video-editor-studio/sources/library/${asset.id}`} muted preload="metadata"/><span>{asset.title}</span><Plus /></button>)}</div> : <p>Noch keine Videos in der Bibliothek.</p>}
        </div> : null}
        {project.clips.length ? <div className="ve-clip-list">{[...project.clips].sort((a, b) => a.order - b.order).map((clip, index) => {
          const bounds = clampVideoEditorTrim({ start: clip.trimStartSeconds, end: clip.trimEndSeconds, duration: Math.max(0.25, clip.durationSeconds) });
          return <article className={`ve-clip-card ve-clip-card--${clip.state.toLowerCase()}`} key={clip.id}>
            <div className="ve-clip-preview">{clip.previewUrl ? <video src={clip.previewUrl} controls playsInline preload="metadata" onLoadedMetadata={(event) => receiveVideoMetadata(clip.id, event.currentTarget)} onPlay={(event) => { if (event.currentTarget.currentTime < bounds.start || event.currentTarget.currentTime >= bounds.end) event.currentTarget.currentTime = bounds.start; }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= bounds.end) event.currentTarget.pause(); }}/> : <Film/>}</div>
            <div className="ve-clip-body">
              <div className="ve-clip-title"><div><span>Clip {index + 1}</span><h3>{clip.title}</h3></div><label><input type="checkbox" checked={clip.enabled} onChange={(event) => patchClip(clip.id, { enabled: event.target.checked })}/> Aktiv</label></div>
              {clip.state === "UPLOADING" ? <p className="ve-clip-message"><LoaderCircle className="ve-spin"/> {clip.message}</p> : null}
              {clip.state === "FAILED" ? <p className="ve-clip-error">{clip.message}</p> : null}
              {clip.state === "READY" ? <>
                <div className="ve-trim-summary"><span>Auswahl</span><strong>{formatSeconds(bounds.end - bounds.start)}</strong><small>{clip.width && clip.height ? `${clip.width}×${clip.height} · ` : ""}{formatSeconds(clip.durationSeconds)}</small></div>
                <label className="ve-range-label"><span>Start · {bounds.start.toFixed(1)} s</span><input type="range" min="0" max={Math.max(0.25, clip.durationSeconds - 0.25)} step="0.1" value={bounds.start} onChange={(event) => { const next = clampVideoEditorTrim({ start: Number(event.target.value), end: bounds.end, duration: clip.durationSeconds }); patchClip(clip.id, { trimStartSeconds: next.start, trimEndSeconds: next.end }); }}/></label>
                <label className="ve-range-label"><span>Ende · {bounds.end.toFixed(1)} s</span><input type="range" min={Math.min(clip.durationSeconds, bounds.start + 0.25)} max={clip.durationSeconds} step="0.1" value={bounds.end} onChange={(event) => { const next = clampVideoEditorTrim({ start: bounds.start, end: Number(event.target.value), duration: clip.durationSeconds }); patchClip(clip.id, { trimStartSeconds: next.start, trimEndSeconds: next.end }); }}/></label>
                {clip.message ? <p className="ve-clip-message">{clip.message}</p> : null}
              </> : null}
              <div className="ve-clip-actions">
                <button type="button" disabled={index === 0} aria-label="Clip nach oben" onClick={() => setProject((current) => ({ ...current, clips: moveVideoEditorClip(current.clips, clip.id, -1) }))}><ArrowUp/></button>
                <button type="button" disabled={index === project.clips.length - 1} aria-label="Clip nach unten" onClick={() => setProject((current) => ({ ...current, clips: moveVideoEditorClip(current.clips, clip.id, 1) }))}><ArrowDown/></button>
                <button type="button" disabled={clip.state !== "READY"} onClick={() => patchClip(clip.id, { trimStartSeconds: 0, trimEndSeconds: clip.durationSeconds, analysis: null })}><RotateCcw/> Original</button>
                <button type="button" aria-label="Clip entfernen" onClick={() => setProject((current) => ({ ...current, clips: current.clips.filter((entry) => entry.id !== clip.id).map((entry, order) => ({ ...entry, order })) }))}><Trash2/></button>
              </div>
            </div>
          </article>;
        })}</div> : <div className="ve-empty"><Clapperboard/><h3>Deine Clips erscheinen hier.</h3><p>Lade mehrere kurze Videos hoch oder wähle bestehende Videos aus der Bibliothek.</p></div>}
      </section>

      <section className="ve-panel" aria-labelledby="ve-smart-title">
        <div className="ve-section-head"><div><span>02</span><h2 id="ve-smart-title">Smart Cut</h2><p>Technische Qualitätsanalyse als unverbindlicher Vorschlag.</p></div><WandSparkles/></div>
        <div className="ve-smart-actions">
          <button type="button" className="ve-primary-action" disabled={analysisBusy || !readyClips.length} onClick={() => void runSmartCut()}>{analysisBusy ? <LoaderCircle className="ve-spin"/> : <Sparkles/>} {analysisBusy ? "Abschnitte werden analysiert …" : "Beste Abschnitte finden"}</button>
          <button type="button" className="ve-secondary-action" disabled={!readyClips.length} onClick={composeCut}><Scissors/> Schnitt zusammenstellen</button>
        </div>
        <p className="ve-fineprint">Langsame Bewegungen bleiben willkommen. Du entscheidest immer selbst über Start, Ende und Reihenfolge.</p>
      </section>

      <section className="ve-panel" aria-labelledby="ve-settings-title">
        <div className="ve-section-head"><div><span>03</span><h2 id="ve-settings-title">Schnitt & Musik</h2><p>Einfach, klar und für Fashion-Reels optimiert.</p></div></div>
        <div className="ve-settings-grid">
          <label className="ve-field"><span>Projektname</span><input value={project.title} maxLength={160} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))}/></label>
          <fieldset className="ve-choice"><legend>Zieldauer</legend><div>{([15, 20, 25, 30] as const).map((duration) => <button type="button" className={project.targetDurationSeconds === duration ? "active" : ""} onClick={() => setProject((current) => ({ ...current, targetDurationSeconds: duration }))} key={duration}>{duration} Sek.</button>)}</div></fieldset>
          <fieldset className="ve-choice"><legend>Tempo</legend><div>{(["CALM", "DYNAMIC", "FAST"] as const).map((tempo) => <button type="button" className={project.tempo === tempo ? "active" : ""} onClick={() => setProject((current) => ({ ...current, tempo }))} key={tempo}>{tempo === "CALM" ? "Ruhig" : tempo === "DYNAMIC" ? "Dynamisch" : "Schnell"}</button>)}</div></fieldset>
          <div className="ve-static-setting"><span>Preset</span><strong><Check/> Streetwear Product Reel</strong><small>Überwiegend klare Hard Cuts, keine auffälligen Effekte.</small></div>
          <div className="ve-static-setting"><span>Exportformat</span><strong>9:16 · 720×1280 · 30 fps</strong><small>H.264 MP4 für iPhone, Instagram und TikTok.</small></div>
          <label className="ve-toggle"><input type="checkbox" checked={project.keepOriginalAudio} onChange={(event) => setProject((current) => ({ ...current, keepOriginalAudio: event.target.checked }))}/><span><strong>Originalton</strong><small>Standardmäßig aus</small></span></label>
          <div className="ve-music-box"><div><Music2/><span><strong>Eigene Musik</strong><small>Optional · MP3 oder WAV · höchstens 15 MiB</small></span></div>{project.music ? <><p>{project.music.title}</p><label className="ve-range-label"><span>Lautstärke · {Math.round(project.music.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={project.music.volume} onChange={(event) => setProject((current) => ({ ...current, music: current.music ? { ...current.music, volume: Number(event.target.value) } : null }))}/></label><label className="ve-toggle"><input type="checkbox" checked={project.music.fade} onChange={(event) => setProject((current) => ({ ...current, music: current.music ? { ...current.music, fade: event.target.checked } : null }))}/><span><strong>Sanft ein- und ausblenden</strong></span></label><button type="button" onClick={() => setProject((current) => ({ ...current, music: null }))}>Musik entfernen</button></> : <label className="ve-secondary-action"><Upload/>{musicBusy ? "Musik wird hochgeladen …" : "Musik auswählen"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav" disabled={musicBusy} onChange={(event) => event.target.files?.[0] && void uploadMusic(event.target.files[0])}/></label>}</div>
        </div>
      </section>

      <section className="ve-panel" aria-labelledby="ve-preview-title">
        <div className="ve-section-head"><div><span>04</span><h2 id="ve-preview-title">Vorschau & Export</h2><p>Prüfe Reihenfolge und Auswahl vor dem Rendern.</p></div></div>
        <div className="ve-export-summary"><div><span>Ausgewählte Clips</span><strong>{project.clips.filter((clip) => clip.enabled && clip.state === "READY").length}</strong></div><div><span>Reel-Dauer</span><strong>{formatSeconds(exportDuration)}</strong></div><div><span>Ziel</span><strong>{project.targetDurationSeconds} Sek.</strong></div></div>
        <div className="ve-sequence" aria-label="Schnittreihenfolge">{project.clips.filter((clip) => clip.enabled && clip.state === "READY").sort((a,b) => a.order-b.order).map((clip, index) => <div key={clip.id}><span>{index + 1}</span><strong>{clip.title}</strong><small>{formatSeconds(clip.trimEndSeconds - clip.trimStartSeconds)}</small></div>)}</div>
        {sequenceClips.length ? <div className="ve-sequence-preview">
          <button type="button" className="ve-secondary-action" onClick={() => setSequencePreviewIndex(0)}><Play/> Schnittvorschau abspielen</button>
          {sequencePreviewClip ? <div><video key={`${sequencePreviewClip.id}:${sequencePreviewIndex}`} src={sequencePreviewClip.previewUrl!} controls autoPlay playsInline muted={!project.keepOriginalAudio} preload="auto" onLoadedMetadata={(event) => { event.currentTarget.currentTime = sequencePreviewClip.trimStartSeconds; void event.currentTarget.play().catch(() => undefined); }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= sequencePreviewClip.trimEndSeconds) { event.currentTarget.pause(); setSequencePreviewIndex((current) => current !== null && current + 1 < sequenceClips.length ? current + 1 : null); } }}/><span>Clip {(sequencePreviewIndex ?? 0) + 1} von {sequenceClips.length}</span></div> : null}
        </div> : null}
        {shortfall > 0.1 ? <div className="ve-recommendation">Für ein gutes Video fehlen noch einige Sekunden. Füge weitere Clips hinzu oder wähle eine kürzere Zieldauer. Der Export bleibt möglich.</div> : null}
        <button type="button" className="ve-render-button" disabled={renderBusy || Boolean(currentJobRunning) || readyClips.filter((clip) => clip.enabled).length < 2 || !project.title.trim()} onClick={() => void startRender()}>{renderBusy || currentJobRunning ? <LoaderCircle className="ve-spin"/> : <Film/>}{currentJobRunning ? "Fashion-Reel wird gerendert …" : renderBusy ? "Export wird vorbereitet …" : job?.status === "FAILED" || job?.status === "SUCCEEDED" ? "Neuen Export rendern" : "Fashion-Reel rendern"}</button>

        {job ? <div className={`ve-result ve-result--${job.status.toLowerCase()}`}>
          {job.status === "PREPARING" ? <><LoaderCircle className="ve-spin"/><h3>Export wird vorbereitet …</h3><p>Dein Projekt ist sicher gespeichert.</p></> : null}
          {job.status === "RENDERING" ? <><LoaderCircle className="ve-spin"/><h3>Fashion-Reel wird gerendert …</h3><p>Du kannst die Seite verlassen und später zurückkehren.</p></> : null}
          {job.status === "FAILED" ? <><Pause/><h3>Export nicht abgeschlossen</h3><p>{job.error?.message ?? "Das Video konnte nicht fertig gerendert werden."}</p><small>Projekt, Clips und Schnitt bleiben erhalten. Ein neuer Export startet nur nach deinem Klick.</small></> : null}
          {job.status === "SUCCEEDED" && job.result ? <><div className="ve-result-video"><video src={job.result.playbackUrl} controls playsInline preload="metadata"/></div><h3>Dein Fashion-Reel ist fertig.</h3><p>{formatSeconds(job.result.durationSeconds)} · 720×1280 · 30 fps</p>{job.failedClipIds.length ? <small>{job.failedClipIds.length} nicht lesbare Clip{job.failedClipIds.length === 1 ? " wurde" : "s wurden"} ausgelassen.</small> : null}<div className="ve-result-actions"><XerianoMediaSaveLink href={job.result.downloadUrl} fileName={`${project.title || "xeriamo-fashion-reel"}.mp4`} mimeType="video/mp4" downloadLabel="Herunterladen"/><a href={`/hq/library`}>In Bibliothek ansehen <FolderOpen/></a></div></> : null}
        </div> : null}
      </section>
    </main>
  );
}
