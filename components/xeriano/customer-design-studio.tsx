"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MoreHorizontal, Palette, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { handoffHref, type XerianoLibraryAsset } from "@/lib/xeriano/library";

type AssetDraft = {
  asset: XerianoLibraryAsset | null;
  file: File | null;
  title: string;
  description: string;
  tags: string;
};

export function CustomerDesignStudio() {
  const [assets, setAssets] = useState<XerianoLibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/xeriano/library?type=DESIGN", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setAssets(body.assets);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Designs konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function beginUpload(file: File, asset: XerianoLibraryAsset | null = null) {
    setDraft({
      asset,
      file,
      title: asset?.title ?? file.name.replace(/\.[^.]+$/, ""),
      description: asset?.description ?? "",
      tags: asset?.tags.join(", ") ?? "",
    });
  }

  function edit(asset: XerianoLibraryAsset) {
    setDraft({ asset, file: null, title: asset.title, description: asset.description ?? "", tags: asset.tags.join(", ") });
  }

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    setSaving(true);
    try {
      const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
      const response = draft.file
        ? await fetch("/api/xeriano/library", {
            method: "POST",
            body: (() => {
              const form = new FormData();
              form.set("file", draft.file);
              form.set("title", draft.title.trim());
              form.set("description", draft.description.trim());
              form.set("tags", JSON.stringify(tags));
              if (draft.asset) form.set("replaceAssetId", draft.asset.id);
              return form;
            })(),
          })
        : await fetch(`/api/xeriano/library/${draft.asset?.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: draft.title.trim(), description: draft.description.trim() || null, tags }),
          });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Design konnte nicht gespeichert werden.");
      setDraft(null);
      setNotice(draft.asset ? "Design wurde aktualisiert." : "Design wurde in deiner Bibliothek gespeichert.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Design konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: object) {
    const response = await fetch(`/api/xeriano/library/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Design wirklich löschen?")) return;
    const response = await fetch(`/api/xeriano/library/${id}`, { method: "DELETE" });
    if (response.ok) {
      setNotice("Design wurde gelöscht.");
      await load();
    }
  }

  return <div className="xeriano-studio-page">
    <header className="xeriano-page-header">
      <div><span className="xeriano-eyebrow">Artwork Management</span><h1>Design Studio</h1><p>Verwalte deine Designs und verwende sie direkt in deinen Generierungen.</p></div>
      <button className="xeriano-primary-button" onClick={() => uploadInput.current?.click()}><Upload size={17}/>Design hochladen</button>
      <input ref={uploadInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) beginUpload(file); event.currentTarget.value = ""; }}/>
    </header>

    {notice ? <div className="xeriano-inline-notice" role="status">{notice}<button aria-label="Hinweis schließen" onClick={() => setNotice(null)}>×</button></div> : null}

    {loading ? <div className="xeriano-empty"><Palette/><p>Designs werden geladen …</p></div> : assets.length ?
      <div className="xeriano-asset-grid">{assets.map((asset) => <article className="xeriano-asset-card" key={asset.id}>
        <div className="xeriano-asset-preview">
          <Image src={`/api/xeriano/library/${asset.id}/content`} alt={asset.title} fill sizes="(max-width: 560px) 100vw, 33vw" unoptimized/>
          <button aria-label={asset.favorite ? "Favorit entfernen" : "Als Favorit markieren"} onClick={() => void patch(asset.id, { favorite: !asset.favorite })}><Heart fill={asset.favorite ? "currentColor" : "none"}/></button>
        </div>
        <div className="xeriano-asset-body"><span>Design · {new Date(asset.createdAt).toLocaleDateString("de-DE")}</span><h2>{asset.title}</h2>{asset.description ? <p>{asset.description}</p> : null}{asset.tags.length ? <p>{asset.tags.join(" · ")}</p> : null}</div>
        <footer>
          <Link href={handoffHref(asset.id, "CREATIVE_STUDIO")}><Plus/>Im Creative Studio verwenden</Link>
          <details><summary aria-label="Weitere Aktionen"><MoreHorizontal/></summary><div>
            <a href={`/api/xeriano/library/${asset.id}/content`} target="_blank" rel="noreferrer">Öffnen</a>
            <button onClick={() => edit(asset)}>Details bearbeiten</button>
            <label>Ersetzen<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) beginUpload(file, asset); event.currentTarget.value = ""; }}/></label>
            <button onClick={() => setNotice("Dieses Design ist bereits in deiner Bibliothek gespeichert.")}>In Bibliothek speichern</button>
            <button className="danger" onClick={() => void remove(asset.id)}><Trash2/>Löschen</button>
          </div></details>
        </footer>
      </article>)}</div>
      : <div className="xeriano-empty"><Palette/><h2>Noch keine Designs</h2><p>Lade PNG, JPG oder WebP bis 20 MB hoch. SVG bleibt in V1 aus Sicherheitsgründen deaktiviert.</p><button className="xeriano-secondary-button" onClick={() => uploadInput.current?.click()}><Plus/>Erstes Design hochladen</button></div>}

    {draft ? <div className="xeriano-modal-backdrop" role="presentation" onPointerDown={() => !saving && setDraft(null)}>
      <section className="xeriano-design-dialog" role="dialog" aria-modal="true" aria-labelledby="design-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header><div><span className="xeriano-eyebrow">{draft.asset ? "Design bearbeiten" : "Neues Design"}</span><h2 id="design-dialog-title">Details speichern</h2></div><button aria-label="Dialog schließen" onClick={() => setDraft(null)} disabled={saving}><X/></button></header>
        {draft.file ? <p className="xeriano-file-line"><strong>Datei</strong><span>{draft.file.name}</span></p> : null}
        <label><span>Titel *</span><input value={draft.title} maxLength={160} autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label>
        <label><span>Beschreibung <small>optional</small></span><textarea value={draft.description} maxLength={2000} rows={3} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
        <label><span>Tags <small>optional, durch Kommas getrennt</small></span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="Streetwear, Backprint, Logo"/></label>
        <footer><button className="xeriano-secondary-button" onClick={() => setDraft(null)} disabled={saving}>Abbrechen</button><button className="xeriano-primary-button" disabled={saving || !draft.title.trim()} onClick={() => void saveDraft()}>{saving ? "Wird gespeichert …" : "Speichern"}</button></footer>
      </section>
    </div> : null}
  </div>;
}
