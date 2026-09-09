"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated artwork URLs must not pass through the public image optimizer. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Eraser, ImagePlus, Library, Loader2, Maximize2, Printer, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { XerianoMediaSaveLink } from "@/components/xeriano/media-save-link";
import { uploadXerianoTempReference } from "@/lib/xeriano/temp-references/client";
import {
  ARTWORK_PREP_CONTRACT_VERSION,
  ARTWORK_PREP_LOCAL_STORAGE_KEY,
  artworkPrepAssetSchema,
  artworkPrepProjectSchema,
  recommendedArtworkUpscaleFactor,
  type ArtworkPrepAsset,
  type ArtworkPrepProject,
} from "@/lib/artwork-prep-studio/contracts";

type LibraryAsset = { id: string; title: string; mimeType: string; byteLength: number; width: number | null; height: number | null; contentUrl: string };
type Quote = { label: string; estimatedCostUsdMicros: number };

function freshProject(): ArtworkPrepProject {
  return { version: ARTWORK_PREP_CONTRACT_VERSION, projectId: crypto.randomUUID(), originalAssetId: null, currentAssetId: null, variantAssetIds: [], pendingJobs: [] };
}

function bytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MiB` : `${Math.ceil(value / 1024)} KiB`;
}

async function json(response: Response) {
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Die Aktion konnte nicht abgeschlossen werden.");
  if (!data) throw new Error("Die Serverantwort konnte nicht gelesen werden.");
  return data;
}

export function ArtworkPrepWorkspace() {
  const [project, setProject] = useState<ArtworkPrepProject>(() => freshProject());
  const [assets, setAssets] = useState<ArtworkPrepAsset[]>([]);
  const [current, setCurrent] = useState<ArtworkPrepAsset | null>(null);
  const [library, setLibrary] = useState<LibraryAsset[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [color, setColor] = useState("#F4EFE4");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const initialized = useRef(false);
  const observing = useRef(false);

  const remember = useCallback((next: ArtworkPrepProject) => {
    setProject(next);
    localStorage.setItem(ARTWORK_PREP_LOCAL_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const loadAsset = useCallback(async (assetId: string) => {
    const payload = await json(await fetch(`/api/artwork-prep-studio/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" }));
    const asset = artworkPrepAssetSchema.parse(payload.asset);
    setAssets((items) => items.some((item) => item.id === asset.id) ? items : [...items, asset]);
    return asset;
  }, []);

  const observe = useCallback(async (base: ArtworkPrepProject) => {
    if (observing.current) return;
    observing.current = true;
    let next = base;
    try {
      for (const pending of base.pendingJobs) {
        const response = await fetch(`/api/artwork-prep-studio/jobs/${pending.id}?kind=${pending.kind}&projectId=${base.projectId}`, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json() as { status?: string; asset?: unknown };
        if (payload.asset) {
          const asset = artworkPrepAssetSchema.parse(payload.asset);
          setAssets((items) => items.some((item) => item.id === asset.id) ? items : [...items, asset]);
          setCurrent(asset);
          next = { ...next, currentAssetId: asset.id, variantAssetIds: Array.from(new Set([...next.variantAssetIds, asset.id])), pendingJobs: next.pendingJobs.filter((job) => job.id !== pending.id) };
        } else if (payload.status === "FAILED") {
          next = { ...next, pendingJobs: next.pendingJobs.filter((job) => job.id !== pending.id) };
        }
      }
      if (next !== base) remember(next);
    } finally {
      observing.current = false;
    }
  }, [remember]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const parsed = artworkPrepProjectSchema.safeParse(JSON.parse(localStorage.getItem(ARTWORK_PREP_LOCAL_STORAGE_KEY) ?? "null"));
    const restored = parsed.success ? parsed.data : freshProject();
    setProject(restored);
    void (async () => {
      const ids = Array.from(new Set([restored.originalAssetId, restored.currentAssetId, ...restored.variantAssetIds].filter((id): id is string => Boolean(id))));
      const loaded = await Promise.all(ids.map((id) => loadAsset(id).catch(() => null)));
      const selected = loaded.find((asset) => asset?.id === restored.currentAssetId) ?? loaded.find(Boolean) ?? null;
      if (selected) setCurrent(selected);
      await observe(restored);
    })();
  }, [loadAsset, observe]);

  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") void observe(project); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => { document.removeEventListener("visibilitychange", resume); window.removeEventListener("pageshow", resume); };
  }, [observe, project]);

  useEffect(() => {
    if (!project.pendingJobs.length) return;
    const timer = window.setInterval(() => void observe(project), 4_000);
    return () => window.clearInterval(timer);
  }, [observe, project]);

  useEffect(() => {
    void Promise.all([
      ["BACKGROUND_REMOVE", undefined, "remove"],
      ["UPSCALE", 2, "up2"],
      ["UPSCALE", 4, "up4"],
    ].map(async ([operation, factor, key]) => {
      const payload = await json(await fetch("/api/artwork-prep-studio/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, ...(factor ? { factor } : {}) }) }));
      if (payload.quote && typeof payload.quote === "object") setQuotes((value) => ({ ...value, [String(key)]: payload.quote as Quote }));
    })).catch(() => undefined);
  }, []);

  async function upload(file: File) {
    setBusy("upload"); setError(null); setNotice(null);
    try {
      const { tempReferenceId } = await uploadXerianoTempReference({ studio: "ARTWORK_PREP_STUDIO", kind: "IMAGE", file });
      const payload = await json(await fetch("/api/artwork-prep-studio/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.projectId, tempReferenceId, title: file.name.replace(/\.[^.]+$/, "") || "Artwork" }) }));
      const asset = artworkPrepAssetSchema.parse(payload.asset);
      setAssets([asset]); setCurrent(asset);
      remember({ ...project, originalAssetId: asset.id, currentAssetId: asset.id, variantAssetIds: [], pendingJobs: [] });
      setNotice("Original sicher gespeichert.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload fehlgeschlagen."); }
    finally { setBusy(null); }
  }

  async function openLibrary() {
    setLibraryOpen(true); setBusy("library"); setError(null);
    try {
      const payload = await json(await fetch("/api/xeriano/library?type=DESIGN", { cache: "no-store" }));
      setLibrary(Array.isArray(payload.assets) ? payload.assets as LibraryAsset[] : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bibliothek konnte nicht geladen werden."); }
    finally { setBusy(null); }
  }

  async function chooseLibrary(assetId: string) {
    setBusy("library");
    try {
      const sourcePayload = await json(await fetch("/api/artwork-prep-studio/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.projectId, libraryAssetId: assetId }) }));
      const asset = artworkPrepAssetSchema.parse(sourcePayload.asset);
      setCurrent(asset); setAssets([asset]);
      remember({ ...project, originalAssetId: asset.id, currentAssetId: asset.id, variantAssetIds: [], pendingJobs: [] });
      setLibraryOpen(false); setNotice("Privates Bibliotheks-Design ausgewählt.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Design konnte nicht geöffnet werden."); }
    finally { setBusy(null); }
  }

  async function process(operation: "BACKGROUND_REMOVE" | "BACKGROUND_COLOR" | "UPSCALE" | "PRINT_FILE", factor?: 2 | 4, selectedColor?: string) {
    if (!current || busy) return;
    const jobId = crypto.randomUUID();
    const kind = operation === "PRINT_FILE" ? "PRINT" : operation === "BACKGROUND_COLOR" ? "LOCAL" : "UTILITY";
    const pending = { id: jobId, kind } as const;
    const waiting = { ...project, pendingJobs: [...project.pendingJobs, pending] };
    remember(waiting); setBusy(operation); setError(null); setNotice(null);
    try {
      const payload = await json(await fetch("/api/artwork-prep-studio/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, projectId: project.projectId, jobId, sourceAssetId: current.id, ...(factor ? { factor } : {}), ...(selectedColor ? { color: selectedColor } : {}) }) }));
      if (payload.asset) {
        const asset = artworkPrepAssetSchema.parse(payload.asset);
        setAssets((items) => [...items.filter((item) => item.id !== asset.id), asset]); setCurrent(asset);
        remember({ ...waiting, currentAssetId: asset.id, variantAssetIds: Array.from(new Set([...waiting.variantAssetIds, asset.id])), pendingJobs: waiting.pendingJobs.filter((job) => job.id !== jobId) });
        setNotice(operation === "PRINT_FILE" ? "Druckdatei sicher gespeichert." : "Neue Variante sicher gespeichert.");
      } else {
        setNotice("Die Verarbeitung läuft. Sie wird nach der Rückkehr sicher weiter beobachtet.");
      }
    } catch (cause) {
      remember({ ...waiting, pendingJobs: waiting.pendingJobs.filter((job) => job.id !== jobId) });
      setError(cause instanceof Error ? cause.message : "Die Aktion ist fehlgeschlagen.");
    }
    finally { setBusy(null); }
  }

  function reset() {
    const next = freshProject(); setAssets([]); setCurrent(null); setError(null); setNotice(null); remember(next);
  }

  const autoFactor = useMemo(() => current?.width && current.height ? recommendedArtworkUpscaleFactor(current.width, current.height) : null, [current]);
  const transparentAsset = useMemo(() => [...assets].reverse().find((asset) => asset.hasTransparency) ?? null, [assets]);

  return <main className="ap-studio">
    <header className="ap-hero"><div><span>OWNER PILOT</span><h1>Artwork Prep Studio</h1><p>Artworks hochladen, freistellen, hochskalieren und druckfertig exportieren.</p></div><button type="button" onClick={reset}><RotateCcw/> Neues Artwork bearbeiten</button></header>
    {error ? <div className="ap-alert ap-alert--error">{error}</div> : null}
    {notice ? <div className="ap-alert"><Check/> {notice}</div> : null}

    <section className="ap-panel"><div className="ap-heading"><span>01</span><div><h2>Artwork auswählen</h2><p>Vom Gerät direkt in privaten Storage laden oder ein eigenes Bibliotheks-Design öffnen.</p></div></div>
      {!current ? <div className="ap-source-actions">
        <label className="ap-primary"><Upload/> {busy === "upload" ? "Wird sicher hochgeladen …" : "Vom Gerät hochladen"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }}/></label>
        <button className="ap-secondary" type="button" onClick={() => void openLibrary()} disabled={Boolean(busy)}><Library/> Aus Bibliothek wählen</button>
      </div> : null}
      {libraryOpen ? <div className="ap-library"><div><h3>Private Designs</h3><button type="button" onClick={() => setLibraryOpen(false)}>Schließen</button></div><div>{library.map((asset) => <button key={asset.id} type="button" onClick={() => void chooseLibrary(asset.id)}><img src={asset.contentUrl} alt=""/><span>{asset.title}</span></button>)}</div></div> : null}
      {current ? <div className="ap-current"><div className={`ap-preview ${current.hasTransparency ? "ap-checker" : ""}`}><img src={current.contentUrl} alt={current.title}/></div><div className="ap-meta"><strong>{current.title}</strong><span>{current.mimeType}</span><span>{current.width ?? "–"} × {current.height ?? "–"} px</span><span>{bytes(current.byteLength)}</span><span>{current.hasTransparency ? "Transparenz vorhanden" : "Vollständig deckend"}</span><span className="ap-safe"><ShieldCheck/> Original sicher gespeichert</span><XerianoMediaSaveLink href={current.downloadUrl} fileName={current.title} mimeType={current.mimeType}/></div></div> : <div className="ap-empty"><ImagePlus/><p>PNG, JPEG oder WebP bis 20 MiB · sicheres SVG bis 5 MiB</p></div>}
    </section>

    <section className="ap-panel"><div className="ap-heading"><span>02</span><div><h2>Hintergrund</h2><p>Original oder Transparenz behalten – neue Farben werden lokal und creditfrei erzeugt.</p></div></div>
      <div className="ap-actions"><button type="button" disabled={!project.originalAssetId || Boolean(busy)} onClick={() => project.originalAssetId && void loadAsset(project.originalAssetId).then((asset) => { setCurrent(asset); remember({ ...project, currentAssetId: asset.id }); })}>Original behalten</button><button type="button" disabled={!current || Boolean(busy) || current.hasTransparency} onClick={() => void process("BACKGROUND_REMOVE")}><Eraser/> {busy === "BACKGROUND_REMOVE" ? "Hintergrund wird entfernt …" : `Hintergrund entfernen · ${quotes.remove?.label ?? "Preis wird geladen"}`}</button></div>
      <div className="ap-colors"><button type="button" disabled={!transparentAsset || Boolean(busy)} onClick={() => { if (transparentAsset) { setCurrent(transparentAsset); remember({ ...project, currentAssetId: transparentAsset.id }); } }}>Transparent</button>{[["#FFFFFF","Weiß"],["#F4EFE4","Creme"],["#000000","Schwarz"]].map(([value,label]) => <button key={value} type="button" disabled={!current?.hasTransparency || Boolean(busy)} onClick={() => void process("BACKGROUND_COLOR", undefined, value)}><i style={{ backgroundColor: value }}/>{label}</button>)}<label>Eigene Farbe<input type="color" value={color} onChange={(event) => setColor(event.target.value)}/><button type="button" disabled={!current?.hasTransparency || Boolean(busy)} onClick={() => void process("BACKGROUND_COLOR", undefined, color)}>Anwenden</button></label></div>
      {current && !current.hasTransparency ? <p className="ap-hint">Für einen echten Hintergrundwechsel muss das Artwork zuerst freigestellt werden.</p> : null}
    </section>

    <section className="ap-panel"><div className="ap-heading"><span>03</span><div><h2>Hochskalierung</h2><p>ESRGAN vergrößert strukturtreu. Kein Prompt, keine neue Typografie, genau ein Ergebnis.</p></div></div>
      <div className="ap-actions"><button type="button" disabled={!current || current.mimeType === "image/svg+xml" || Boolean(busy)} onClick={() => void process("UPSCALE", 2)}><Maximize2/> 2× · {quotes.up2?.label ?? "Preis wird geladen"}</button><button type="button" disabled={!current || current.mimeType === "image/svg+xml" || Boolean(busy)} onClick={() => void process("UPSCALE", 4)}><Maximize2/> 4× · {quotes.up4?.label ?? "Preis wird geladen"}</button><button type="button" disabled={!current || !autoFactor || current.mimeType === "image/svg+xml" || Boolean(busy)} onClick={() => autoFactor && void process("UPSCALE", autoFactor)}>Automatisch passend {autoFactor ? `· ${autoFactor}×` : "· nicht erforderlich"}</button></div>
      {current?.mimeType === "image/svg+xml" ? <p className="ap-hint">SVG bleibt als verlustfreie Vektorquelle erhalten und benötigt kein ESRGAN-Upscaling.</p> : null}
    </section>

    <section className="ap-panel"><div className="ap-heading"><span>04</span><div><h2>Druckdatei</h2><p>4500 × 6000 px · ca. 300 PPI · sRGB · proportionaler Fit ohne Crop oder Stretch.</p></div></div>
      <button className="ap-print" type="button" disabled={!current || Boolean(busy)} onClick={() => void process("PRINT_FILE")}><Printer/> {busy === "PRINT_FILE" ? "Druckdatei wird erstellt …" : "Druckdatei erstellen · creditfrei"}<ChevronRight/></button>
      {current?.rasterSourceUpscaled ? <p className="ap-warning">4500 × 6000 px · 300-PPI-Druckformat · Rasterquelle wurde hochskaliert</p> : null}
    </section>

    {assets.length ? <section className="ap-panel"><div className="ap-heading"><span>05</span><div><h2>Gespeicherte Varianten</h2><p>Original und Derivate bleiben getrennte private Design-Assets.</p></div></div><div className="ap-variants">{assets.map((asset) => <button className={asset.id === current?.id ? "active" : ""} key={asset.id} type="button" onClick={() => { setCurrent(asset); remember({ ...project, currentAssetId: asset.id }); }}><div className={asset.hasTransparency ? "ap-checker" : ""}><img src={asset.contentUrl} alt=""/></div><strong>{asset.title}</strong><small>{asset.width} × {asset.height} px</small></button>)}</div></section> : null}
    {busy ? <div className="ap-busy"><Loader2/> Verarbeitung läuft …</div> : null}
  </main>;
}
