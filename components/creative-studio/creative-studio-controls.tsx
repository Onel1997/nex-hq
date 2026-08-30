"use client";

import Image from "next/image";
import {
  Check,
  ChevronDown,
  ImagePlus,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  CREATIVE_ASPECT_RATIOS,
  CREATIVE_BATCH_SIZES,
  CREATIVE_QUALITIES,
  CREATIVE_REFERENCE_ROLE_LABELS,
  CREATIVE_REFERENCE_ROLES,
  type CreativeGenerationSetup,
  type CreativeReferenceImage,
  type CreativeReferenceRole,
  type CreativeReferenceSnapshotEntry,
} from "@/lib/creative-studio/contracts";
import {
  CREATIVE_MODEL_REGISTRY,
  creativeModelAvailabilityLabel,
  creativeModelById,
  type CreativeModelDefinition,
} from "@/lib/creative-studio/model-registry";
import { resolveCreativePopoverPosition } from "@/lib/creative-studio/popover-position";

type QuickPanel = "ASPECT" | "QUALITY" | "BATCH" | null;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);
function ModalFrame(props: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label: string;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [props]);

  return (
    <div
      className="cs-modal-backdrop"
      role="presentation"
      onMouseDown={props.onClose}
    >
      <section
        className={`cs-modal ${props.className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {props.children}
      </section>
    </div>
  );
}

function AnchoredPopover(props: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  label: string;
  className?: string;
  renderTrigger: (input: {
    controls: string;
    expanded: boolean;
    toggle: () => void;
    openFromKeyboard: () => void;
  }) => ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusFirstOptionRef = useRef(false);
  const [position, setPosition] = useState<
    ReturnType<typeof resolveCreativePopoverPosition>
  >({
    placement: "below",
    xOffset: 0,
    availableHeight: 320,
  });

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    const popover = popoverRef.current;
    if (!root || !popover) return;
    const next = resolveCreativePopoverPosition({
      anchor: root.getBoundingClientRect(),
      popover: popover.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setPosition(next);
  }, []);

  useLayoutEffect(() => {
    if (!props.open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      if (focusFirstOptionRef.current) {
        focusFirstOptionRef.current = false;
        popoverRef.current
          ?.querySelector<HTMLElement>('[role="option"]:not([disabled])')
          ?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.open, updatePosition]);

  useEffect(() => {
    if (!props.open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) props.onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    const reposition = (event: Event) => {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      updatePosition();
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [props, updatePosition]);

  const moveOptionFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="option"]:not([disabled])',
      ),
    );
    if (!options.length) return;
    event.preventDefault();
    const currentIndex = options.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowUp"
            ? currentIndex <= 0
              ? options.length - 1
              : currentIndex - 1
            : currentIndex < 0 || currentIndex === options.length - 1
              ? 0
              : currentIndex + 1;
    options[nextIndex]?.focus();
  };

  return (
    <div className="cs-popover-anchor" ref={rootRef}>
      {props.renderTrigger({
        controls: id,
        expanded: props.open,
        toggle: props.open ? props.onClose : props.onOpen,
        openFromKeyboard: () => {
          if (props.open) {
            popoverRef.current
              ?.querySelector<HTMLElement>('[role="option"]:not([disabled])')
              ?.focus();
            return;
          }
          focusFirstOptionRef.current = true;
          props.onOpen();
        },
      })}
      {props.open ? (
        <div
          id={id}
          ref={popoverRef}
          role="dialog"
          aria-label={props.label}
          data-placement={position.placement}
          className={`cs-anchored-popover ${props.className ?? ""}`}
          style={
            {
              "--cs-popover-x": `${position.xOffset}px`,
              "--cs-popover-available-height": `${position.availableHeight}px`,
            } as CSSProperties
          }
          onKeyDown={moveOptionFocus}
        >
          {props.children}
        </div>
      ) : null}
    </div>
  );
}

export function PromptSaveDialog(props: {
  open: boolean;
  initialTitle: string;
  initialDescription: string;
  initialTags: string[];
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    tags: string[];
  }) => void;
}) {
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [tags, setTags] = useState(props.initialTags.join(", "));

  useEffect(() => {
    if (!props.open) return;
    setTitle(props.initialTitle);
    setDescription(props.initialDescription);
    setTags(props.initialTags.join(", "));
  }, [
    props.initialDescription,
    props.initialTags,
    props.initialTitle,
    props.open,
  ]);

  if (!props.open) return null;
  return (
    <ModalFrame onClose={props.onClose} label="Prompt speichern">
      <div className="cs-modal__header">
        <div>
          <span className="cs-eyebrow">Prompt-Bibliothek</span>
          <h2>Aktuelles Setup speichern</h2>
        </div>
        <button
          type="button"
          className="cs-icon-button"
          onClick={props.onClose}
          aria-label="Schließen"
        >
          <X size={18} />
        </button>
      </div>
      <label className="cs-field">
        <span>Titel</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="z. B. Parkhaus Streetwear Hero"
          autoFocus
        />
      </label>
      <label className="cs-field">
        <span>
          Beschreibung <em>optional</em>
        </span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Wofür eignet sich dieser Prompt besonders?"
          rows={3}
        />
      </label>
      <label className="cs-field">
        <span>
          Tags <em>mit Komma trennen</em>
        </span>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Streetwear, Instagram, Milaene"
        />
      </label>
      <div className="cs-modal__actions">
        <button
          type="button"
          className="cs-button cs-button--ghost"
          onClick={props.onClose}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className="cs-button cs-button--primary"
          disabled={!title.trim()}
          onClick={() =>
            props.onSave({
              title: title.trim(),
              description: description.trim(),
              tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        >
          <Save size={17} /> Prompt speichern
        </button>
      </div>
    </ModalFrame>
  );
}

export function ReferenceUploader(props: {
  references: CreativeReferenceImage[];
  missingReferences: CreativeReferenceSnapshotEntry[];
  effectiveLimit: number;
  modelName: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRestoreMissing: (referenceId: string, file: File) => void;
  onDismissMissing: (referenceId: string) => void;
  onRoleChange: (id: string, role: CreativeReferenceRole) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const recoveryReferenceIdRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const overModelLimit = props.references.length > props.effectiveLimit;
  const displayedReferences = [
    ...props.references.map((reference) => ({
      kind: "RESTORED" as const,
      order: reference.order,
      reference,
    })),
    ...props.missingReferences.map((reference) => ({
      kind: "MISSING" as const,
      order: reference.order,
      reference,
    })),
  ].sort((a, b) => a.order - b.order);

  const acceptFiles = (files: File[]) =>
    props.onAdd(files.filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type)));

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <section
      className="cs-card cs-reference-card"
      aria-labelledby="cs-references-title"
    >
      <div className="cs-section-heading">
        <div>
          <span className="cs-step">01</span>
          <div>
            <h2 id="cs-references-title">Referenzbilder</h2>
            <p>Design, Model, Produkt oder Stil – du entscheidest per Prompt.</p>
          </div>
        </div>
        <div className="cs-reference-meta">
          <span className={overModelLimit ? "is-warning" : ""}>
            {props.references.length}/{props.effectiveLimit}
          </span>
          {displayedReferences.length ? (
            <button type="button" onClick={props.onClear}>
              Alle entfernen
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        hidden
        onChange={(event) => {
          acceptFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={recoveryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          const referenceId = recoveryReferenceIdRef.current;
          if (file && referenceId && ACCEPTED_IMAGE_TYPES.has(file.type)) {
            props.onRestoreMissing(referenceId, file);
          }
          recoveryReferenceIdRef.current = null;
          event.currentTarget.value = "";
        }}
      />

      {displayedReferences.length ? (
        <div className="cs-reference-strip" aria-label="Hochgeladene Referenzen">
          {displayedReferences.map((item) => {
            if (item.kind === "MISSING") {
              const reference = item.reference;
              return (
                <article
                  className="cs-reference cs-reference--missing"
                  key={`missing-${reference.referenceId}`}
                >
                  <div className="cs-reference__image">
                    <ImagePlus size={25} />
                    <span className="cs-reference__order">
                      {reference.order + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => props.onDismissMissing(reference.referenceId)}
                      aria-label={`${reference.filename} aus dem Setup entfernen`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p title={reference.filename}>{reference.filename}</p>
                  <small>
                    {reference.source.kind === "LOCAL_FILE_REFERENCE"
                      ? "Diese lokale Referenz musst du erneut hinzufügen."
                      : "Gespeicherte Referenz gerade nicht verfügbar."}
                  </small>
                  <button
                    type="button"
                    className="cs-reference-restore"
                    onClick={() => {
                      recoveryReferenceIdRef.current = reference.referenceId;
                      recoveryInputRef.current?.click();
                    }}
                  >
                    Erneut hinzufügen
                  </button>
                </article>
              );
            }
            const reference = item.reference;
            return (
              <article className="cs-reference" key={reference.id}>
                <div className="cs-reference__image">
                  <Image
                    src={reference.previewUrl}
                    alt={reference.name}
                    fill
                    sizes="132px"
                    unoptimized
                  />
                  <span className="cs-reference__order">{reference.order + 1}</span>
                  <button
                    type="button"
                    onClick={() => props.onRemove(reference.id)}
                    aria-label={`${reference.name} entfernen`}
                  >
                    <X size={15} />
                  </button>
                </div>
                <p title={reference.name}>{reference.name}</p>
                <label>
                  <span className="sr-only">Rolle für {reference.name}</span>
                  <select
                    value={reference.role}
                    onChange={(event) =>
                      props.onRoleChange(
                        reference.id,
                        event.target.value as CreativeReferenceRole,
                      )
                    }
                  >
                    {CREATIVE_REFERENCE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {CREATIVE_REFERENCE_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
          {props.references.length < props.effectiveLimit ? (
            <button
              type="button"
              className="cs-reference-add"
              onClick={() => inputRef.current?.click()}
            >
              <Plus size={22} />
              <span>Hinzufügen</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={`cs-dropzone${dragging ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="cs-dropzone__icon">
            <UploadCloud size={27} />
          </div>
          <strong>Referenzen hinzufügen</strong>
          <span>Hier ablegen oder direkt vom Gerät auswählen</span>
          <button
            type="button"
            className="cs-button cs-button--secondary"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={17} /> Bilder auswählen
          </button>
          <small>
            PNG, JPG, WebP oder AVIF · {props.modelName}: bis zu{" "}
            {props.effectiveLimit}
          </small>
        </div>
      )}
      <p className={`cs-soft-note${overModelLimit ? " is-warning" : ""}`}>
        {overModelLimit
          ? `Für ${props.modelName} sind höchstens ${props.effectiveLimit} Referenzen vorgesehen. Entferne ${props.references.length - props.effectiveLimit}, bevor du generierst.`
          : "Rollen sind optional. Dein Prompt bestimmt, wie die Bilder zusammenwirken."}
      </p>
    </section>
  );
}

