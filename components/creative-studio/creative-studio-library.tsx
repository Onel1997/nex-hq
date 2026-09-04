"use client";

import Image from "next/image";
import {
  Bookmark,
  Clock3,
  Copy,
  Heart,
  History,
  Layers3,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  CREATIVE_OUTPUT_TYPE_LABELS,
  type CreativeGenerationSetup,
  type CreativeRun,
  type SavedCreativePrompt,
} from "@/lib/creative-studio/contracts";
import { creativeModelById } from "@/lib/creative-studio/model-registry";

type PromptFilter =
  | "ALL"
  | "FAVORITES"
  | "RECENT"
  | CreativeGenerationSetup["outputType"];

const PROMPT_FILTERS: Array<{ id: PromptFilter; label: string }> = [
  { id: "ALL", label: "Alle" },
  { id: "FAVORITES", label: "Favoriten" },
  { id: "RECENT", label: "Zuletzt verwendet" },
  { id: "MOCKUP", label: "Mockups" },
  { id: "SOCIAL_ASSET", label: "Assets" },
  { id: "CAMPAIGN", label: "Kampagne" },
  { id: "PRODUCT_IMAGE", label: "Produktbilder" },
];

function formatGermanDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function PromptLibrary(props: {
  prompts: SavedCreativePrompt[];
  onCreate: () => void;
  onLoad: (prompt: SavedCreativePrompt) => void;
  onToggleFavorite: (prompt: SavedCreativePrompt) => void;
  onCopy: (prompt: SavedCreativePrompt) => Promise<boolean>;
  onEdit: (prompt: SavedCreativePrompt) => void;
  onDelete: (promptId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PromptFilter>("ALL");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    return props.prompts
      .filter((prompt) => {
        if (filter === "FAVORITES" && !prompt.favorite) return false;
        if (
          filter !== "ALL" &&
          filter !== "FAVORITES" &&
          filter !== "RECENT" &&
          prompt.outputType !== filter
        ) {
          return false;
        }
        if (!query) return true;
        return [prompt.title, prompt.description, prompt.prompt, ...prompt.tags]
          .join(" ")
          .toLocaleLowerCase("de")
          .includes(query);
      })
      .sort((a, b) =>
        filter === "RECENT"
          ? (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")
          : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [filter, props.prompts, search]);

  return (
    <main className="cs-library-view">
      <div className="cs-view-heading">
        <div>
          <span className="cs-eyebrow">Deine besten Ideen</span>
          <h1>Prompt-Bibliothek</h1>
          <p>Finde bewährte Setups und lade sie mit einem Tipp zurück ins Studio.</p>
        </div>
        <button
          type="button"
          className="cs-button cs-button--primary cs-heading-action"
          onClick={props.onCreate}
        >
          <Plus size={17} /> Neuer Prompt
        </button>
      </div>
      <div className="cs-library-tools">
        <label className="cs-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Prompts durchsuchen …"
          />
        </label>
        <div className="cs-filter-row" aria-label="Prompt-Filter">
          {PROMPT_FILTERS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={filter === item.id ? "is-active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {copyFeedback ? <p className="cs-copy-feedback" role="status">{copyFeedback}</p> : null}
      {filtered.length ? (
        <div className="cs-prompt-grid">
          {filtered.map((prompt) => (
            <article className="cs-prompt-card" key={prompt.id}>
              <div className="cs-prompt-card__top">
                <span>{CREATIVE_OUTPUT_TYPE_LABELS[prompt.outputType]}</span>
                <button
                  type="button"
                  onClick={() => props.onToggleFavorite(prompt)}
                  aria-label={
                    prompt.favorite
                      ? "Aus Favoriten entfernen"
                      : "Zu Favoriten hinzufügen"
                  }
                >
                  <Heart
                    size={18}
                    fill={prompt.favorite ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <h3>{prompt.title}</h3>
              <p>{prompt.description || prompt.prompt}</p>
              <div className="cs-tag-row">
                {prompt.tags.slice(0, 4).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="cs-prompt-card__meta">
                <span>{creativeModelById(prompt.modelId)?.name ?? prompt.modelId}</span>
                <span>
                  {prompt.aspectRatio} · {prompt.quality} · {prompt.batchSize}×
                </span>
              </div>
              <div className="cs-prompt-card__actions">
                <button
                  type="button"
                  className="cs-button cs-button--secondary"
                  onClick={() => props.onLoad(prompt)}
                >
                  <RotateCcw size={15} /> Ins Studio laden
                </button>
                <div>
                  <button
                    type="button"
                    className="cs-icon-button"
                    onClick={() => props.onEdit(prompt)}
                    aria-label="Prompt bearbeiten"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="cs-icon-button"
                    onClick={() => {
                      void props.onCopy(prompt).then((copied) => {
                        setCopyFeedback(copied
                          ? "Prompt wurde kopiert."
                          : "Prompt konnte nicht kopiert werden.");
                      });
                    }}
                    aria-label="Prompt kopieren"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="cs-icon-button"
                    onClick={() => props.onDelete(prompt.id)}
                    aria-label="Prompt löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cs-empty-view">
          <span>
            <Bookmark size={25} />
          </span>
          <h2>Noch keine passenden Prompts</h2>
          <p>Speichere ein Setup oder passe Suche und Filter an.</p>
          <button
            type="button"
            className="cs-button cs-button--secondary"
            onClick={props.onCreate}
          >
            Zum Erstellen
          </button>
        </div>
      )}
    </main>
  );
}

export function RunHistory(props: {
  runs: CreativeRun[];
  onCreate: () => void;
  onLoad: (run: CreativeRun) => void;
  onSavePrompt: (run: CreativeRun) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "ALL" | "READY" | "FAILED" | "UNKNOWN" | "NOT_CONNECTED"
  >("ALL");
  const filteredRuns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    return props.runs.filter((run) => {
      if (
        status === "READY" &&
        run.status !== "SUCCEEDED" &&
        run.status !== "PARTIALLY_SUCCEEDED"
      ) return false;
      if (status === "FAILED" && run.status !== "FAILED") return false;
      if (status === "UNKNOWN" && run.status !== "UNKNOWN_OUTCOME") return false;
      if (status === "NOT_CONNECTED" && run.status !== "PROVIDER_NOT_CONNECTED") {
        return false;
      }
      if (!query) return true;
      const modelName = creativeModelById(run.setup.modelId)?.name ?? run.setup.modelId;
      return [run.setup.prompt, modelName, CREATIVE_OUTPUT_TYPE_LABELS[run.setup.outputType]]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(query);
    });
  }, [props.runs, search, status]);

  return (
    <main className="cs-library-view">
      <div className="cs-view-heading">
        <div>
          <span className="cs-eyebrow">Deine letzten Setups</span>
          <h1>Verlauf</h1>
          <p>Öffne frühere Ideen oder speichere daraus einen wiederverwendbaren Prompt.</p>
        </div>
        <button
          type="button"
          className="cs-button cs-button--primary cs-heading-action"
          onClick={props.onCreate}
        >
          <Plus size={17} /> Neues Bild
        </button>
      </div>
      <div className="cs-library-tools">
        <label className="cs-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Verlauf durchsuchen …"
          />
        </label>
        <div className="cs-filter-row" aria-label="Verlaufsfilter">
          {(
            [
              ["ALL", "Alle"],
              ["READY", "Mit Ergebnis"],
              ["FAILED", "Fehlgeschlagen"],
              ["UNKNOWN", "Unklar"],
              ["NOT_CONNECTED", "Nicht verbunden"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={status === id ? "is-active" : ""}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filteredRuns.length ? (
        <div className="cs-history-list">
          {filteredRuns.map((run) => {
            const model = creativeModelById(run.setup.modelId);
            const statusLabel =
              run.status === "SUCCEEDED"
                ? "Erfolgreich"
                : run.status === "PARTIALLY_SUCCEEDED"
                  ? "Teilweise erfolgreich"
                : run.status === "PROVIDER_NOT_CONNECTED"
                  ? "Modell nicht verbunden"
                  : run.status === "FAILED"
                    ? "Fehlgeschlagen"
                    : run.status === "UNKNOWN_OUTCOME"
                      ? "Unbekannter Provider-Status"
                    : run.status === "RUNNING"
                      ? "Wird erstellt"
                      : "Bereit";
            return (
              <article className="cs-history-card" key={run.id}>
                <div className="cs-history-card__visual">
                  {run.results[0] ? (
                    <Image
                      src={run.results[0].url}
                      alt="Generiertes Ergebnis"
                      fill
                      sizes="120px"
                      unoptimized
                    />
                  ) : (
                    <Layers3 size={24} />
                  )}
                </div>
                <div className="cs-history-card__body">
                  <div>
                    <span className={`cs-status cs-status--${run.status.toLowerCase()}`}>
                      {statusLabel}
                    </span>
                    <span className="cs-history-time">
                      <Clock3 size={13} /> {formatGermanDate(run.createdAt)}
                    </span>
                  </div>
                  <h3>{run.setup.prompt}</h3>
                  <p>
                    {model?.name ?? run.setup.modelId} · {run.setup.aspectRatio} ·{" "}
                    {run.setup.quality} · {run.setup.batchSize}{" "}
                    {run.setup.batchSize === 1 ? "Bild" : "Bilder"} ·{" "}
                    {run.setup.references.length}{" "}
                    {run.setup.references.length === 1 ? "Referenz" : "Referenzen"}
                    {run.estimatedMaximumCostUsd !== undefined &&
                    run.estimatedMaximumCostUsd !== null
                      ? ` · max. ${run.estimatedMaximumCostUsd.toLocaleString("de-DE", { style: "currency", currency: "USD" })}`
                      : ""}
                  </p>
                  {run.message ? <small>{run.message}</small> : null}
                </div>
                <div className="cs-history-card__actions">
                  <button
                    type="button"
                    className="cs-button cs-button--secondary"
                    onClick={() => props.onLoad(run)}
                  >
                    <RotateCcw size={15} /> Setup laden
                  </button>
                  <button
                    type="button"
                    className="cs-button cs-button--ghost"
                    onClick={() => props.onSavePrompt(run)}
                  >
                    <Bookmark size={15} /> Als Prompt speichern
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="cs-empty-view">
          <span>
            <History size={25} />
          </span>
          <h2>Noch keine passenden Einträge</h2>
          <p>Deine Creative-Studio-Läufe erscheinen hier – ohne Fake-Ergebnisse.</p>
          <button
            type="button"
            className="cs-button cs-button--secondary"
            onClick={props.onCreate}
          >
            Erstes Setup erstellen
          </button>
        </div>
      )}
    </main>
  );
}
