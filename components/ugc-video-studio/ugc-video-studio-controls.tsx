"use client";

import Image from "next/image";
import {
  Check,
  ChevronDown,
  FileAudio,
  Film,
  ImageIcon,
  Plus,
  Save,
  Search,
  Sparkles,
  UploadCloud,
  Video,
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
  UGC_VIDEO_ASPECT_RATIOS,
  UGC_VIDEO_BITRATES,
  UGC_VIDEO_BITRATE_LABELS,
  UGC_VIDEO_DURATIONS,
  UGC_VIDEO_QUALITIES,
  UGC_VIDEO_REFERENCE_ROLE_LABELS,
  UGC_VIDEO_REFERENCE_ROLES,
  type SavedUgcVideoPrompt,
  type UgcVideoGenerationSetup,
  type UgcVideoReferenceMedia,
  type UgcVideoReferenceRole,
  type UgcVideoKlingMotionSettings,
} from "@/lib/ugc-video-studio/contracts";
import {
  UGC_VIDEO_MODEL_REGISTRY,
  ugcVideoModelAvailabilityLabel,
  ugcVideoModelById,
  type UgcVideoModelDefinition,
} from "@/lib/ugc-video-studio/model-registry";
import { resolveUgcPopoverPosition } from "@/lib/ugc-video-studio/popover-position";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