export function ModelSelector(props: {
  modelId: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (modelId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const model = creativeModelById(props.modelId) ?? CREATIVE_MODEL_REGISTRY[0]!;
  const filteredModels = CREATIVE_MODEL_REGISTRY.filter((item) =>
    [item.name, item.description, item.character]
      .join(" ")
      .toLocaleLowerCase("de")
      .includes(search.trim().toLocaleLowerCase("de")),
  );
  const close = () => {
    setSearch("");
    props.onClose();
  };

  return (
    <section className="cs-card cs-model-card">
      <div className="cs-section-heading cs-section-heading--compact">
        <div>
          <span className="cs-step">03</span>
          <div>
            <h2>Modell</h2>
            <p>Wähle den Bildcharakter für diesen Lauf.</p>
          </div>
        </div>
      </div>
      <AnchoredPopover
        open={props.open}
        onOpen={props.onOpen}
        onClose={close}
        label="Modell auswählen"
        className="cs-model-popover"
        renderTrigger={({ controls, expanded, toggle, openFromKeyboard }) => (
          <button
            type="button"
            className="cs-model-current"
            onClick={toggle}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                openFromKeyboard();
              }
            }}
            aria-haspopup="dialog"
            aria-controls={controls}
            aria-expanded={expanded}
          >
            <span
              className={`cs-model-mark cs-model-mark--${model.accent.toLowerCase()}`}
            >
              <WandSparkles size={20} />
            </span>
            <span>
              <strong>{model.name}</strong>
              <small>
                {model.character} ·{" "}
                {creativeModelAvailabilityLabel(model.availability)}
              </small>
            </span>
            {model.badge ? <em>{model.badge}</em> : null}
            <ChevronDown size={18} />
          </button>
        )}
      >
        <label className="cs-search cs-model-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Modelle durchsuchen …"
          />
        </label>
        <div className="cs-model-options" role="listbox" aria-label="Modelle">
          {filteredModels.map((item) => (
            <button
              type="button"
              role="option"
              aria-selected={item.id === props.modelId}
              key={item.id}
              className={item.id === props.modelId ? "is-selected" : ""}
              onClick={() => {
                props.onChange(item.id);
                close();
              }}
            >
              <span
                className={`cs-model-mark cs-model-mark--${item.accent.toLowerCase()}`}
              >
                <Sparkles size={17} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.character} ·{" "}
                  {creativeModelAvailabilityLabel(item.availability)}
                </small>
              </span>
              {item.badge ? <em>{item.badge}</em> : null}
              <span className="cs-model-check">
                {item.id === props.modelId ? <Check size={15} /> : null}
              </span>
            </button>
          ))}
          {!filteredModels.length ? (
            <div className="cs-mini-empty">Kein passendes Modell gefunden.</div>
          ) : null}
        </div>
      </AnchoredPopover>
    </section>
  );
}

