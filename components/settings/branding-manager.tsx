"use client";

/* eslint-disable @next/next/no-img-element -- Owner previews must render validated SVG/ICO bytes without image optimization rewriting. */

import { Check, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  XERIAMO_BRANDING_ROLES,
  type XeriamoBrandingAsset,
  type XeriamoBrandingRole,
} from "@/lib/xeriano/branding/contracts";
import { XERIAMO_BRANDING_UPDATED_EVENT } from "@/components/xeriano/branding-provider";

const PRESENTATION: Record<XeriamoBrandingRole, {
  title: string;
  description: string;
  recommendation: string;
  accept: string;
}> = {
  LOGO: { title: "Logo", description: "Primäres Logo oder Wortmarke für große Xeriamo Flächen.", recommendation: "PNG, WebP oder sicheres SVG · transparentes, breites Logo empfohlen · max. 5 MB", accept: "image/png,image/webp,image/svg+xml,.svg" },
  ICON: { title: "Icon", description: "Kompakte Marke für Navigation, Cards und mobile Identität.", recommendation: "PNG, WebP oder sicheres SVG · quadratisch empfohlen · max. 2 MB", accept: "image/png,image/webp,image/svg+xml,.svg" },
  FAVICON: { title: "Favicon", description: "Browser- und Tab-Icon für xeriamo.com.", recommendation: "PNG, SVG oder ICO · quadratischer 512×512 Master empfohlen · max. 1 MB", accept: "image/png,image/svg+xml,image/x-icon,.svg,.ico" },
  APPLE_TOUCH_ICON: { title: "Apple Touch Icon", description: "Home-Screen-Icon für iPhone und iPad.", recommendation: "PNG · mindestens 180×180 und quadratisch empfohlen · max. 2 MB", accept: "image/png,.png" },
};

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

export function BrandingManager() {
  const [assets, setAssets] = useState<XeriamoBrandingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/hq/branding", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as { assets?: XeriamoBrandingAsset[]; error?: string };
      if (!response.ok || !body.assets) throw new Error(body.error ?? "Branding ist gerade nicht verfügbar.");
      setAssets(body.assets);
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Branding ist gerade nicht verfügbar."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const byRole = useMemo(() => Object.fromEntries(XERIAMO_BRANDING_ROLES.map((role) => [role, assets.filter((asset) => asset.role === role)])) as Record<XeriamoBrandingRole, XeriamoBrandingAsset[]>, [assets]);

  async function upload(role: XeriamoBrandingRole, file: File | null) {
    if (!file) return;
    setBusy(`upload:${role}`); setNotice(null); setError(null);
    const form = new FormData(); form.set("role", role); form.set("file", file, file.name);
    try {
      const response = await fetch("/api/hq/branding", { method: "POST", body: form, credentials: "same-origin" });
      if (!response.ok) throw new Error(await responseError(response, "Asset konnte nicht hochgeladen werden."));
      await load(); setNotice("Asset hochgeladen. Aktiviere es, wenn die Vorschau stimmt.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Asset konnte nicht hochgeladen werden."); }
    finally { setBusy(null); }
  }

  async function activate(asset: XeriamoBrandingAsset) {
    setBusy(`activate:${asset.id}`); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/hq/branding/${asset.id}/activate`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: asset.role }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Branding konnte nicht aktiviert werden."));
      await load(); setNotice("Branding aktualisiert");
      window.dispatchEvent(new Event(XERIAMO_BRANDING_UPDATED_EVENT));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Branding konnte nicht aktiviert werden."); }
    finally { setBusy(null); }
  }

  async function remove(asset: XeriamoBrandingAsset) {
    if (asset.active || !window.confirm(`${asset.originalFilename} wirklich löschen?`)) return;
    setBusy(`delete:${asset.id}`); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/hq/branding/${asset.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error(await responseError(response, "Asset konnte nicht gelöscht werden."));
      await load(); setNotice("Altes Branding-Asset gelöscht.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Asset konnte nicht gelöscht werden."); }
    finally { setBusy(null); }
  }

  return (
    <div className="owner-branding-manager">
      {notice ? <div className="owner-branding-notice is-success" role="status"><Check size={17} />{notice}</div> : null}
      {error ? <div className="owner-branding-notice is-error" role="alert">{error}</div> : null}
      {loading ? <div className="owner-branding-loading"><Loader2 className="spin" />Branding wird geladen …</div> : null}
      {!loading ? XERIAMO_BRANDING_ROLES.map((role) => {
        const presentation = PRESENTATION[role];
        const versions = byRole[role];
        const active = versions.find((asset) => asset.active);
        return (
          <article className="owner-branding-card" key={role}>
            <header>
              <div className="owner-settings-card-icon" aria-hidden="true"><ImageIcon size={20} /></div>
              <div><h3>{presentation.title}</h3><p>{presentation.description}</p></div>
              {active ? <span className="owner-branding-active"><Check size={13} />Aktiv</span> : <span className="owner-branding-fallback">Fallback aktiv</span>}
            </header>
            <div className={`owner-branding-preview is-${role.toLowerCase().replaceAll("_", "-")}`}>
              <div className="is-dark">{active ? <img src={active.previewUrl} alt={`Aktives ${presentation.title}`} /> : <strong>{role === "LOGO" ? "Xeriamo" : "X"}</strong>}</div>
              <div className="is-light">{active ? <img src={active.previewUrl} alt="" aria-hidden="true" /> : <strong>{role === "LOGO" ? "Xeriamo" : "X"}</strong>}</div>
              {role === "FAVICON" ? <div className="owner-branding-browser-preview"><span>{active ? <img src={active.previewUrl} alt="" /> : "X"}</span>Xeriamo</div> : null}
            </div>
            <p className="owner-branding-recommendation">{presentation.recommendation}</p>
            <label className="owner-branding-upload">
              {busy === `upload:${role}` ? <Loader2 className="spin" /> : <Upload size={17} />}
              Asset hochladen
              <input type="file" accept={presentation.accept} disabled={Boolean(busy)} onChange={(event) => { void upload(role, event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} />
            </label>
            <section className="owner-branding-versions" aria-label={`${presentation.title} Versionen`}>
              <h4>Versionen</h4>
              {versions.length ? versions.map((asset) => (
                <div key={asset.id} className={asset.active ? "is-active" : ""}>
                  <span className="owner-branding-version-thumb"><img src={asset.previewUrl} alt="" /></span>
                  <span><strong>{asset.originalFilename}</strong><small>{asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ""}{Math.max(1, Math.round(asset.byteLength / 1024))} KB</small></span>
                  {asset.active ? <span className="owner-branding-active">Aktiv</span> : <div className="owner-branding-version-actions"><button disabled={Boolean(busy)} onClick={() => void activate(asset)}>{busy === `activate:${asset.id}` ? <Loader2 className="spin" /> : null}Als aktiv setzen</button><button aria-label={`${asset.originalFilename} löschen`} disabled={Boolean(busy)} onClick={() => void remove(asset)}><Trash2 size={16} /></button></div>}
                </div>
              )) : <p>Noch keine Version hochgeladen.</p>}
            </section>
          </article>
        );
      }) : null}
    </div>
  );
}