type QuickPanel = "DURATION" | "ASPECT" | "QUALITY" | "BITRATE" | null;

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
    ReturnType<typeof resolveUgcPopoverPosition>
  >({
    placement: "below" as const,
    xOffset: 0,
    availableHeight: 320,
  });

  const updatePosition = useCallback(() => {
    const root = rootRef.current;
    const popover = popoverRef.current;
    if (!root || !popover) return;
    setPosition(
      resolveUgcPopoverPosition({
        anchor: root.getBoundingClientRect(),
        popover: popover.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
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
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowUp"
            ? current <= 0
              ? options.length - 1
              : current - 1
            : current < 0 || current === options.length - 1
              ? 0
              : current + 1;
    options[next]?.focus();
  };

  return (
    <div className="uv-popover-anchor" ref={rootRef}>
      {props.renderTrigger({
        controls: id,
        expanded: props.open,
        toggle: props.open ? props.onClose : props.onOpen,
        openFromKeyboard: () => {
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
          className={`uv-popover ${props.className ?? ""}`}
          style={
            {
              "--uv-popover-x": `${position.xOffset}px`,
              "--uv-popover-height": `${position.availableHeight}px`,
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

export function UgcPromptSaveDialog(props: {
  open: boolean;
  editing: SavedUgcVideoPrompt | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    tags: string[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  useEffect(() => {
    if (!props.open) return;
    setTitle(props.editing?.title ?? "");
    setDescription(props.editing?.description ?? "");
    setTags(props.editing?.tags.join(", ") ?? "");
  }, [props.editing, props.open]);
  if (!props.open) return null;
  return (
    <div className="uv-modal-backdrop" role="presentation" onPointerDown={props.onClose}>
      <section
        className="uv-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Prompt speichern"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><span>Prompt-Bibliothek</span><h2>Setup speichern</h2></div>
          <button type="button" onClick={props.onClose} aria-label="Schließen"><X size={18} /></button>
        </header>
        <label><span>Titel</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Natürliches Schlafzimmer-UGC" /></label>
        <label><span>Beschreibung <em>optional</em></span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Wofür eignet sich dieser Prompt?" /></label>
        <label><span>Tags <em>mit Komma trennen</em></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="UGC, TikTok, Fit Check" /></label>
        <footer>
          <button type="button" className="uv-button uv-button--ghost" onClick={props.onClose}>Abbrechen</button>
          <button
            type="button"
            className="uv-button uv-button--primary"
            disabled={!title.trim()}
            onClick={() => props.onSave({
              title: title.trim(),
              description: description.trim(),
              tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            })}
          ><Save size={16} /> Prompt speichern</button>
        </footer>
      </section>
    </div>
  );
}

function ReferencePreview(props: {
  reference: UgcVideoReferenceMedia;
  onDuration: (seconds: number) => void;
}) {
  if (props.reference.mediaType === "IMAGE") {
    return <Image src={props.reference.previewUrl} alt={props.reference.name} fill sizes="112px" unoptimized />;
  }
  if (props.reference.mediaType === "VIDEO") {
    return <video src={props.reference.previewUrl} muted playsInline preload="metadata" aria-label={props.reference.name} onLoadedMetadata={(event) => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) props.onDuration(seconds); }} />;
  }
  return <div className="uv-reference-audio"><FileAudio size={28} /><span>Audio</span></div>;
}

export function UgcReferenceUploader(props: {
  references: UgcVideoReferenceMedia[];
  effectiveLimit: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onRoleChange: (id: string, role: UgcVideoReferenceRole) => void;
  onDuration: (id: string, seconds: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptFiles = (files: File[]) =>
    props.onAdd(files.filter((file) => ACCEPTED_TYPES.has(file.type)));
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files));
  };
  return (
    <section className="uv-card uv-reference-card" aria-labelledby="uv-reference-title">
      <div className="uv-section-heading">
        <div><span>01</span><div><h2 id="uv-reference-title">Referenzen</h2><p>Bilder, Video oder Audio – dein Prompt bestimmt die Verwendung.</p></div></div>
        <div className="uv-reference-meta"><b>{props.references.length}/{props.effectiveLimit}</b>{props.references.length ? <button type="button" onClick={props.onClear}>Alle entfernen</button> : null}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm,video/x-m4v,audio/mpeg,audio/wav"
        multiple
        hidden
        onChange={(event) => {
          acceptFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {props.references.length ? (
        <div className="uv-reference-strip" aria-label="Ausgewählte Referenzen">
          {props.references.map((reference, index) => (
            <article className="uv-reference" key={reference.id}>
              <div className="uv-reference-preview">
                <ReferencePreview reference={reference} onDuration={(seconds) => props.onDuration(reference.id, seconds)} />
                <span className="uv-reference-order">{index + 1}</span>
                <span className="uv-reference-kind" aria-label={reference.mediaType}>
                  {reference.mediaType === "IMAGE" ? <ImageIcon size={12} /> : reference.mediaType === "VIDEO" ? <Video size={12} /> : <FileAudio size={12} />}
                </span>
                <button type="button" onClick={() => props.onRemove(reference.id)} aria-label={`${reference.name} entfernen`}><X size={14} /></button>
              </div>
              <p title={reference.name}>{reference.name}</p>
              <select
                aria-label={`Rolle für ${reference.name}`}
                value={reference.role}
                onChange={(event) => props.onRoleChange(reference.id, event.target.value as UgcVideoReferenceRole)}
              >
                {UGC_VIDEO_REFERENCE_ROLES.map((role) => <option value={role} key={role}>{UGC_VIDEO_REFERENCE_ROLE_LABELS[role]}</option>)}
              </select>
            </article>
          ))}
          {props.references.length < props.effectiveLimit ? (
            <button type="button" className="uv-reference-add" onClick={() => inputRef.current?.click()}><Plus size={21} /><span>Hinzufügen</span></button>
          ) : null}
        </div>
      ) : (
        <div
          className={`uv-dropzone${dragging ? " is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div><UploadCloud size={25} /></div>
          <strong>Referenzen hinzufügen</strong>
          <span>Bilder, Videos oder Audio auswählen</span>
          <button type="button" className="uv-button uv-button--secondary" onClick={() => inputRef.current?.click()}><Plus size={16} /> Dateien auswählen</button>
          <small>Bis zu 20 MB pro Setup in NexHQ V1</small>
        </div>
      )}
      <p className="uv-soft-note">Rollen sind optionale Hinweise. Referenzdateien werden nicht im Browser-Speicher abgelegt.</p>
    </section>
  );
}

export function UgcModelSelector(props: {
  modelId: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (modelId: string) => void;
  customerMode?: boolean;
}) {
  const [search, setSearch] = useState("");
  const model = ugcVideoModelById(props.modelId) ?? UGC_VIDEO_MODEL_REGISTRY[0]!;
  const models = UGC_VIDEO_MODEL_REGISTRY.filter((entry) =>
    `${entry.name} ${entry.description}`.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de")),
  );
  const close = () => { setSearch(""); props.onClose(); };
  return (
    <section className="uv-card uv-model-card">
      <div className="uv-section-heading uv-section-heading--compact"><div><span>04</span><div><h2>Modell</h2><p>Ein Modell pro Videoauftrag.</p></div></div></div>
      <AnchoredPopover
        open={props.open}
        onOpen={props.onOpen}
        onClose={close}
        label="Modell auswählen"
        className="uv-model-popover"
        renderTrigger={({ controls, expanded, toggle, openFromKeyboard }) => (
          <button type="button" className="uv-model-current" onClick={toggle} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); openFromKeyboard(); } }} aria-haspopup="dialog" aria-controls={controls} aria-expanded={expanded}>
            <span><Film size={19} /></span><span><strong>{model.name}</strong><small>{ugcVideoModelAvailabilityLabel(model.availability)}</small></span>{model.badge ? <em>{model.badge}</em> : null}<ChevronDown size={17} />
          </button>
        )}
      >
        <label className="uv-model-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Modelle durchsuchen …" /></label>
        <div className="uv-model-options" role="listbox" aria-label="Videomodelle">
          {models.map((entry) => {
            const customerUnavailable = Boolean(
              props.customerMode && entry.id !== "kling-v3-pro-motion-control",
            );
            return (
              <button type="button" role="option" aria-selected={entry.id === props.modelId} className={entry.id === props.modelId ? "is-selected" : ""} key={entry.id} disabled={customerUnavailable} onClick={() => { props.onChange(entry.id); close(); }}>
                <span><Sparkles size={16} /></span><span><strong>{entry.name}</strong><small>{customerUnavailable ? "Für Kunden noch nicht bepreist" : entry.description}</small></span>{entry.badge ? <em>{entry.badge}</em> : null}{entry.id === props.modelId ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      </AnchoredPopover>
      {model.id === "kling-v3-pro-motion-control" ? (
        <p className="uv-model-helper">
          Kling Motion Control benötigt ein Model-/Charakterbild und ein
          Bewegungs-Referenzvideo.
        </p>
      ) : null}
    </section>
  );
}

function QuickChoice(props: {
  panel: Exclude<QuickPanel, null>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  selected: string;
  values: readonly string[];
  supported: readonly string[];
  onSelect: (value: string) => void;
}) {
  const title = props.panel === "DURATION" ? "Dauer" : props.panel === "ASPECT" ? "Seitenverhältnis" : props.panel === "QUALITY" ? "Qualität" : "Bitrate";
  const display = props.panel === "DURATION" ? `${props.selected}s` : props.panel === "BITRATE" ? UGC_VIDEO_BITRATE_LABELS[props.selected as UgcVideoGenerationSetup["bitrate"]] : props.selected === "AUTO" ? "Auto" : props.selected;
  return (
    <AnchoredPopover
      open={props.open}
      onOpen={props.onOpen}
      onClose={props.onClose}
      label={`${title} auswählen`}
      className={`uv-choice-popover uv-choice-popover--${props.panel.toLowerCase()}`}
      renderTrigger={({ controls, expanded, toggle, openFromKeyboard }) => (
        <button type="button" onClick={toggle} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); openFromKeyboard(); } }} aria-haspopup="dialog" aria-controls={controls} aria-expanded={expanded}><span>{title}</span><strong>{display}</strong><ChevronDown size={14} /></button>
      )}
    >
      <div className={`uv-choice-grid uv-choice-grid--${props.panel.toLowerCase()}`} role="listbox" aria-label={title}>
        {props.values.map((value) => {
          const disabled = !props.supported.includes(value);
          const label = props.panel === "DURATION" ? `${value}s` : props.panel === "BITRATE" ? UGC_VIDEO_BITRATE_LABELS[value as UgcVideoGenerationSetup["bitrate"]] : value === "AUTO" ? "Auto" : value;
          return <button type="button" role="option" aria-selected={props.selected === value} disabled={disabled} className={props.selected === value ? "is-selected" : ""} key={value} onClick={() => { props.onSelect(value); props.onClose(); }}><span>{label}</span>{props.selected === value ? <Check size={13} /> : null}{disabled ? <small>Nicht unterstützt</small> : null}</button>;
        })}
      </div>
    </AnchoredPopover>
  );
}

export function UgcQuickControls(props: {
  setup: Pick<UgcVideoGenerationSetup, "duration" | "aspectRatio" | "quality" | "bitrate">;
  model: UgcVideoModelDefinition;
  onDuration: (value: UgcVideoGenerationSetup["duration"]) => void;
  onAspectRatio: (value: UgcVideoGenerationSetup["aspectRatio"]) => void;
  onQuality: (value: UgcVideoGenerationSetup["quality"]) => void;
  onBitrate: (value: UgcVideoGenerationSetup["bitrate"]) => void;
}) {
  const [open, setOpen] = useState<QuickPanel>(null);
  return (
    <div className="uv-quick-controls">
      <QuickChoice panel="DURATION" open={open === "DURATION"} onOpen={() => setOpen("DURATION")} onClose={() => setOpen(null)} selected={props.setup.duration} values={UGC_VIDEO_DURATIONS} supported={props.model.supportedDurations} onSelect={(value) => props.onDuration(value as UgcVideoGenerationSetup["duration"])} />
      <QuickChoice panel="ASPECT" open={open === "ASPECT"} onOpen={() => setOpen("ASPECT")} onClose={() => setOpen(null)} selected={props.setup.aspectRatio} values={UGC_VIDEO_ASPECT_RATIOS} supported={props.model.supportedAspectRatios} onSelect={(value) => props.onAspectRatio(value as UgcVideoGenerationSetup["aspectRatio"])} />
      <QuickChoice panel="QUALITY" open={open === "QUALITY"} onOpen={() => setOpen("QUALITY")} onClose={() => setOpen(null)} selected={props.setup.quality} values={UGC_VIDEO_QUALITIES} supported={props.model.supportedQualities} onSelect={(value) => props.onQuality(value as UgcVideoGenerationSetup["quality"])} />
      <QuickChoice panel="BITRATE" open={open === "BITRATE"} onOpen={() => setOpen("BITRATE")} onClose={() => setOpen(null)} selected={props.setup.bitrate} values={UGC_VIDEO_BITRATES} supported={props.model.supportedBitrates} onSelect={(value) => props.onBitrate(value as UgcVideoGenerationSetup["bitrate"])} />
    </div>
  );
}

function referenceOptionLabel(reference: UgcVideoReferenceMedia): string {
  const role = UGC_VIDEO_REFERENCE_ROLE_LABELS[reference.role];
  return `${reference.order + 1}. ${reference.name}${reference.role === "NONE" ? "" : ` · ${role}`}`;
}

export function UgcKlingMotionControls(props: {
  references: UgcVideoReferenceMedia[];
  settings: UgcVideoKlingMotionSettings;
  onChange: (settings: UgcVideoKlingMotionSettings) => void;
}) {
  const images = props.references.filter(
    (reference) => reference.mediaType === "IMAGE",
  );
  const videos = props.references.filter(
    (reference) => reference.mediaType === "VIDEO",
  );
  const selectedCharacter =
    props.settings.characterImageReferenceId ??
    (images.length === 1 ? images[0]!.id : "");
  const faceCandidates = images.filter(
    (reference) =>
      reference.id !== selectedCharacter &&
      (reference.role === "FACE" || reference.role === "IDENTITY"),
  );
  const faceAvailable = faceCandidates.length > 0;

  return (
    <div className="uv-kling-settings">
      <div className="uv-kling-helper">
        <strong>Bild + Bewegung</strong>
        <span>
          Kling Motion Control benötigt ein Model-/Charakterbild und ein
          Bewegungs-Referenzvideo.
        </span>
      </div>
      <fieldset className="uv-orientation-choice">
        <legend>Ausrichtung</legend>
        <button
          type="button"
          className={
            props.settings.characterOrientation === "IMAGE" ? "is-active" : ""
          }
          onClick={() =>
            props.onChange({
              ...props.settings,
              characterOrientation: "IMAGE",
              faceBindingEnabled: false,
            })
          }
        >
          <strong>Bild folgen</strong>
          <span>Hält Pose und Ausrichtung näher am Modelbild.</span>
        </button>
        <button
          type="button"
          className={
            props.settings.characterOrientation === "VIDEO" ? "is-active" : ""
          }
          onClick={() =>
            props.onChange({
              ...props.settings,
              characterOrientation: "VIDEO",
              faceBindingEnabled: faceAvailable
                ? props.settings.faceBindingEnabled
                : false,
            })
          }
        >
          <strong>Bewegung folgen</strong>
          <span>
            Folgt stärker der Bewegung und erlaubt zusätzliche Gesichtsbindung.
          </span>
        </button>
      </fieldset>
      <div className="uv-kling-reference-mapping">
        <label>
          <span>Model-/Charakterbild</span>
          <select
            value={props.settings.characterImageReferenceId ?? ""}
            onChange={(event) =>
              props.onChange({
                ...props.settings,
                characterImageReferenceId: event.target.value || null,
                identityElementReferenceId:
                  event.target.value === props.settings.identityElementReferenceId
                    ? null
                    : props.settings.identityElementReferenceId,
              })
            }
          >
            <option value="">
              {images.length === 1 ? "Automatisch zugeordnet" : "Bitte auswählen"}
            </option>
            {images.map((reference) => (
              <option key={reference.id} value={reference.id}>
                {referenceOptionLabel(reference)}
              </option>
            ))}
          </select>
          <small>Nutze ein klares Modelbild mit gut sichtbarem Gesicht und Körper.</small>
        </label>
        <label>
          <span>Bewegungs-Referenzvideo</span>
          <select
            value={props.settings.motionVideoReferenceId ?? ""}
            onChange={(event) =>
              props.onChange({
                ...props.settings,
                motionVideoReferenceId: event.target.value || null,
              })
            }
          >
            <option value="">
              {videos.length === 1 ? "Automatisch zugeordnet" : "Bitte auswählen"}
            </option>
            {videos.map((reference) => (
              <option key={reference.id} value={reference.id}>
                {referenceOptionLabel(reference)}
              </option>
            ))}
          </select>
          <small>
            Oberkörper oder Ganzkörper sollte im Referenzvideo gut sichtbar sein.
          </small>
        </label>
      </div>
      <label className="uv-check uv-kling-toggle">
        <input
          type="checkbox"
          checked={props.settings.keepOriginalSound}
          onChange={(event) =>
            props.onChange({
              ...props.settings,
              keepOriginalSound: event.target.checked,
            })
          }
        />
        <span>
          <strong>Originalton übernehmen</strong>
          <small>Verwendet den Ton des Bewegungs-Referenzvideos.</small>
        </span>
      </label>
      <label className="uv-check uv-kling-toggle">
        <input
          type="checkbox"
          checked={
            props.settings.characterOrientation === "VIDEO" &&
            props.settings.faceBindingEnabled &&
            faceAvailable
          }
          disabled={
            props.settings.characterOrientation !== "VIDEO" || !faceAvailable
          }
          onChange={(event) =>
            props.onChange({
              ...props.settings,
              faceBindingEnabled: event.target.checked,
            })
          }
        />
        <span>
          <strong>Gesicht stärker beibehalten</strong>
          <small>
            Verwendet eine zusätzliche Identitätsreferenz für stabilere Gesichtszüge.
          </small>
        </span>
      </label>
      {props.settings.characterOrientation === "VIDEO" && faceAvailable ? (
        <label className="uv-kling-face-select">
          <span>Zusätzliche Gesichtsreferenz</span>
          <select
            value={props.settings.identityElementReferenceId ?? ""}
            onChange={(event) =>
              props.onChange({
                ...props.settings,
                identityElementReferenceId: event.target.value || null,
              })
            }
          >
            <option value="">
              {faceCandidates.length === 1
                ? "Automatisch zugeordnet"
                : "Bitte auswählen"}
            </option>
            {faceCandidates.map((reference) => (
              <option key={reference.id} value={reference.id}>
                {referenceOptionLabel(reference)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="uv-kling-duration-note">
        {props.settings.characterOrientation === "IMAGE"
          ? "Bild folgen: Das Referenzvideo darf maximal 10 Sekunden lang sein."
          : "Bewegung folgen: Das Referenzvideo darf maximal 30 Sekunden lang sein."}
      </p>
    </div>
  );
}

export function UgcAdvancedPanel(props: {
  open: boolean;
  advanced: UgcVideoGenerationSetup["advanced"];
  onToggle: () => void;
  onChange: (advanced: UgcVideoGenerationSetup["advanced"]) => void;
}) {
  return (
    <section className="uv-card uv-advanced-card">
      <button type="button" className="uv-advanced-toggle" onClick={props.onToggle} aria-expanded={props.open}><span><strong>Erweitert</strong><small>Audio, Seed und negativer Prompt</small></span><ChevronDown size={17} /></button>
      {props.open ? (
        <div className="uv-advanced-body">
          <label className="uv-check"><input type="checkbox" checked={props.advanced.generateAudio} onChange={(event) => props.onChange({ ...props.advanced, generateAudio: event.target.checked })} /><span>Synchronisiertes Audio erzeugen</span></label>
          <label><span>Seed <em>optional</em></span><input inputMode="numeric" value={props.advanced.seed ?? ""} onChange={(event) => props.onChange({ ...props.advanced, seed: event.target.value ? Math.max(0, Number.parseInt(event.target.value, 10) || 0) : null })} placeholder="Automatisch" /></label>
          <label><span>Negativer Prompt <em>optional</em></span><textarea rows={3} value={props.advanced.negativePrompt} onChange={(event) => props.onChange({ ...props.advanced, negativePrompt: event.target.value })} placeholder="Was soll nach Möglichkeit nicht erscheinen?" /></label>
        </div>
      ) : null}
    </section>
  );
}