function QuickChoicePopover(props: {
  panel: Exclude<QuickPanel, null>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  selected: string | number;
  values: readonly (string | number)[];
  supportedQualities?: CreativeModelDefinition["supportedQualities"];
  onSelect: (value: string | number) => void;
}) {
  const title =
    props.panel === "ASPECT"
      ? "Seitenverhältnis"
      : props.panel === "QUALITY"
        ? "Qualität"
        : "Anzahl";
  return (
    <AnchoredPopover
      open={props.open}
      onOpen={props.onOpen}
      onClose={props.onClose}
      label={`${title} auswählen`}
      className={`cs-choice-popover cs-choice-popover--${props.panel.toLowerCase()}`}
      renderTrigger={({ controls, expanded, toggle, openFromKeyboard }) => (
        <button
          type="button"
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              openFromKeyboard();
            }
          }}
          aria-haspopup="dialog"
          aria-controls={controls}
          aria-expanded={expanded}
        >
          <span>{title}</span>
          <strong>{props.selected === "AUTO" ? "Auto" : props.selected}</strong>
          <ChevronDown size={15} />
        </button>
      )}
    >
      <div
        className={`cs-choice-grid cs-choice-grid--${props.panel.toLowerCase()}`}
        role="listbox"
        aria-label={title}
      >
        {props.values.map((value) => {
          const disabled =
            props.panel === "QUALITY" &&
            !props.supportedQualities?.includes(
              value as CreativeGenerationSetup["quality"],
            );
          return (
            <button
              type="button"
              role="option"
              aria-selected={props.selected === value}
              key={value}
              className={props.selected === value ? "is-selected" : ""}
              disabled={disabled}
              onClick={() => {
                props.onSelect(value);
                props.onClose();
              }}
            >
              <span>{value === "AUTO" ? "Auto" : value}</span>
              {props.selected === value ? <Check size={14} /> : null}
              {disabled ? <small>Nicht unterstützt</small> : null}
            </button>
          );
        })}
      </div>
    </AnchoredPopover>
  );
}

