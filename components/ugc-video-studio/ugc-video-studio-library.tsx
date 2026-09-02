"use client";

import {
  Clipboard,
  Heart,
  Pencil,
  Play,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  UGC_VIDEO_BITRATE_LABELS,
  UGC_VIDEO_TYPE_LABELS,
  type SavedUgcVideoPrompt,
  type UgcVideoGenerationSetup,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";
import { ugcVideoModelById } from "@/lib/ugc-video-studio/model-registry";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: UgcVideoRun["status"]): string {
  if (status === "RUNNING") return "Wird erstellt";
  if (status === "SUCCEEDED") return "Erfolgreich";
  if (status === "UNKNOWN_OUTCOME") return "Unbekannter Provider-Status";
  if (status === "PROVIDER_NOT_CONNECTED") return "Nicht verbunden";
  return "Fehlgeschlagen";
}

function setupLabel(setup: UgcVideoGenerationSetup): string {
  if (setup.modelId === "kling-v3-pro-motion-control") {
    return `${setup.klingMotion.characterOrientation === "VIDEO" ? "Bewegung folgen" : "Bild folgen"}${setup.klingMotion.keepOriginalSound ? " · Originalton" : ""}`;
  }
  return `${setup.duration}s · ${setup.aspectRatio} · ${setup.quality}`;
}

const PHASE_LABELS = {
  SUBMIT: "Auftrag übermitteln",
  STATUS: "Anbieterstatus prüfen",
  RESULT: "Ergebnis abrufen",
  RESULT_DOWNLOAD: "Ergebnis speichern",
} as const;

function readableProviderMessage(run: UgcVideoRun): string | null {
  const error = run.providerError;
  if (!error) return null;
  const evidence = `${error.providerCode ?? ""} ${error.providerMessage} ${error.providerBody ?? ""}`.toLowerCase();
  if (/moderation|safety|content policy|blocked/.test(evidence)) {
    return "Der Anbieter hat den Inhalt bei seiner Prüfung abgelehnt.";
  }
  if (/decode|invalid image|reference.*invalid|image.*invalid/.test(evidence)) {
    return "Mindestens eine Referenz konnte vom Anbieter nicht verarbeitet werden.";
  }
  if (/unsupported|not supported/.test(evidence)) {
    return "Mindestens eine Einstellung wird vom Anbieter nicht unterstützt.";
  }
  return error.providerMessage;
}

export function UgcProviderDetails({ run }: { run: UgcVideoRun }) {
  const error = run.providerError;
  if (!error) return null;
  return (
    <details className="uv-provider-details">
      <summary>Details</summary>
      <dl>
        <div><dt>Anbieter</dt><dd>{run.provider ?? "fal"}</dd></div>
        <div><dt>Modell</dt><dd>{ugcVideoModelById(run.setup.modelId)?.name ?? run.providerModel ?? run.setup.modelId}</dd></div>
        <div><dt>Phase</dt><dd>{PHASE_LABELS[error.phase]}</dd></div>
        {error.httpStatus ? <div><dt>HTTP</dt><dd>{error.httpStatus}</dd></div> : null}
        {error.providerCode ? <div><dt>Provider-Code</dt><dd>{error.providerCode}</dd></div> : null}
        <div><dt>Provider-Meldung</dt><dd>{readableProviderMessage(run)}</dd></div>
        {error.requestId ? <div><dt>Request ID</dt><dd>{error.requestId}</dd></div> : null}
      </dl>
      {error.providerBody ? <pre aria-label="Bereinigte Provider-Details">{error.providerBody}{error.truncated ? "\n… gekürzt" : ""}</pre> : null}
    </details>
  );
}

