"use client";
/* eslint-disable @next/next/no-img-element -- short-lived private Image previews are dynamic */
/* eslint-disable @typescript-eslint/no-explicit-any -- API view payloads deliberately omit private schema fields */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Film,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  StudioHeader,
  StudioStepper,
  TechnicalDetails,
} from "@/components/studio/studio-ui";
import {
  formatArtworkSelectorLabel,
  resolveArtworkDisplayName,
} from "@/lib/design/artwork-display-name";
import { splitVideoRuns } from "@/lib/video/run-recovery";
const TYPES = [
  [
    "PRODUCT_MODEL",
    "Produktvideo",
    "Model und Produkt kontrolliert in Bewegung.",
  ],
  ["CAMPAIGN", "Kampagnenvideo", "Cineastische Markeninszenierung."],
  ["SOCIAL", "Social / Reel", "Kurzes mobiles Hochformat."],
  [
    "PRODUCT_DETAIL",
    "Produktdetail",
    "Material, Print und Konstruktion im Fokus.",
  ],
  ["ECOMMERCE", "E-Commerce", "Ruhige, produktorientierte Darstellung."],
] as const;
const MOVES = [
  ["SUBTLE", "Still stehen / subtil"],
  ["SLOW_WALK", "Langsam gehen"],
  ["WALK_TOWARD_CAMERA", "Auf Kamera zugehen"],
  ["FULL_TURN", "Drehen"],
  ["SHOW_PRODUCT", "Produkt zeigen"],
  ["MOVE_FABRIC", "Ärmel / Stoff bewegen"],
  ["SHOW_ZIPPER", "Reißverschluss zeigen"],
  ["LEG_DETAIL", "Jogger / Bein-Detail"],
] as const;
const CAMERAS = [
  ["STATIC", "Statisch"],
  ["SLOW_PUSH_IN", "Langsamer Push-in"],
  ["SLOW_PULL_OUT", "Langsamer Pull-out"],
  ["LATERAL", "Seitliche Bewegung"],
  ["TRACKING", "Tracking"],
  ["ORBIT", "Orbit"],
  ["LIGHT_HANDHELD", "Leichtes Handheld"],
  ["CLOSE_UP", "Nahaufnahme"],
] as const;
const STEPS = [
  "Artwork",
  "Produkt",
  "Variante",
  "Markenmodel",
  "Ausgangsbild",
  "Video-Typ",
  "Bewegung",
  "Kamera",
  "Format",
  "Prüfen",
  "Generieren",
  "Ergebnis",
];
type Opt = {
  brandModels: any[];
  artworks: any[];
  products: any[];
  sources: any[];
};
type Job = any;
type Recovery = {
  job: Job;
  asset: any;
  state: string;
  access?: { url: string } | null;
};
const allChecks = {
  identity: false,
  product: false,
  artwork: false,
  naturalMovement: false,
  camera: false,
  productVisible: false,
  artworkVisible: false,
  noArtifacts: false,
  overallQuality: false,
};
const JOB_STATUS_LABELS: Record<string, string> = {
  awaiting_confirmation: "Bestätigung erforderlich",
  confirmed: "Bestätigt",
  running: "Wird verarbeitet",
  succeeded: "Erfolgreich",
  failed: "Fehlgeschlagen",
  unknown_outcome: "Unklarer Provider-Ausgang",
  cancelled: "Abgebrochen",
};
const SHOT_LABELS: Record<string, string> = {
  studio_front_primary: "Studio frontal",
  studio_front_alternate: "Studio frontal · Alternative",
  studio_front_crop: "Studio · Ausschnitt",
  ecommerce_garment_view: "Produktansicht",
};
export function VideoStudioWorkspace({
  syntheticEnabled = false,
}: {
  syntheticEnabled?: boolean;
}) {
  const [options, setOptions] = useState<Opt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [artworkId, setArtworkId] = useState("");
  const [productProfileId, setProductProfileId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [brandModelId, setBrandModelId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [type, setType] = useState("PRODUCT_MODEL");
  const [movement, setMovement] = useState("SUBTLE");
  const [camera, setCamera] = useState("STATIC");
  const [aspect, setAspect] = useState("9:16");
  const [duration, setDuration] = useState(5);
  const [scene, setScene] = useState("Ruhiges Studio");
  const [lighting, setLighting] = useState("Weiches gerichtetes Studiolicht");
  const [job, setJob] = useState<Job | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState(allChecks);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Job[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, j] = await Promise.all([
        fetch("/api/video/options", { cache: "no-store" }),
        fetch("/api/video/jobs", { cache: "no-store" }),
      ]);
      const op = await o.json(),
        jp = await j.json();
      if (!o.ok)
        throw new Error(
          op.error ?? "Video-Optionen konnten nicht geladen werden.",
        );
      if (!j.ok)
        throw new Error(
          jp.error ?? "Video-Durchläufe konnten nicht geladen werden.",
        );
      setOptions(op);
      const runs = splitVideoRuns((jp.jobs ?? []) as Job[]);
      setHistory(runs.history);
      if (runs.current) {
        setArtworkId(runs.current.inputSnapshot.artwork.artworkId);
        setProductProfileId(runs.current.inputSnapshot.product.productProfileId);
        setVariantId(runs.current.inputSnapshot.product.variantId ?? "");
        setBrandModelId(runs.current.inputSnapshot.persona.trace.brandModelId);
        setSourceId(runs.current.inputSnapshot.sourceVisual.sourceAssetId);
        setJob(runs.current);
        const rr = await fetch(`/api/video/jobs/${runs.current.id}`, {
          cache: "no-store",
        });
        if (rr.ok) {
          const body = await rr.json();
          setRecovery(body.recovery);
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Video Studio konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const resetPreparedRun = (clearSource = true) => {
    const current = job;
    if (current && ["awaiting_confirmation", "confirmed"].includes(current.status)) {
      void fetch(`/api/video/jobs/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }).catch(() => undefined);
    }
    if (current) {
      const historical = ["awaiting_confirmation", "confirmed"].includes(current.status)
        ? { ...current, status: "cancelled" }
        : current;
      setHistory((items) => [historical, ...items.filter((item) => item.id !== current.id)]);
    }
    if (clearSource) setSourceId("");
    setJob(null);
    setRecovery(null);
  };
  const eligibleSources =
    options?.sources.filter(
      (candidate) =>
        (!artworkId || candidate.artwork.artworkId === artworkId) &&
        (!productProfileId ||
          candidate.product.productProfileId === productProfileId) &&
        (!variantId || candidate.product.variantId === variantId) &&
        (!brandModelId || candidate.brandModel.brandModelId === brandModelId),
    ) ?? [];
  const source =
    options?.sources.find((s) => s.sourceAssetId === sourceId) ?? null;
  const model = source
    ? options?.brandModels.find(
        (m) => m.brandModelId === source.brandModel.brandModelId,
      )
    : null;
  const artwork = source
    ? options?.artworks.find((a) => a.id === source.artwork.artworkId)
    : null;
  const product = source
    ? options?.products.find(
        (p) =>
          p.productProfileId === source.product.productProfileId &&
          p.version === source.product.profileVersion,
      )
    : null;
  const variant = product?.variants.find(
    (v: any) => v.variantId === source?.product.variantId,
  );
  const blockers = [
    !source && "Wähle ein freigegebenes Image-Studio-Ausgangsbild.",
    source &&
      !model?.videoEligible &&
      "Dieses Markenmodel ist noch nicht für Video freigegeben.",
    source &&
      !artwork &&
      "Die freigegebene Artwork-Version ist nicht verfügbar.",
    source &&
      !product &&
      "Die genaue Produktprofilversion ist nicht verfügbar.",
  ].filter(Boolean) as string[];
  const currentStep = recovery?.asset
    ? 11
    : job
      ? 10
      : source
        ? 5
        : brandModelId
          ? 4
          : variantId
            ? 3
            : productProfileId
              ? 2
              : artworkId
                ? 1
                : 0;
  async function prepare() {
    if (blockers.length || !source || !model || !artwork || !product) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: `Video · ${product.name}`,
          brandModelTrace: source.brandModel,
          artworkId: artwork.id,
          productProfileId: product.productProfileId,
          productProfileVersion: product.version,
          variantId: variant.variantId,
          sourceImageAssetId: source.sourceAssetId,
          productionMode: "IMAGE_TO_VIDEO_APPROVED_ASSET",
          direction: {
            videoType: type,
            movement,
            customMovement: null,
            camera,
            customCamera: null,
            scene,
            lighting,
            durationSeconds: duration,
            aspectRatio: aspect,
            resolution: "provider-adapter",
            fps: null,
            garmentVisibility: "HIGH",
            artworkVisibilityPriority: "CRITICAL",
            pacing: type === "SOCIAL" ? "DYNAMIC" : "CALM",
            startPose: null,
            endPose: null,
            loopPreference: false,
            platformIntent: type === "SOCIAL" ? "REELS" : "GENERAL",
            audioIntent: "NONE",
          },
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.job)
        throw new Error(
          body.error ?? "Video-Auftrag konnte nicht vorbereitet werden.",
        );
      if (job) setHistory((h) => [job, ...h.filter((x) => x.id !== job.id)]);
      setJob(body.job);
      setRecovery(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorbereitung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function action(action: string) {
    if (!job) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/video/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          inputFingerprint: job.inputFingerprint,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Video-Aktion fehlgeschlagen.");
      if (body.job) setJob(body.job);
      const rr = await fetch(`/api/video/jobs/${job.id}`, {
        cache: "no-store",
      });
      if (rr.ok) setRecovery((await rr.json()).recovery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video-Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function review(decision: "APPROVED" | "REJECTED") {
    if (!job || !recovery?.asset) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/video/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          assetId: recovery.asset.id,
          decision,
          checklist: checks,
          note: note || null,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error ?? "Prüfung konnte nicht gespeichert werden.",
        );
      setRecovery((r) =>
        r ? { ...r, asset: body.asset, state: decision } : r,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prüfung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nx-studio video-studio">
      <StudioHeader
        eyebrow="Xeriamo · Video-Produktion"
        title="Video Studio"
        description="Videos aus freigegebenem Markenmodel, Produkt, Artwork und Image-Ausgangsbild vorbereiten."
        actions={
          <button
            className="nx-button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="size-4" /> Aktualisieren
          </button>
        }
      />
      <div className="nx-page-content">
        <StudioStepper steps={STEPS} current={currentStep} />
        {error ? (
          <div className="nx-notice nx-notice--error" role="alert">
            <strong>Video Studio benötigt Aufmerksamkeit</strong>
            <p>{error}</p>
          </div>
        ) : null}
        {loading ? (
          <div className="nx-loading" role="status">
            <Loader2 className="size-5 animate-spin" /> Video Studio wird
            geladen…
          </div>
        ) : (
          <>
            <section className="nx-card video-source">
              <div>
                <p className="nx-page-header__eyebrow">Produktionsquelle</p>
                <h2>Artwork, Produkt und Markenmodel</h2>
                <p>
                  Wähle die Produktionsidentitäten. Danach zeigt NexHQ nur
                  freigegebene Ausgangsbilder mit exakt passender Herkunft.
                </p>
              </div>
              <div className="video-authority-selectors">
                <label>
                  Artwork
                  <select
                    value={artworkId}
                    onChange={(event) => {
                      setArtworkId(event.target.value);
                      resetPreparedRun();
                    }}
                  >
                    <option value="">Artwork auswählen</option>
                    {options?.artworks.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatArtworkSelectorLabel({
                          userFacingTitle: item.displayName,
                          fileName: item.originalFileName,
                          designId: item.designId,
                          version: item.version,
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Produkt
                  <select
                    value={productProfileId}
                    onChange={(event) => {
                      setProductProfileId(event.target.value);
                      setVariantId("");
                      resetPreparedRun();
                    }}
                  >
                    <option value="">Produkt auswählen</option>
                    {options?.products.map((item) => (
                      <option
                        key={`${item.productProfileId}:${item.version}`}
                        value={item.productProfileId}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Variante
                  <select
                    value={variantId}
                    disabled={!productProfileId}
                    onChange={(event) => {
                      setVariantId(event.target.value);
                      resetPreparedRun();
                    }}
                  >
                    <option value="">Variante auswählen</option>
                    {options?.products
                      .find(
                        (item) => item.productProfileId === productProfileId,
                      )
                      ?.variants.map((item: any) => (
                        <option key={item.variantId} value={item.variantId}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Markenmodel
                  <select
                    value={brandModelId}
                    onChange={(event) => {
                      setBrandModelId(event.target.value);
                      resetPreparedRun();
                    }}
                  >
                    <option value="">Markenmodel auswählen</option>
                    {options?.brandModels.map((item) => (
                      <option key={item.brandModelId} value={item.brandModelId}>
                        {item.displayName}
                        {item.videoEligible
                          ? " · Für Video freigegeben"
                          : " · Video-Freigabe fehlt"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <h3>Freigegebenes Ausgangsbild</h3>
                <p>
                  Es bindet Model, Produkt und Artwork als bereits geprüfte
                  visuelle Wahrheit.
                </p>
              </div>
              <div className="video-source-grid">
                {eligibleSources.length ? (
                  eligibleSources.map((s) => (
                    <button
                      key={s.sourceAssetId}
                      className={`nx-card nx-card-button${sourceId === s.sourceAssetId ? " nx-card--selected" : ""}`}
                      onClick={() => {
                        if (sourceId === s.sourceAssetId) return;
                        setArtworkId(s.artwork.artworkId);
                        setProductProfileId(s.product.productProfileId);
                        setVariantId(s.product.variantId);
                        setBrandModelId(s.brandModel.brandModelId);
                        setSourceId(s.sourceAssetId);
                        resetPreparedRun(false);
                      }}
                    >
                      {s.previewUrl ? (
                        <img
                          src={s.previewUrl}
                          alt="Freigegebenes Image-Studio-Ausgangsbild"
                        />
                      ) : (
                        <Film />
                      )}
                      <strong>
                        {SHOT_LABELS[s.shotId] ?? "Freigegebene Aufnahme"}
                      </strong>
                      <span className="nx-status nx-status--success">
                        Freigegeben
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="nx-empty">
                    <strong>Kein passendes freigegebenes Ausgangsbild.</strong>
                    <p>
                      Passe die Auswahl an oder gib zuerst ein passendes
                      deterministisches Ergebnis im Image Studio frei.
                    </p>
                  </div>
                )}
              </div>
              {source ? (
                <div className="video-lineage">
                  <span>
                    <b>Artwork</b>
                    {artwork
                      ? `${resolveArtworkDisplayName({
                          userFacingTitle: artwork.displayName,
                          fileName: artwork.originalFileName,
                          designId: artwork.designId,
                        }).displayName} · ${artwork.version}`
                      : "Nicht verfügbar"}
                  </span>
                  <span>
                    <b>Produkt</b>
                    {product
                      ? `${product.name} · ${variant?.title ?? "Variante"}`
                      : "Nicht verfügbar"}
                  </span>
                  <span>
                    <b>Markenmodel</b>
                    {model?.displayName ?? "Nicht verfügbar"}
                  </span>
                  <span>
                    {model?.videoEligible ? (
                      <em className="nx-status nx-status--success">
                        <ShieldCheck /> Für Video freigegeben
                      </em>
                    ) : (
                      <em className="nx-status nx-status--warning">
                        <ShieldAlert /> Noch nicht für Video freigegeben
                      </em>
                    )}
                  </span>
                </div>
              ) : null}
            </section>
            <section className="video-controls">
              <div className="nx-card">
                <h2>Video-Typ</h2>
                <div className="video-choice-grid">
                  {TYPES.map(([v, l, d]) => (
                    <button
                      key={v}
                      onClick={() => { if (type !== v) { setType(v); resetPreparedRun(false); } }}
                      className={type === v ? "is-selected" : ""}
                    >
                      <Clapperboard />
                      <strong>{l}</strong>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="nx-card">
                <h2>Bewegung</h2>
                <div className="video-preset-grid">
                  {MOVES.map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => { if (movement !== v) { setMovement(v); resetPreparedRun(false); } }}
                      className={movement === v ? "is-selected" : ""}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="nx-card">
                <h2>Kamera</h2>
                <div className="video-preset-grid">
                  {CAMERAS.map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => { if (camera !== v) { setCamera(v); resetPreparedRun(false); } }}
                      className={camera === v ? "is-selected" : ""}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="nx-card video-format">
                <h2>Szene, Format & Dauer</h2>
                <label>
                  Szene
                  <input
                    value={scene}
                    onChange={(e) => { setScene(e.target.value); resetPreparedRun(false); }}
                  />
                </label>
                <label>
                  Licht
                  <input
                    value={lighting}
                    onChange={(e) => { setLighting(e.target.value); resetPreparedRun(false); }}
                  />
                </label>
                <label>
                  Format
                  <select
                    value={aspect}
                    onChange={(e) => { setAspect(e.target.value); resetPreparedRun(false); }}
                  >
                    <option>9:16</option>
                    <option>4:5</option>
                    <option>1:1</option>
                    <option>16:9</option>
                  </select>
                </label>
                <label>
                  Dauer
                  <select
                    value={duration}
                    onChange={(e) => { setDuration(Number(e.target.value)); resetPreparedRun(false); }}
                  >
                    {[3, 5, 8, 10].map((v) => (
                      <option key={v} value={v}>
                        {v} Sekunden
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            {blockers.length ? (
              <div className="nx-notice nx-notice--warning">
                <strong>Vorbereitung gesperrt</strong>
                {blockers.map((b) => (
                  <p key={b}>{b}</p>
                ))}
                {blockers.some((blocker) =>
                  blocker.includes("noch nicht für Video freigegeben"),
                ) ? (
                  <Link className="nx-button nx-button--secondary" href="/agents/persona">
                    Im Persona Studio prüfen
                  </Link>
                ) : null}
              </div>
            ) : null}
            <section className="nx-card video-review">
              <p className="nx-page-header__eyebrow">Aktueller Durchlauf</p>
              <h2>Prüfen & Kosten</h2>
              <dl>
                <div>
                  <dt>Modus</dt>
                  <dd>Freigegebenes Bild → Video</dd>
                </div>
                <div>
                  <dt>Video-Typ</dt>
                  <dd>{TYPES.find((x) => x[0] === type)?.[1]}</dd>
                </div>
                <div>
                  <dt>Bewegung</dt>
                  <dd>{MOVES.find((x) => x[0] === movement)?.[1]}</dd>
                </div>
                <div>
                  <dt>Kamera</dt>
                  <dd>{CAMERAS.find((x) => x[0] === camera)?.[1]}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>
                    {aspect} · {duration} Sekunden
                  </dd>
                </div>
              </dl>
              {!job ? (
                <button
                  className="nx-button nx-button--primary"
                  disabled={busy || blockers.length > 0}
                  onClick={() => void prepare()}
                >
                  {busy
                    ? "Video wird vorbereitet …"
                    : "Vorbereiten & Kosten prüfen"}
                </button>
              ) : (
                <>
                  <p>
                    <strong>Maximale Kosten:</strong>{" "}
                    {job.estimate.maximum.toFixed(2)} {job.estimate.currency}
                  </p>
                  <p>{job.estimate.basis}</p>
                  {job.status === "awaiting_confirmation" ? (
                    <button
                      className="nx-button nx-button--primary"
                      disabled={busy}
                      onClick={() => void action("confirm")}
                    >
                      Generierung bestätigen
                    </button>
                  ) : null}
                  {job.status === "confirmed" && syntheticEnabled ? (
                    <button
                      className="nx-button nx-button--primary"
                      disabled={busy}
                      onClick={() => void action("execute_fake")}
                    >
                      Synthetischen Test ausführen
                    </button>
                  ) : null}
                  {job.status === "confirmed" && !syntheticEnabled ? (
                    <div className="nx-notice nx-notice--warning">
                      Die Ausführung bleibt gesperrt. Der synthetische Provider
                      ist nur in Entwicklung und Test verfügbar; ein realer
                      Provider ist nicht freigegeben.
                    </div>
                  ) : null}
                  <TechnicalDetails>
                    <p>Fingerprint: {job.inputFingerprint}</p>
                    <p>Provider: {job.inputSnapshot.provider.provider}</p>
                    <p>Job-ID: {job.id}</p>
                  </TechnicalDetails>
                </>
              )}
            </section>
            {busy && job ? (
              <div className="nx-loading" role="status">
                <Loader2 className="size-5 animate-spin" />
                <strong>Video wird verarbeitet …</strong>
                <span>Bitte nicht erneut klicken.</span>
              </div>
            ) : null}
            {recovery?.asset ? (
              <section className="nx-card video-result">
                <h2>Prüfung erforderlich</h2>
                <p>
                  Der synthetische Test hat den vollständigen Orchestrierungsweg
                  geprüft. Er ist kein reales Video.
                </p>
                <div className="video-checklist">
                  {Object.keys(checks).map((k) => (
                    <label key={k}>
                      <input
                        type="checkbox"
                        checked={(checks as any)[k]}
                        onChange={(e) =>
                          setChecks((c) => ({ ...c, [k]: e.target.checked }))
                        }
                      />
                      {
                        (
                          {
                            identity: "Model/Identität stimmt",
                            product: "Produkt stimmt",
                            artwork: "Artwork stimmt",
                            naturalMovement: "Bewegung wirkt natürlich",
                            camera: "Kamera wirkt sauber",
                            productVisible: "Produkt bleibt sichtbar",
                            artworkVisible: "Artwork bleibt sichtbar",
                            noArtifacts: "Keine störenden Artefakte",
                            overallQuality: "Gesamtqualität ausreichend",
                          } as any
                        )[k]
                      }
                    </label>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Prüfnotiz (optional)"
                />
                <div>
                  <button
                    className="nx-button nx-button--primary"
                    disabled={busy || !Object.values(checks).every(Boolean)}
                    onClick={() => void review("APPROVED")}
                  >
                    Freigeben
                  </button>
                  <button
                    className="nx-button"
                    disabled={busy}
                    onClick={() => void review("REJECTED")}
                  >
                    Ablehnen
                  </button>
                </div>
              </section>
            ) : null}
            <details className="nx-card video-history">
              <summary>Vorherige Durchläufe</summary>
              {history.length ? (
                <ul>
                  {history.map((h) => (
                    <li key={h.id}>
                      {TYPES.find(
                        (entry) =>
                          entry[0] === h.inputSnapshot.direction.videoType,
                      )?.[1] ?? "Video"}{" "}
                      · {JOB_STATUS_LABELS[h.status] ?? "Unbekannter Status"} ·{" "}
                      {new Date(h.createdAt).toLocaleString("de-DE")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Noch keine vorherigen Durchläufe.</p>
              )}
            </details>
          </>
        )}
      </div>
    </div>
  );
}