export function QuickControlButtons(props: {
  aspectRatio: CreativeGenerationSetup["aspectRatio"];
  quality: CreativeGenerationSetup["quality"];
  batchSize: CreativeGenerationSetup["batchSize"];
  supportedQualities: CreativeModelDefinition["supportedQualities"];
  onAspectRatio: (value: CreativeGenerationSetup["aspectRatio"]) => void;
  onQuality: (value: CreativeGenerationSetup["quality"]) => void;
  onBatchSize: (value: CreativeGenerationSetup["batchSize"]) => void;
  compact?: boolean;
}) {
  const [openPanel, setOpenPanel] = useState<QuickPanel>(null);
  return (
    <div
      className={props.compact ? "cs-quick-controls is-compact" : "cs-quick-controls"}
    >
      <QuickChoicePopover
        panel="ASPECT"
        open={openPanel === "ASPECT"}
        onOpen={() => setOpenPanel("ASPECT")}
        onClose={() => setOpenPanel(null)}
        selected={props.aspectRatio}
        values={CREATIVE_ASPECT_RATIOS}
        onSelect={(value) =>
          props.onAspectRatio(value as CreativeGenerationSetup["aspectRatio"])
        }
      />
      <QuickChoicePopover
        panel="QUALITY"
        open={openPanel === "QUALITY"}
        onOpen={() => setOpenPanel("QUALITY")}
        onClose={() => setOpenPanel(null)}
        selected={props.quality}
        values={CREATIVE_QUALITIES}
        supportedQualities={props.supportedQualities}
        onSelect={(value) =>
          props.onQuality(value as CreativeGenerationSetup["quality"])
        }
      />
      <QuickChoicePopover
        panel="BATCH"
        open={openPanel === "BATCH"}
        onOpen={() => setOpenPanel("BATCH")}
        onClose={() => setOpenPanel(null)}
        selected={props.batchSize}
        values={CREATIVE_BATCH_SIZES}
        onSelect={(value) =>
          props.onBatchSize(value as CreativeGenerationSetup["batchSize"])
        }
      />
    </div>
  );
}