export function UgcPromptLibrary(props: {
  prompts: SavedUgcVideoPrompt[];
  onLoad: (prompt: SavedUgcVideoPrompt) => void;
  onEdit: (prompt: SavedUgcVideoPrompt) => void;
  onCopy: (prompt: SavedUgcVideoPrompt) => Promise<boolean>;
  onFavorite: (prompt: SavedUgcVideoPrompt) => void;
  onDelete: (promptId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    return props.prompts
      .filter((prompt) => !favoritesOnly || prompt.favorite)
      .filter((prompt) =>
        `${prompt.title} ${prompt.description} ${prompt.prompt} ${prompt.tags.join(" ")}`
          .toLocaleLowerCase("de")
          .includes(query),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [favoritesOnly, props.prompts, search]);
  return (
    <div className="uv-library-view">
      <header className="uv-view-heading"><div><span>Gespeicherte Setups</span><h1>Prompt-Bibliothek</h1><p>Gute UGC-Ideen speichern und ohne automatische Generierung erneut laden.</p></div></header>
      <div className="uv-library-tools">
        <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Prompts durchsuchen …" /></label>
        <button type="button" className={favoritesOnly ? "is-active" : ""} onClick={() => setFavoritesOnly((value) => !value)}><Heart size={15} /> Favoriten</button>
      </div>
      {copyFeedback ? <p className="uv-copy-feedback" role="status">{copyFeedback}</p> : null}
      {visible.length ? (
        <div className="uv-prompt-grid">
          {visible.map((prompt) => (
            <article className="uv-prompt-card" key={prompt.id}>
              <header><span>{UGC_VIDEO_TYPE_LABELS[prompt.videoType]}</span><button type="button" onClick={() => props.onFavorite(prompt)} aria-label={prompt.favorite ? "Favorit entfernen" : "Als Favorit markieren"}><Heart size={17} fill={prompt.favorite ? "currentColor" : "none"} /></button></header>
              <h2>{prompt.title}</h2>
              <p>{prompt.prompt || (prompt.mode === "VIDEO_EDIT" ? "Standardmäßige Personen-Ersetzung ohne zusätzliche Anweisung." : "Kein Prompt")}</p>
              <div className="uv-tags">{prompt.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <dl><div><dt>Modell</dt><dd>{ugcVideoModelById(prompt.modelId)?.name ?? prompt.modelId}</dd></div><div><dt>Setup</dt><dd>{setupLabel({ contractVersion: "nexhq-ugc-video-studio-v1", mode: prompt.mode, prompt: prompt.prompt, modelId: prompt.modelId, duration: prompt.duration, aspectRatio: prompt.aspectRatio, quality: prompt.quality, bitrate: prompt.bitrate, videoType: prompt.videoType, references: [], advanced: prompt.advanced, klingMotion: prompt.klingMotion, videoEdit: prompt.videoEdit })}</dd></div></dl>
              <small>Aktualisiert {formatDate(prompt.updatedAt)}</small>
              <footer>
                <button type="button" className="uv-button uv-button--primary" onClick={() => props.onLoad(prompt)} aria-label="Setup laden"><Play size={15} /> Laden</button>
                <button type="button" onClick={() => props.onEdit(prompt)} aria-label="Prompt bearbeiten"><Pencil size={15} /></button>
                <button type="button" onClick={() => { void props.onCopy(prompt).then((copied) => setCopyFeedback(copied ? "Prompt wurde kopiert." : "Prompt konnte nicht kopiert werden.")); }} aria-label="Prompt kopieren"><Clipboard size={15} /></button>
                <button type="button" onClick={() => props.onDelete(prompt.id)} aria-label="Prompt löschen"><Trash2 size={15} /></button>
              </footer>
            </article>
          ))}
        </div>
      ) : <div className="uv-empty"><Save size={25} /><h2>Noch keine passenden Prompts</h2><p>Speichere ein Setup direkt im Erstellen-Bereich.</p></div>}
    </div>
  );
}

export function UgcRunHistory(props: {
  runs: UgcVideoRun[];
  onLoadSetup: (setup: UgcVideoGenerationSetup) => void;
  onSavePrompt: (setup: UgcVideoGenerationSetup) => void;
  onOpen: (run: UgcVideoRun) => void;
}) {
  const runs = [...props.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="uv-library-view">
      <header className="uv-view-heading"><div><span>Letzte Aufträge</span><h1>Verlauf</h1><p>Setups wieder öffnen, ohne automatisch einen neuen kostenpflichtigen Lauf zu starten.</p></div></header>
      {runs.length ? (
        <div className="uv-history-list">
          {runs.map((run) => (
            <article className="uv-history-card" key={run.id}>
              <div className="uv-history-visual">{run.results[0] ? <video src={run.results[0].url} muted playsInline preload="metadata" /> : <Play size={22} />}</div>
              <div className="uv-history-body">
                <div><h2>{run.setup.prompt || (run.setup.mode === "VIDEO_EDIT" ? "Video bearbeiten" : "UGC Video")}</h2><span data-status={run.status}>{statusLabel(run.status)}</span></div>
                <p>{ugcVideoModelById(run.setup.modelId)?.name ?? run.setup.modelId} · {setupLabel(run.setup)}{run.setup.modelId === "seedance-2.5" ? ` · ${UGC_VIDEO_BITRATE_LABELS[run.setup.bitrate]}` : ""}</p>
                <small>{formatDate(run.createdAt)} · {run.setup.references.length} Referenzen{run.estimatedMaximumCostUsd != null ? ` · max. ${run.estimatedMaximumCostUsd.toFixed(2).replace(".", ",")} $` : ""}</small>
                {run.status === "FAILED" || run.status === "UNKNOWN_OUTCOME" ? <UgcProviderDetails run={run} /> : null}
              </div>
              <footer>
                {run.results.length ? <button type="button" className="uv-button uv-button--secondary" onClick={() => props.onOpen(run)}>Ergebnis öffnen</button> : null}
                <button type="button" className="uv-button uv-button--secondary" onClick={() => props.onLoadSetup(run.setup)}>Setup laden</button>
                <button type="button" onClick={() => props.onSavePrompt(run.setup)}><Save size={15} /> Prompt speichern</button>
              </footer>
            </article>
          ))}
        </div>
      ) : <div className="uv-empty"><Play size={25} /><h2>Noch keine Generierungen</h2><p>Dein erster UGC-Videoauftrag erscheint hier.</p></div>}
    </div>
  );
}
