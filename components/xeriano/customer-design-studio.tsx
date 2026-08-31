"use client";
/* eslint-disable @next/next/no-img-element -- authenticated SVG/raster assets use private same-origin routes */

import Link from "next/link";
import { Download, Eraser, Heart, History, ImageIcon, Loader2, Maximize2, MoreHorizontal, Palette, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSecureBrowserUuid } from "@/lib/browser/secure-uuid";
import {
  fetchDesignHistory, fetchDesignJob, fetchDesignQuote, fetchDesignUtilityQuote,
  submitDesignGeneration, submitDesignUtility, submitSvgToPng,
  DesignUtilityClientError, type DesignQuotePresentation,
} from "@/lib/design-studio/client";
import {
  DESIGN_MODEL_LABELS, DESIGN_REFERENCE_MAX_BYTES, DESIGN_STUDIO_CONTRACT_VERSION,
  designGenerationSetupSchema, type DesignGenerationSetup, type DesignResult, type DesignRun,
} from "@/lib/design-studio/contracts";
import { isSuccessfulDesignRun, latestCompletedDesignRun, mergeDurableDesignResults } from "@/lib/design-studio/persistent-results";
import { handoffHref, type XerianoLibraryAsset } from "@/lib/xeriano/library";

type Tab = "CREATE" | "LIBRARY" | "HISTORY";
type LibraryFilter = "ALL" | "RASTER" | "VECTOR" | "FAVORITE";
type AssetDraft = { asset: XerianoLibraryAsset | null; file: File | null; title: string; description: string; tags: string };
type ReferencePreview = {
  url: string;
  title: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  transparentSurface: boolean;
  objectUrl: boolean;
};
const ACTIVE_JOB_KEY = "xeriamo-design-active-job-v1";
const UTILITY_JOB_KEY_PREFIX = "xeriamo-design-utility-job-v1";
const SVG_TO_PNG_JOB_KEY_PREFIX = "xeriamo-svg-to-png-job-v1";

const DEFAULT_SETUP: DesignGenerationSetup = {
  contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
  prompt: "", stylePreset: "NONE", model: "IDEOGRAM_4", outputMode: "RASTER",
  aspectRatio: "1:1", quality: "STANDARD", count: 1, reference: null,
  resolution: "2K",
};

function assetContentUrl(asset: XerianoLibraryAsset, download = false) {
  const parameters = asset.mimeType === "image/svg+xml" && !download ? "?preview=1" : download ? "?download=1" : "";
  return `/api/xeriano/library/${asset.id}/content${parameters}`;
}

function assetResult(asset: XerianoLibraryAsset): DesignResult {
  return {
    id: asset.id,
    url: assetContentUrl(asset),
    downloadUrl: assetContentUrl(asset, true),
    mimeType: asset.mimeType as DesignResult["mimeType"],
    width: asset.width ?? null,
    height: asset.height ?? null,
    resolution: asset.mimeType === "image/svg+xml" ? null : Math.max(asset.width ?? 0, asset.height ?? 0) > 2_560 ? "4K" : "2K",
    favorite: asset.favorite,
    libraryAssetId: asset.id,
    creationId: asset.creationId ?? null,
  };
}

function referenceTypeLabel(mimeType: string) {
  if (mimeType === "image/svg+xml") return "SVG";
  if (mimeType === "image/jpeg") return "JPG";
  if (mimeType === "image/webp") return "WebP";
  return "PNG";
}

async function fetchOwnedDesignAssets(assetId?: string): Promise<XerianoLibraryAsset[]> {
  const parameters = new URLSearchParams({ type: "DESIGN" });
  if (assetId) parameters.set("asset", assetId);
  const response = await fetch(`/api/xeriano/library?${parameters}`, { cache: "no-store" });
  const body = await response.json() as { assets?: XerianoLibraryAsset[]; error?: string };
  if (!response.ok || !body.assets) throw new Error(body.error ?? "Designs konnten nicht geladen werden.");
  return body.assets;
}