export function AdvancedPanel(props: {
  open: boolean;
  advanced: CreativeGenerationSetup["advanced"];
  onToggle: () => void;
  onChange: (advanced: CreativeGenerationSetup["advanced"]) => void;
}) {
  const fields = [
    ["identityStrength", "Identitätsstärke"],
    ["referenceStrength", "Referenzstärke"],
    ["styleStrength", "Stil-Stärke"],
    ["productFidelity", "Produkttreue"],
    ["designFidelity", "Designtreue"],
    ["realism", "Realismus-Stufe"],
  ] as const;

  return (
    <section className="cs-card cs-advanced-card">
      <button
        type="button"
        className="cs-advanced-toggle"
        onClick={props.onToggle}
        aria-expanded={props.open}
      >
        <span>
          <SlidersHorizontal size={18} />
          <strong>Erweitert</strong>
          <small>Optionale Feinsteuerung</small>
        </span>
        <ChevronDown size={18} className={props.open ? "is-open" : ""} />
      </button>
      {props.open ? (
        <div className="cs-advanced-body">
          <div className="cs-range-grid">
            {fields.map(([key, label]) => (
              <label className="cs-range" key={key}>
                <span>
                  {label}
                  <em>{Math.round(props.advanced[key] * 100)}%</em>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={props.advanced[key] * 100}
                  onChange={(event) =>
                    props.onChange({
                      ...props.advanced,
                      [key]: Number(event.target.value) / 100,
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="cs-advanced-text">
            <label className="cs-field">
              <span>Negativer Prompt</span>
              <textarea
                rows={3}
                value={props.advanced.negativePrompt}
                onChange={(event) =>
                  props.onChange({
                    ...props.advanced,
                    negativePrompt: event.target.value,
                  })
                }
                placeholder="Was soll nicht im Bild erscheinen?"
              />
            </label>
            <label className="cs-field">
              <span>
                Seed <em>optional</em>
              </span>
              <input
                inputMode="numeric"
                value={props.advanced.seed ?? ""}
                onChange={(event) =>
                  props.onChange({
                    ...props.advanced,
                    seed: event.target.value
                      ? Math.max(0, Number.parseInt(event.target.value, 10) || 0)
                      : null,
                  })
                }
                placeholder="Automatisch"
              />
            </label>
          </div>
        </div>
      ) : null}
    </section>
  );
}