export function CustomerDesignStudio({ audience = "CUSTOMER" }: { audience?: "CUSTOMER" | "OWNER" } = {}) {
  const [tab, setTab] = useState<Tab>("CREATE");
  const [setup, setSetup] = useState<DesignGenerationSetup>(DEFAULT_SETUP);
  const [reference, setReference] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<ReferencePreview | null>(null);
  const [quote, setQuote] = useState<DesignQuotePresentation | null>(null);
  const [utilityQuotes, setUtilityQuotes] = useState<Partial<Record<"BACKGROUND_REMOVE" | "UPSCALE", DesignQuotePresentation>>>({});
  const [assets, setAssets] = useState<XerianoLibraryAsset[]>([]);
  const [historyRuns, setHistoryRuns] = useState<DesignRun[]>([]);
  const [run, setRun] = useState<DesignRun | null>(null);
  const [derivedResults, setDerivedResults] = useState<DesignResult[]>([]);
  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null);
  const [derivedLabel, setDerivedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [utilityBusy, setUtilityBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>("ALL");
  const uploadInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const recoveryPolls = useRef(0);
  const utilityBusyRef = useRef<string | null>(null);
  const deepLinkHandled = useRef(false);
  const resultsSection = useRef<HTMLElement>(null);

  const loadAssets = useCallback(async () => {
    const next = await fetchOwnedDesignAssets();
    setAssets(next);
    return next;
  }, []);
  const loadHistory = useCallback(async () => {
    const next = await fetchDesignHistory();
    setHistoryRuns(next);
    setRun((current) => current ?? latestCompletedDesignRun(next));
    return next;
  }, []);
  const loadAll = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadAssets(), loadHistory()]); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Design Studio konnte nicht geladen werden."); }
    finally { setLoading(false); }
  }, [loadAssets, loadHistory]);

  const openAssetInCreate = useCallback(async (asset: XerianoLibraryAsset, intent: "EDIT" | "VARIATION") => {
    try {
      const vectorPreview = asset.mimeType === "image/svg+xml";
      const sourceUrl = vectorPreview ? `/api/xeriano/library/${asset.id}/content?format=png` : assetContentUrl(asset);
      const response = await fetch(sourceUrl); if (!response.ok) throw new Error();
      const blob = await response.blob();
      const mimeType = vectorPreview ? "image/png" : asset.mimeType;
      const file = new File([blob], `xeriamo-variation.${mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png"}`, { type: mimeType });
      const restored = designGenerationSetupSchema.safeParse(asset.design?.setup);
      const base = restored.success ? restored.data : setup;
      setReference(file);
      setReferencePreview({
        url: assetContentUrl(asset),
        title: asset.title || "Xeriamo Design",
        width: asset.width ?? null,
        height: asset.height ?? null,
        mimeType: asset.mimeType,
        transparentSurface: asset.design?.transparentPreview === true,
        objectUrl: false,
      });
      setSetup({
        ...base,
        reference: { name: file.name, mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp", byteLength: file.size },
      });
      setDerivedResults((current) => [assetResult(asset), ...current.filter((item) => item.libraryAssetId !== asset.id)]);
      setHighlightedAssetId(asset.id);
      setDerivedLabel(null);
      setTab("CREATE");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setNotice(intent === "VARIATION"
        ? "Das Design ist jetzt deine Referenz. Passe den Prompt an und starte die Variation bewusst selbst."
        : "Das Design ist geöffnet. Du kannst Prompt und Einstellungen anpassen oder eine Design-Aktion verwenden.");
    } catch { setNotice("Das Ergebnis konnte nicht als Referenz geladen werden."); }
  }, [setup]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => () => {
    if (referencePreview?.objectUrl) URL.revokeObjectURL(referencePreview.url);
  }, [referencePreview]);
  useEffect(() => {
    void Promise.all((["BACKGROUND_REMOVE", "UPSCALE"] as const).map(async (operation) => {
      const value = await fetchDesignUtilityQuote(operation);
      setUtilityQuotes((current) => ({ ...current, [operation]: value }));
    })).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (deepLinkHandled.current || loading) return;
    const parameters = new URLSearchParams(window.location.search);
    const assetId = parameters.get("asset");
    if (!assetId || !/^[0-9a-f-]{36}$/i.test(assetId)) return;
    deepLinkHandled.current = true;
    const mode = parameters.get("mode");
    void (async () => {
      try {
        const asset = assets.find((candidate) => candidate.id === assetId)
          ?? (await fetchOwnedDesignAssets(assetId))[0];
        if (!asset) throw new Error();
        if (mode === "details") {
          setTab("LIBRARY");
          setDraft({ asset, file: null, title: asset.title, description: asset.description ?? "", tags: asset.tags.join(", ") });
          return;
        }
        await openAssetInCreate(asset, mode === "variation" ? "VARIATION" : "EDIT");
      } catch {
        setNotice("Dieses Design konnte nicht geöffnet werden.");
      }
    })();
  }, [assets, loading, openAssetInCreate]);
  useEffect(() => {
    const active = window.localStorage.getItem(ACTIVE_JOB_KEY);
    if (!active) return;
    void fetchDesignJob(active).then((recovered) => {
      setRun(recovered);
      if (recovered.status !== "RUNNING" && recovered.status !== "UNKNOWN_OUTCOME") {
        window.localStorage.removeItem(ACTIVE_JOB_KEY);
      }
    }).catch(() => window.localStorage.removeItem(ACTIVE_JOB_KEY));
  }, []);
  useEffect(() => {
    if (!run || (run.status !== "RUNNING" && run.status !== "UNKNOWN_OUTCOME")) return;
    const interval = window.setInterval(() => {
      recoveryPolls.current += 1;
      if (recoveryPolls.current > 100) { window.clearInterval(interval); return; }
      void fetchDesignJob(run.id).then((next) => {
        setRun(next);
        if (next.status !== "RUNNING" && next.status !== "UNKNOWN_OUTCOME") {
          window.localStorage.removeItem(ACTIVE_JOB_KEY);
          window.clearInterval(interval);
          void Promise.all([loadAssets(), loadHistory()]);
        }
      }).catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [loadAssets, loadHistory, run]);
  useEffect(() => {
    if (!setup.prompt.trim()) { setQuote(null); return; }
    const timeout = window.setTimeout(() => {
      void fetchDesignQuote(setup).then(setQuote).catch(() => setQuote(null));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [setup]);

  function chooseReference(file: File | null) {
    if (!file) {
      setReference(null);
      setReferencePreview(null);
      setSetup((current) => ({ ...current, reference: null }));
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size <= 0 || file.size > DESIGN_REFERENCE_MAX_BYTES) {
      setNotice("Erlaubt sind PNG, JPG und WebP bis 8 MB."); return;
    }
    setReference(file);
    setReferencePreview({
      url: URL.createObjectURL(file),
      title: file.name,
      width: null,
      height: null,
      mimeType: file.type,
      transparentSurface: file.type === "image/png",
      objectUrl: true,
    });
    setSetup((current) => ({ ...current, reference: { name: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", byteLength: file.size } }));
  }

  async function generate() {
    if (!setup.prompt.trim() || generating || (audience === "CUSTOMER" && quote?.credits == null)) return;
    let jobId: string;
    try { jobId = createSecureBrowserUuid(); }
    catch { setNotice("Design konnte nicht sicher gestartet werden. Bitte versuche es erneut."); return; }
    setGenerating(true); setNotice(null); setRun(null); setDerivedResults([]); setHighlightedAssetId(null); setDerivedLabel(null); recoveryPolls.current = 0;
    window.localStorage.setItem(ACTIVE_JOB_KEY, jobId);
    try {
      const response = await submitDesignGeneration({ jobId, setup, reference });
      setRun(response.run);
      const completedWithResults = isSuccessfulDesignRun(response.run);
      if (!["RUNNING", "UNKNOWN_OUTCOME"].includes(response.run.status) && !completedWithResults) {
        setNotice(response.run.message ?? "Design konnte nicht erstellt werden. Bitte versuche es erneut.");
      }
      if (response.run.status !== "RUNNING" && response.run.status !== "UNKNOWN_OUTCOME") {
        window.localStorage.removeItem(ACTIVE_JOB_KEY);
      }
      await Promise.all([loadAssets(), loadHistory()]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Design konnte nicht erstellt werden. Bitte versuche es erneut."); }
    finally { setGenerating(false); }
  }

  function utilityLabel(operation: "BACKGROUND_REMOVE" | "UPSCALE", base: string) {
    const value = utilityQuotes[operation];
    if (audience === "OWNER") return value?.ownerCostLabel ? `${base} · ${value.ownerCostLabel}` : base;
    return value?.credits ? `${base} · ${value.credits} Credits` : base;
  }

  function utilityReady(operation: "BACKGROUND_REMOVE" | "UPSCALE") {
    const value = utilityQuotes[operation];
    return audience === "OWNER" ? Boolean(value?.ownerCostLabel) : value?.credits != null;
  }

  async function runUtility(result: DesignRun["results"][number], operation: "BACKGROUND_REMOVE" | "UPSCALE") {
    const quoteReady = utilityReady(operation);
    if (!result.libraryAssetId || utilityBusyRef.current || !quoteReady) return;
    let jobId: string;
    const storageKey = `${UTILITY_JOB_KEY_PREFIX}:${result.libraryAssetId}:${operation}`;
    try {
      jobId = window.localStorage.getItem(storageKey) ?? createSecureBrowserUuid();
      window.localStorage.setItem(storageKey, jobId);
    }
    catch { setNotice("Die Aktion konnte nicht sicher gestartet werden."); return; }
    utilityBusyRef.current = `${result.id}:${operation}`;
    setUtilityBusy(`${result.id}:${operation}`);
    setNotice(operation === "BACKGROUND_REMOVE" ? "Hintergrund wird entfernt …" : "Wird auf 4K hochskaliert …");
    try {
      const response = await submitDesignUtility({ jobId, sourceAssetId: result.libraryAssetId, operation });
      window.localStorage.removeItem(storageKey);
      const nextAssets = await loadAssets();
      const derived = nextAssets.find((asset) => asset.id === response.result.assetId);
      if (derived) {
        setDerivedResults((current) => [assetResult(derived), ...current.filter((item) => item.libraryAssetId !== derived.id)]);
        setHighlightedAssetId(derived.id);
        setDerivedLabel(operation === "BACKGROUND_REMOVE" ? "Hintergrund entfernt" : "4K Upscale");
        setTab("CREATE");
        window.requestAnimationFrame(() => resultsSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      setNotice(operation === "BACKGROUND_REMOVE" ? "Hintergrund entfernt" : "4K-Version erstellt");
      await loadHistory();
    } catch (error) {
      if (error instanceof DesignUtilityClientError && (
        [400, 402, 404].includes(error.status)
        || ["PROVIDER_NOT_CONFIGURED", "SOURCE_UNAVAILABLE"].includes(error.code ?? "")
      )) {
        window.localStorage.removeItem(storageKey);
      }
      setNotice(error instanceof Error ? error.message : "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
    } finally { utilityBusyRef.current = null; setUtilityBusy(null); }
  }

  async function createPngVersion(result: DesignRun["results"][number]) {
    if (!result.libraryAssetId || result.mimeType !== "image/svg+xml" || utilityBusyRef.current) return;
    const storageKey = `${SVG_TO_PNG_JOB_KEY_PREFIX}:${result.libraryAssetId}`;
    let jobId: string;
    try {
      jobId = window.localStorage.getItem(storageKey) ?? createSecureBrowserUuid();
      window.localStorage.setItem(storageKey, jobId);
    } catch {
      setNotice("Die PNG-Version konnte nicht sicher gestartet werden.");
      return;
    }
    utilityBusyRef.current = `${result.id}:SVG_TO_PNG`;
    setUtilityBusy(`${result.id}:SVG_TO_PNG`);
    setNotice("PNG-Version wird erstellt …");
    try {
      const response = await submitSvgToPng({ jobId, sourceAssetId: result.libraryAssetId });
      window.localStorage.removeItem(storageKey);
      const nextAssets = await loadAssets();
      const derived = nextAssets.find((asset) => asset.id === response.result.assetId);
      if (derived) {
        setDerivedResults((current) => [assetResult(derived), ...current.filter((item) => item.libraryAssetId !== derived.id)]);
        setHighlightedAssetId(derived.id);
        setDerivedLabel("PNG-Version");
        setTab("CREATE");
        window.requestAnimationFrame(() => resultsSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      setNotice("PNG-Version erstellt");
      await loadHistory();
    } catch (error) {
      if (error instanceof DesignUtilityClientError && [400, 401, 403, 404].includes(error.status)) {
        window.localStorage.removeItem(storageKey);
      }
      setNotice(error instanceof Error ? error.message : "PNG-Version konnte nicht erstellt werden.");
    } finally {
      utilityBusyRef.current = null;
      setUtilityBusy(null);
    }
  }

  async function variation(result: DesignRun["results"][number]) {
    if (!result.libraryAssetId) { setNotice("Das Ergebnis ist noch nicht dauerhaft gespeichert."); return; }
    const asset = assets.find((candidate) => candidate.id === result.libraryAssetId)
      ?? (await fetchOwnedDesignAssets(result.libraryAssetId))[0];
    if (!asset) { setNotice("Das Ergebnis konnte nicht als Referenz geladen werden."); return; }
    await openAssetInCreate(asset, "VARIATION");
  }

  function restoreRunSetup(item: DesignRun, model: "RECRAFT_4" | "IDEOGRAM_4" = item.setup.model) {
    setReference(null);
    setReferencePreview(null);
    setSetup({
      ...item.setup,
      model,
      outputMode: model === "IDEOGRAM_4" ? "RASTER" : item.setup.outputMode,
      quality: model === "IDEOGRAM_4" ? "STANDARD" : item.setup.quality,
      count: model === "IDEOGRAM_4" ? 1 : item.setup.count,
      reference: null,
    });
    setRun(null);
    setTab("CREATE");
    setNotice(model === "IDEOGRAM_4"
      ? "Design-Einstellungen wiederhergestellt. Ideogram 4 ist ausgewählt."
      : "Design-Einstellungen wiederhergestellt.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function historyStatus(item: DesignRun) {
    if (item.failureCode === "PROVIDER_CAPACITY") return "Recraft ausgelastet";
    if (item.status === "SUCCEEDED" && item.results.length > 0) return "Abgeschlossen";
    if (item.status === "PARTIALLY_SUCCEEDED" && item.results.length > 0) return "Teilweise abgeschlossen";
    if (item.status === "RUNNING") return "Wird erstellt";
    if (item.status === "UNKNOWN_OUTCOME") return "Status wird geprüft";
    return "Nicht abgeschlossen";
  }

  function beginUpload(file: File, asset: XerianoLibraryAsset | null = null) {
    setDraft({ asset, file, title: asset?.title ?? file.name.replace(/\.[^.]+$/, ""), description: asset?.description ?? "", tags: asset?.tags.join(", ") ?? "" });
  }
  function edit(asset: XerianoLibraryAsset) { setDraft({ asset, file: null, title: asset.title, description: asset.description ?? "", tags: asset.tags.join(", ") }); }
  async function saveDraft() {
    if (!draft?.title.trim()) return; setSaving(true);
    try {
      const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
      const response = draft.file ? await fetch("/api/xeriano/library", { method: "POST", body: (() => { const form = new FormData(); form.set("file", draft.file!); form.set("title", draft.title.trim()); form.set("description", draft.description.trim()); form.set("tags", JSON.stringify(tags)); if (draft.asset) form.set("replaceAssetId", draft.asset.id); return form; })() }) : await fetch(`/api/xeriano/library/${draft.asset?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title.trim(), description: draft.description.trim() || null, tags }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Design konnte nicht gespeichert werden.");
      setDraft(null); setNotice(draft.asset ? "Design wurde aktualisiert." : "Design wurde gespeichert."); await loadAssets();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Design konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }
  async function patch(id: string, body: object) { const response = await fetch(`/api/xeriano/library/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (response.ok) await loadAssets(); }
  async function remove(id: string) { if (!window.confirm("Design wirklich löschen?")) return; const response = await fetch(`/api/xeriano/library/${id}`, { method: "DELETE" }); if (response.ok) { setNotice("Design wurde gelöscht."); await loadAssets(); } }

  const filteredAssets = useMemo(() => assets.filter((asset) => filter === "ALL" || (filter === "VECTOR" && asset.mimeType === "image/svg+xml") || (filter === "RASTER" && asset.mimeType !== "image/svg+xml") || (filter === "FAVORITE" && asset.favorite)), [assets, filter]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const visibleResults = useMemo(() => {
    return mergeDurableDesignResults(derivedResults, run?.results ?? []);
  }, [derivedResults, run]);
  const creativeHref = (assetId: string) => handoffHref(assetId, "CREATIVE_STUDIO", audience);

  return <div className="xeriano-studio-page xeriamo-design-studio">
    <header className="xeriano-page-header"><div><span className="xeriano-eyebrow">Artwork Creation</span><h1>Design Studio</h1><p>Erstelle Artworks, Grafiken und Typografie für deine Marke.</p></div></header>
    <nav className="xd-tabs" aria-label="Design Studio Bereiche">
      {(["CREATE", "LIBRARY", "HISTORY"] as const).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "CREATE" ? "Erstellen" : value === "LIBRARY" ? "Bibliothek" : "Verlauf"}</button>)}
    </nav>
    {notice ? <div className="xeriano-inline-notice" role="status">{notice}<button aria-label="Hinweis schließen" onClick={() => setNotice(null)}>×</button></div> : null}

    {tab === "CREATE" ? <section className="xd-create">
      <div className="xd-step"><span>01</span><div><h2>Design beschreiben</h2><p>Deine Idee und sichtbare Texte bleiben die kreative Autorität.</p></div></div>
      <textarea className="xd-prompt" rows={7} maxLength={6000} value={setup.prompt} onChange={(event) => setSetup({ ...setup, prompt: event.target.value })} placeholder={'Beschreibe dein Design – z. B. Vintage Streetwear Grafik mit dem Spruch "LOVE STAYED TEACHABLE", florales Hero-Motiv, kräftige Typografie, hochwertige Print-Grafik.'}/>

      <div className="xd-step"><span>02</span><div><h2>Referenz</h2><p>Optional – nutze ein Bild als Stil- oder Kompositionsreferenz.</p></div></div>
      {reference && referencePreview ? <div className="xd-reference-card">
        <div className={`xd-reference-artwork${referencePreview.transparentSurface ? " xeriamo-transparency-preview" : ""}`}><img src={referencePreview.url} alt={referencePreview.title}/></div>
        <div className="xd-reference-details"><span>Aktuelle Referenz</span><strong>{referencePreview.title}</strong><small>{referencePreview.width && referencePreview.height ? `${referencePreview.width} × ${referencePreview.height} · ` : ""}{referenceTypeLabel(referencePreview.mimeType)}</small><button onClick={() => referenceInput.current?.click()}><ImageIcon/>Referenz ändern</button></div>
      </div> : <button className="xd-upload" onClick={() => referenceInput.current?.click()}><Upload/><span><strong>Referenz auswählen</strong><small>PNG, JPG oder WebP · maximal 8 MB</small></span></button>}
      {reference ? <button className="xd-remove-reference" onClick={() => chooseReference(null)}><X/>Referenz entfernen</button> : null}
      <input hidden ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { chooseReference(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}/>

      <div className="xd-step"><span>03</span><div><h2>Stil</h2><p>Optionaler Impuls – dein Prompt bleibt maßgeblich.</p></div></div>
      <div className="xd-chips">{(["NONE","STREETWEAR","VINTAGE","TYPOGRAPHY","EDITORIAL","ILLUSTRATION","MINIMAL"] as const).map((preset) => <button key={preset} className={setup.stylePreset === preset ? "active" : ""} onClick={() => setSetup({ ...setup, stylePreset: preset })}>{({NONE:"Frei",STREETWEAR:"Streetwear",VINTAGE:"Vintage",TYPOGRAPHY:"Typografie",EDITORIAL:"Editorial",ILLUSTRATION:"Illustration",MINIMAL:"Minimal"})[preset]}</button>)}</div>

      <div className="xd-step"><span>04</span><div><h2>Modell</h2><p>Du entscheidest – Xeriamo wechselt das Modell nicht heimlich.</p></div></div>
      <div className="xd-models">
        <button className={setup.model === "IDEOGRAM_4" ? "active" : ""} onClick={() => setSetup({ ...setup, model: "IDEOGRAM_4", outputMode: "RASTER" })}><Sparkles/><strong>Ideogram 4</strong><span>Stark für Typografie, Sprüche und grafische Designs.</span></button>
        <button className={setup.model === "RECRAFT_4" ? "active" : ""} onClick={() => setSetup({ ...setup, model: "RECRAFT_4", quality: "STANDARD", count: 1 })}><Palette/><strong>Recraft 4</strong><span>Stark für Illustrationen, Grafiken und Vektor-Artworks.</span></button>
      </div>

      <div className="xd-step"><span>05</span><div><h2>Einstellungen</h2><p>Nur die wichtigsten Entscheidungen.</p></div></div>
      <div className="xd-settings">
        <fieldset><legend>Format</legend><div className="xd-chips">{(["1:1","4:5","3:4","2:3"] as const).map((ratio) => <button key={ratio} className={setup.aspectRatio === ratio ? "active" : ""} onClick={() => setSetup({ ...setup, aspectRatio: ratio })}>{ratio}</button>)}</div></fieldset>
        {setup.model === "IDEOGRAM_4" ? <fieldset><legend>Qualität</legend><div className="xd-chips">{(["FAST","STANDARD","HIGH"] as const).map((quality) => <button key={quality} className={setup.quality === quality ? "active" : ""} onClick={() => setSetup({ ...setup, quality })}>{quality === "FAST" ? "Schnell" : quality === "STANDARD" ? "Standard" : "Hoch"}</button>)}</div></fieldset> : <fieldset><legend>Ausgabe</legend><div className="xd-chips"><button className={setup.outputMode === "RASTER" ? "active" : ""} onClick={() => setSetup({ ...setup, outputMode: "RASTER" })}>Bild</button><button className={setup.outputMode === "VECTOR" ? "active" : ""} onClick={() => setSetup({ ...setup, outputMode: "VECTOR" })}>SVG / Vektor</button></div></fieldset>}
        {setup.outputMode === "RASTER" ? <fieldset><legend>Auflösung</legend><div className="xd-chips"><button className={setup.resolution === "2K" ? "active" : ""} onClick={() => setSetup({ ...setup, resolution: "2K" })}>2K</button><button className={setup.resolution === "4K" ? "active" : ""} onClick={() => setSetup({ ...setup, resolution: "4K" })}>4K</button></div></fieldset> : <div className="xd-vector-resolution"><strong>Vektor</strong><span>frei skalierbar</span></div>}
        <fieldset><legend>Anzahl</legend><div className="xd-chips">{(setup.model === "IDEOGRAM_4" ? [1,2,4] as const : [1] as const).map((count) => <button key={count} className={setup.count === count ? "active" : ""} onClick={() => setSetup({ ...setup, count })}>{count}</button>)}</div></fieldset>
      </div>
      <div className="xd-generate-bar"><div>{audience === "OWNER" ? <><strong>Owner · Unlimited</strong><small>Geschätzte Kosten · {quote?.ownerCostLabel ?? "werden berechnet …"}</small></> : <><strong>{quote?.credits == null ? "Preis wird berechnet …" : `${quote.credits} Credits`}</strong><small>Abbuchung erst bei bewusster Generierung</small></>}</div><button className="xeriano-primary-button" disabled={generating || !setup.prompt.trim() || (audience === "CUSTOMER" && quote?.credits == null)} onClick={() => void generate()}>{generating ? <><Loader2 className="spin"/>Wird erstellt …</> : audience === "OWNER" ? `Generieren${quote?.ownerCostLabel ? ` · ${quote.ownerCostLabel}` : ""}` : `Generieren · ${quote?.credits ?? "–"} Credits`}</button></div>

      {visibleResults.length || run ? <section className="xd-results" ref={resultsSection}><header><span className="xeriano-eyebrow">Ergebnisse</span><h2>Deine Designs</h2><p>Deine letzten abgeschlossenen Designs bleiben nach einem Refresh verfügbar.</p></header><div>{visibleResults.map((result) => {
        const asset = result.libraryAssetId ? assetById.get(result.libraryAssetId) : undefined;
        const canBackgroundRemove = asset?.design?.canBackgroundRemove ?? (result.mimeType !== "image/svg+xml");
        const canUpscale = asset?.design?.canUpscale ?? (result.mimeType !== "image/svg+xml" && result.width !== null && result.height !== null && Math.max(result.width, result.height) <= 2_560);
        const transparent = asset?.design?.transparentPreview === true;
        const isNew = result.libraryAssetId === highlightedAssetId;
        return <article key={result.libraryAssetId ?? result.id} className={isNew ? "is-new-derived" : ""}>
          {isNew && derivedLabel ? <span className="xd-derived-label">{derivedLabel}</span> : null}
          <div className={`xd-result-preview${transparent ? " xeriamo-transparency-preview" : ""}`}><img src={result.url} alt="Xeriamo Design"/></div>
          <p className="xd-result-meta">{result.mimeType === "image/svg+xml" ? "SVG · frei skalierbar" : result.width && result.height ? `${result.width} × ${result.height} · ${result.resolution ?? "Raster"}` : `${result.resolution ?? "Raster"} · tatsächliche Maße werden geprüft`}</p>
          <footer className="xd-result-footer">{result.libraryAssetId ? <span className="xd-saved">In Bibliothek</span> : null}<div className="xd-result-primary-row"><a href={result.downloadUrl}><Download/>{result.mimeType === "image/svg+xml" ? "SVG herunterladen" : "Herunterladen"}</a><details className="xd-result-actions"><summary><MoreHorizontal/>Aktionen</summary><div>{asset ? <button onClick={() => void openAssetInCreate(asset, "EDIT")}><Pencil/>Im Design Studio bearbeiten</button> : null}<button onClick={() => void variation(result)}><Sparkles/>Variation erstellen</button><button onClick={() => result.libraryAssetId && void patch(result.libraryAssetId, { favorite: !(asset?.favorite ?? result.favorite) })}><Heart/>Favorit</button>{result.mimeType === "image/svg+xml" && result.libraryAssetId ? <button disabled={Boolean(utilityBusy)} onClick={() => void createPngVersion(result)}><ImageIcon/>{utilityBusy === `${result.id}:SVG_TO_PNG` ? "PNG-Version wird erstellt …" : "PNG-Version erstellen"}</button> : null}{result.mimeType !== "image/svg+xml" && result.libraryAssetId ? <>{canBackgroundRemove ? <button disabled={Boolean(utilityBusy) || !utilityReady("BACKGROUND_REMOVE")} onClick={() => void runUtility(result, "BACKGROUND_REMOVE")}><Eraser/>{utilityBusy === `${result.id}:BACKGROUND_REMOVE` ? "Hintergrund wird entfernt …" : utilityLabel("BACKGROUND_REMOVE", "Hintergrund entfernen")}</button> : null}{canUpscale ? <button disabled={Boolean(utilityBusy) || !utilityReady("UPSCALE")} onClick={() => void runUtility(result, "UPSCALE")}><Maximize2/>{utilityBusy === `${result.id}:UPSCALE` ? "Wird auf 4K hochskaliert …" : utilityLabel("UPSCALE", "Auf 4K upscalen")}</button> : null}</> : null}</div></details></div>{result.libraryAssetId ? <Link className="xd-result-creative-handoff" href={creativeHref(result.libraryAssetId)}><Plus/>Im Creative Studio verwenden</Link> : null}</footer>
        </article>;
      })}</div>{!visibleResults.length ? <div className={run?.failureCode === "PROVIDER_CAPACITY" ? "xd-capacity-state" : undefined}><p>{run?.message}</p>{run?.failureCode === "PROVIDER_CAPACITY" ? <><small>Bitte versuche es später erneut oder nutze Ideogram 4.</small><div><button onClick={() => restoreRunSetup(run)}>Weiter bearbeiten</button><button onClick={() => restoreRunSetup(run, "IDEOGRAM_4")}>Ideogram 4 verwenden</button></div></> : null}</div> : null}</section> : null}
    </section> : null}

    {tab === "LIBRARY" ? <section className="xd-library">
      <header className="xd-tab-header"><div><h2>Design-Bibliothek</h2><p>Uploads und generierte Artworks an einem Ort.</p></div><button className="xeriano-primary-button" onClick={() => uploadInput.current?.click()}><Upload/>Design hochladen</button></header>
      <input ref={uploadInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) beginUpload(file); event.currentTarget.value = ""; }}/>
      <div className="xeriano-filter-row">{(["ALL","RASTER","VECTOR","FAVORITE"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "Alle" : value === "RASTER" ? "Bilder" : value === "VECTOR" ? "Vektor" : "Favoriten"}</button>)}</div>
      {loading ? <div className="xeriano-empty"><Loader2 className="spin"/><p>Designs werden geladen …</p></div> : filteredAssets.length ? <div className="xeriano-asset-grid">{filteredAssets.map((asset) => <article className="xeriano-asset-card" key={asset.id}>
        <div className={`xeriano-asset-preview${asset.design?.transparentPreview ? " xeriamo-transparency-preview" : ""}`}><img src={assetContentUrl(asset)} alt={asset.title}/><button aria-label={asset.favorite ? "Favorit entfernen" : "Als Favorit markieren"} onClick={() => void patch(asset.id, { favorite: !asset.favorite })}><Heart fill={asset.favorite ? "currentColor" : "none"}/></button></div>
        <div className="xeriano-asset-body"><span>{asset.mimeType === "image/svg+xml" ? "Vektor · frei skalierbar" : asset.width && asset.height ? `${asset.width} × ${asset.height}` : "Design"} · {new Date(asset.createdAt).toLocaleDateString("de-DE")}</span>{asset.design?.operation ? <strong className="xd-asset-operation">{asset.design.operation === "BACKGROUND_REMOVE" ? "Hintergrund entfernt" : asset.design.operation === "UPSCALE" ? "4K Upscale" : "PNG-Version"}</strong> : null}<h2>{asset.title}</h2>{asset.description ? <p>{asset.description}</p> : null}</div>
        <footer><button className="xd-card-primary-action" onClick={() => void openAssetInCreate(asset, "EDIT")}><Pencil/>Im Design Studio bearbeiten</button><details><summary aria-label="Weitere Aktionen"><MoreHorizontal/></summary><div><button onClick={() => void openAssetInCreate(asset, "VARIATION")}><Sparkles/>Variation erstellen</button>{asset.design?.canCreatePng ? <button disabled={Boolean(utilityBusy)} onClick={() => void createPngVersion(assetResult(asset))}><ImageIcon/>{utilityBusy === `${asset.id}:SVG_TO_PNG` ? "PNG-Version wird erstellt …" : "PNG-Version erstellen"}</button> : null}{asset.design?.canBackgroundRemove ? <button disabled={Boolean(utilityBusy) || !utilityReady("BACKGROUND_REMOVE")} onClick={() => void runUtility(assetResult(asset), "BACKGROUND_REMOVE")}><Eraser/>{utilityBusy === `${asset.id}:BACKGROUND_REMOVE` ? "Hintergrund wird entfernt …" : utilityLabel("BACKGROUND_REMOVE", "Hintergrund entfernen")}</button> : null}{asset.design?.canUpscale ? <button disabled={Boolean(utilityBusy) || !utilityReady("UPSCALE")} onClick={() => void runUtility(assetResult(asset), "UPSCALE")}><Maximize2/>{utilityBusy === `${asset.id}:UPSCALE` ? "Wird auf 4K hochskaliert …" : utilityLabel("UPSCALE", "Auf 4K upscalen")}</button> : null}<Link href={creativeHref(asset.id)}><Plus/>Im Creative Studio verwenden</Link><a href={assetContentUrl(asset, true)}><Download/>{asset.mimeType === "image/svg+xml" ? "SVG herunterladen" : "Herunterladen"}</a><button onClick={() => edit(asset)}>Details bearbeiten</button><button onClick={() => void patch(asset.id, { favorite: !asset.favorite })}><Heart/>Favorit</button>{!asset.creationId && asset.mimeType !== "image/svg+xml" ? <label>Ersetzen<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) beginUpload(file, asset); event.currentTarget.value = ""; }}/></label> : null}{!asset.creationId ? <button className="danger" onClick={() => void remove(asset.id)}><Trash2/>Löschen</button> : null}</div></details></footer>
      </article>)}</div> : <div className="xeriano-empty"><Palette/><h2>Noch keine Designs</h2><p>Erstelle dein erstes Artwork oder lade PNG, JPG oder WebP hoch.</p><button className="xeriano-secondary-button" onClick={() => setTab("CREATE")}><Sparkles/>Design erstellen</button></div>}
    </section> : null}

      {tab === "HISTORY" ? <section className="xd-history"><header className="xd-tab-header"><div><h2>Verlauf</h2><p>Deine letzten Design-Generierungen – dauerhaft und kontogebunden.</p></div></header>{historyRuns.length ? <div>{historyRuns.map((item) => <article key={item.id}><div>{item.results[0] ? <img src={item.results[0].url} alt="Design Vorschau"/> : <History/>}</div><section><span>{DESIGN_MODEL_LABELS[item.setup.model]} · {new Date(item.createdAt).toLocaleString("de-DE")}</span><h3>{item.setup.prompt}</h3><p>{historyStatus(item)} · {item.results.length}/{item.setup.count} Ergebnisse{item.results.length && item.results.every((result) => result.libraryAssetId) ? " · In Bibliothek" : ""}</p>{item.failureCode === "PROVIDER_CAPACITY" ? <small className="xd-history-helper">Bitte versuche es später erneut oder nutze Ideogram 4.</small> : null}<footer>{item.results[0] ? <button onClick={() => { setRun(item); setTab("CREATE"); }}>Öffnen</button> : null}{item.failureCode === "PROVIDER_CAPACITY" ? <><button onClick={() => restoreRunSetup(item)}>Weiter bearbeiten</button><button onClick={() => restoreRunSetup(item, "IDEOGRAM_4")}>Ideogram 4 verwenden</button></> : <button onClick={() => restoreRunSetup(item)}>Weiter bearbeiten</button>}</footer></section></article>)}</div> : <div className="xeriano-empty"><History/><h2>Noch kein Verlauf</h2><p>Deine Generierungen erscheinen nach dem ersten Auftrag hier.</p></div>}</section> : null}

    {draft ? <div className="xeriano-modal-backdrop" role="presentation" onPointerDown={() => !saving && setDraft(null)}><section className="xeriano-design-dialog" role="dialog" aria-modal="true" aria-labelledby="design-dialog-title" onPointerDown={(event) => event.stopPropagation()}><header><div><span className="xeriano-eyebrow">{draft.asset ? "Design bearbeiten" : "Neues Design"}</span><h2 id="design-dialog-title">Details speichern</h2></div><button aria-label="Dialog schließen" onClick={() => setDraft(null)} disabled={saving}><X/></button></header>{draft.file ? <p className="xeriano-file-line"><strong>Datei</strong><span>{draft.file.name}</span></p> : null}<label><span>Titel *</span><input value={draft.title} maxLength={160} autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label><span>Beschreibung <small>optional</small></span><textarea value={draft.description} maxLength={2000} rows={3} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label><label><span>Tags</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })}/></label><footer><button className="xeriano-secondary-button" onClick={() => setDraft(null)} disabled={saving}>Abbrechen</button><button className="xeriano-primary-button" disabled={saving || !draft.title.trim()} onClick={() => void saveDraft()}>{saving ? "Wird gespeichert …" : "Speichern"}</button></footer></section></div> : null}
  </div>;
}
