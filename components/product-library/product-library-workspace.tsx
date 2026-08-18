"use client";

/* eslint-disable @next/next/no-img-element -- authenticated signed previews and Shopify CDN images are dynamic owner data */

import { StudioHeader, TechnicalDetails } from "@/components/studio/studio-ui";
import type { PrintSurface } from "@/lib/image/print-surface/types";
import type { ProductProfile, ProductReferenceRole, ProductVisualReference } from "@/lib/product-library/types";
import { PRODUCT_TYPE_SUGGESTIONS } from "@/lib/product-library/product-taxonomy";
import {
  OWNER_PRODUCT_REFERENCE_ROLE_LABELS,
  ownerProductProfileStatusLabel,
  ownerProductReferenceRoleLabel,
  ownerProductStatusLabel,
} from "@/lib/ux/owner-terminology";
import { Boxes, CheckCircle2, ImageIcon, PackagePlus, RefreshCw, ShoppingBag, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CatalogProduct = {
  id: string;
  title: string;
  status: string;
  inventory: number;
  imageUrl: string | null;
  productType: string;
  collections: string[];
  colors: string[];
};

type ProductDetail = CatalogProduct & {
  description: string;
  imageReferences: Array<{ id: string; url: string; altText: string | null; width: number | null; height: number | null }>;
  variants: Array<{ id: string; title: string; available: boolean; inventory: number; options: Array<{ name: string; value: string }> }>;
};

type OwnerReference = Omit<ProductVisualReference, "privateStoragePath"> & {
  previewUrl?: string | null;
  previewExpiresAt?: string | null;
};
type ProductProfileView = Omit<ProductProfile, "references"> & { references: OwnerReference[] };

const REFERENCE_ROLES = Object.keys(OWNER_PRODUCT_REFERENCE_ROLE_LABELS) as ProductReferenceRole[];
const CSV = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const PROFILE_API = "/api/product-library/profiles";

function completeness(profile: ProductProfileView) {
  const primaryReferences = profile.references.filter((reference) => ["FEATURED", "FRONT"].includes(reference.role)).length;
  const readySurface = profile.printSurfaces.filter((surface) => surface.geometryStatus !== "REQUIRES_CALIBRATION" && surface.quad).length;
  return [
    { label: "Grunddaten", complete: Boolean(profile.name && profile.productType) },
    { label: "Varianten", complete: profile.variants.length > 0 },
    { label: "Material", complete: Boolean(profile.construction.primaryMaterial || profile.construction.material) },
    { label: "Produktbilder", complete: primaryReferences > 0, value: `${profile.references.length}` },
    { label: "Druckflächen", complete: readySurface > 0, value: `${readySurface}` },
  ];
}

async function responsePayload<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Produktdaten konnten nicht gespeichert werden.");
  return payload;
}

function ProductProfileReadiness({ profile }: { profile: ProductProfileView }) {
  const checks = completeness(profile);
  return (
    <div className="product-readiness" aria-label="Vollständigkeit des Produktwissens">
      <strong>Produktwissen</strong>
      <ul>{checks.map((check) => <li key={check.label}><span>{check.complete ? "✓" : "○"} {check.label}</span>{check.value ? <em>{check.value}</em> : null}</li>)}</ul>
      <span className={`nx-status ${checks.every((check) => check.complete) ? "nx-status--success" : "nx-status--warning"}`}>
        {checks.every((check) => check.complete) ? "Image Studio bereit" : "Produktwissen ergänzen"}
      </span>
    </div>
  );
}

function ReferenceGallery({ profile, editable, busy, onRoleChange }: {
  profile: ProductProfileView;
  editable: boolean;
  busy: boolean;
  onRoleChange: (referenceId: string, role: ProductReferenceRole) => Promise<void>;
}) {
  if (!profile.references.length) return <div className="nx-empty"><strong>Noch keine Produktbilder.</strong><p>Füge mindestens ein Haupt- oder Vorderseitenbild hinzu.</p></div>;
  return (
    <div className="product-detail__images product-detail__images--managed">
      {profile.references.map((reference) => (
        <figure key={reference.referenceId}>
          {reference.previewUrl ? <img src={reference.previewUrl} alt={reference.altText ?? `${profile.name} Produktreferenz`} loading="lazy" /> : <span className="product-card__image"><ImageIcon className="size-7" /></span>}
          <figcaption>
            {editable ? (
              <label>Rolle
                <select value={reference.role} disabled={busy} onChange={(event) => void onRoleChange(reference.referenceId, event.target.value as ProductReferenceRole)}>
                  {REFERENCE_ROLES.map((role) => <option key={role} value={role}>{ownerProductReferenceRoleLabel(role)}</option>)}
                </select>
              </label>
            ) : <span>{ownerProductReferenceRoleLabel(reference.role)}</span>}
            {reference.width && reference.height ? <span>{reference.width} × {reference.height}</span> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function SurfaceList({ surfaces }: { surfaces: PrintSurface[] }) {
  if (!surfaces.length) return <div className="nx-empty"><strong>Noch keine Druckfläche definiert.</strong><p>Geometrie wird niemals automatisch erfunden.</p></div>;
  return <ul className="product-detail__variants">{surfaces.map((surface) => <li key={`${surface.printSurfaceId}:${surface.version}`}><strong>{surface.displayName ?? surface.region}</strong><span>{surface.geometryStatus === "REQUIRES_CALIBRATION" ? "Kalibrierung erforderlich" : "Vom Owner definiert"} · V{surface.version}{surface.variantId ? " · Variantenbezogen" : " · Für alle Varianten"}</span></li>)}</ul>;
}

function ProfileEditor({ profile, onUpdated }: { profile: ProductProfileView; onUpdated: (profile: ProductProfileView) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [material, setMaterial] = useState(profile.construction.primaryMaterial ?? profile.construction.material ?? "");
  const [gsm, setGsm] = useState(profile.construction.gsm?.toString() ?? "");
  const [fit, setFit] = useState(profile.construction.fit ?? "");
  const [construction, setConstruction] = useState(profile.construction.otherNotes ?? profile.construction.construction ?? "");
  const [surfaceRegion, setSurfaceRegion] = useState<PrintSurface["region"]>("front_center");
  const [surfaceName, setSurfaceName] = useState("Vorne mittig");
  const [surfaceVariant, setSurfaceVariant] = useState("");
  const [surfaceAttested, setSurfaceAttested] = useState(false);
  const [quad, setQuad] = useState(["0.32", "0.30", "0.68", "0.30", "0.67", "0.70", "0.33", "0.70"]);

  useEffect(() => {
    setMaterial(profile.construction.primaryMaterial ?? profile.construction.material ?? "");
    setGsm(profile.construction.gsm?.toString() ?? "");
    setFit(profile.construction.fit ?? "");
    setConstruction(profile.construction.otherNotes ?? profile.construction.construction ?? "");
  }, [profile]);

  async function saveKnowledge() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: profile.version, construction: { material: material || null, primaryMaterial: material || null, materials: material ? [{ name: material, percentage: null }] : [], gsm: gsm ? Number(gsm) : null, fit: fit || null, otherNotes: construction || null, metadataSource: "PRODUCTION_METADATA_MANUAL" } }),
      });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); onUpdated(payload.profile); setMessage("Produktwissen als neue Version gespeichert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Produktwissen konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }

  async function uploadReference(form: FormData) {
    setBusy(true); setMessage(null);
    try {
      form.set("expectedVersion", String(profile.version));
      const response = await fetch(`${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/references`, { method: "POST", body: form });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); onUpdated(payload.profile); setMessage("Produktbild privat gespeichert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Produktbild konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }

  async function changeRole(referenceId: string, role: ProductReferenceRole) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/references/${encodeURIComponent(referenceId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: profile.version, role }) });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); onUpdated(payload.profile);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Referenzrolle konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }

  async function saveSurface() {
    if (!surfaceAttested) { setMessage("Bestätige zuerst, dass du die Druckfläche bewusst definiert hast."); return; }
    setBusy(true); setMessage(null);
    try {
      const numbers = quad.map(Number);
      const response = await fetch(`${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/surfaces`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        expectedVersion: profile.version,
        printSurfaceId: `${surfaceRegion}:${surfaceVariant || "all"}`,
        displayName: surfaceName,
        region: surfaceRegion,
        variantId: surfaceVariant || null,
        surfaceKind: "PRINT",
        supportedPrintMethods: profile.construction.supportedPrintMethods,
        quad: [[numbers[0], numbers[1]], [numbers[2], numbers[3]], [numbers[4], numbers[5]], [numbers[6], numbers[7]]].map(([x, y]) => ({ x, y })),
        calibrationAttestation: true,
      }) });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); onUpdated(payload.profile); setSurfaceAttested(false); setMessage("Druckfläche als neue Produktversion gespeichert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Druckfläche konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }

  return (
    <div className="product-profile-editor">
      {message ? <div className="nx-notice" role="status">{message}</div> : null}
      <details open><summary>Übersicht</summary><div className="product-detail-section"><p>{profile.description || "Keine Beschreibung hinterlegt."}</p><ProductProfileReadiness profile={profile} /></div></details>
      <details><summary>Varianten</summary><div className="product-detail-section"><ul className="product-detail__variants">{profile.variants.map((variant) => <li key={variant.variantId}><strong>{variant.title}</strong><span>{variant.color ?? "Keine Farbe"}{variant.size ? ` · ${variant.size}` : ""} · {variant.available == null ? "Verfügbarkeit unbekannt" : variant.available ? "Verfügbar" : "Nicht verfügbar"}</span></li>)}</ul></div></details>
      <details open><summary>Material & Stoff</summary><div className="product-detail-section product-form-grid"><label>Primärmaterial<input value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="z. B. 100 % Baumwolle" /></label><label>GSM<input type="number" min="1" max="2000" value={gsm} onChange={(event) => setGsm(event.target.value)} /></label><label>Passform<input value={fit} onChange={(event) => setFit(event.target.value)} placeholder="z. B. Oversized" /></label><label className="product-form-wide">Konstruktion und Details<textarea value={construction} onChange={(event) => setConstruction(event.target.value)} /></label><button type="button" className="nx-button nx-button--primary" disabled={busy} onClick={() => void saveKnowledge()}>Produktwissen speichern</button></div></details>
      <details open><summary>Produktbilder</summary><div className="product-detail-section"><ReferenceGallery profile={profile} editable busy={busy} onRoleChange={changeRole} />{profile.authority === "MANUAL_PROFILE" ? <form className="product-upload" action={(form) => void uploadReference(form)}><label>Bildrolle<select name="role" defaultValue="FRONT">{REFERENCE_ROLES.map((role) => <option key={role} value={role}>{ownerProductReferenceRoleLabel(role)}</option>)}</select></label><label>Produktfoto<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></label><label>Beschreibung<input name="altText" placeholder="Optional" /></label><button className="nx-button" disabled={busy}><Upload className="size-4" /> Bild privat hochladen</button></form> : <p className="nx-help">Shopify-Bilder werden read-only synchronisiert. Rollen können in NexHQ gepflegt werden.</p>}</div></details>
      <details open><summary>Druckflächen</summary><div className="product-detail-section"><SurfaceList surfaces={profile.printSurfaces} /><div className="product-surface-form"><label>Name<input value={surfaceName} onChange={(event) => setSurfaceName(event.target.value)} /></label><label>Bereich<select value={surfaceRegion} onChange={(event) => setSurfaceRegion(event.target.value as PrintSurface["region"])}><option value="front_center">Vorne mittig</option><option value="front_left_chest">Brust links</option><option value="front_right_chest">Brust rechts</option><option value="back_center">Rückseite mittig</option><option value="left_sleeve">Linker Ärmel</option><option value="right_sleeve">Rechter Ärmel</option><option value="left_leg">Linkes Bein</option><option value="right_leg">Rechtes Bein</option><option value="upper_left_leg">Linkes oberes Bein</option><option value="upper_right_leg">Rechtes oberes Bein</option><option value="custom">Eigener Bereich</option></select></label><label>Variante<select value={surfaceVariant} onChange={(event) => setSurfaceVariant(event.target.value)}><option value="">Alle Varianten</option>{profile.variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.title}</option>)}</select></label><fieldset><legend>Normalisierte Eckpunkte</legend><div className="product-quad-grid">{["OL X", "OL Y", "OR X", "OR Y", "UR X", "UR Y", "UL X", "UL Y"].map((label, index) => <label key={label}>{label}<input type="number" min="0" max="1" step="0.01" value={quad[index]} onChange={(event) => setQuad((current) => current.map((value, item) => item === index ? event.target.value : value))} /></label>)}</div></fieldset><label className="product-attestation"><input type="checkbox" checked={surfaceAttested} onChange={(event) => setSurfaceAttested(event.target.checked)} /> Ich habe die Druckfläche bewusst auf der Produktreferenz definiert.</label><button type="button" className="nx-button" disabled={busy || !surfaceAttested} onClick={() => void saveSurface()}>Druckfläche speichern</button></div></div></details>
      <TechnicalDetails><p>Authority: {profile.authority}</p><p>Profil-ID: {profile.productProfileId}</p><p>Version: {profile.version}</p>{profile.shopifyProductId ? <p>Shopify Produkt-ID: {profile.shopifyProductId}</p> : null}{profile.shopifyLink ? <p>Explizit verknüpft mit: {profile.shopifyLink.shopifyProductId}</p> : null}</TechnicalDetails>
    </div>
  );
}

export function ProductLibraryWorkspace() {
  const [tab, setTab] = useState<"shopify" | "manual">("shopify");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profiles, setProfiles] = useState<ProductProfileView[]>([]);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProfile = profiles.find((profile) => profile.productProfileId === selectedProfileId) ?? null;
  const selectedShopifyProfile = selected ? profiles.find((profile) => profile.shopifyProductId === selected.id) ?? null : null;
  const manualProfiles = useMemo(() => profiles.filter((profile) => profile.authority === "MANUAL_PROFILE"), [profiles]);

  const loadProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [catalogResponse, profilesResponse] = await Promise.all([fetch("/api/shopify/products", { cache: "no-store" }), fetch(PROFILE_API, { cache: "no-store" })]);
      const catalog = await responsePayload<{ products: CatalogProduct[] }>(catalogResponse);
      const profilePayload = await responsePayload<{ profiles: ProductProfileView[] }>(profilesResponse);
      setProducts(catalog.products); setProfiles(profilePayload.profiles);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Produktbibliothek konnte nicht geladen werden."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  function replaceProfile(profile: ProductProfileView) {
    setProfiles((current) => [profile, ...current.filter((item) => item.productProfileId !== profile.productProfileId)]);
    setSelectedProfileId(profile.productProfileId);
  }

  async function openProduct(product: CatalogProduct) {
    setDetailLoading(true); setError(null); setSelectedProfileId(null);
    try {
      const response = await fetch(`/api/shopify/products/${encodeURIComponent(product.id)}`, { cache: "no-store" });
      const payload = await responsePayload<{ product: ProductDetail }>(response); setSelected(payload.product);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Die Produktdetails konnten nicht geladen werden."); }
    finally { setDetailLoading(false); }
  }

  async function createManual(form: FormData) {
    setDetailLoading(true); setError(null); setSuccess(null);
    try {
      const response = await fetch(PROFILE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), productType: form.get("productType"), status: form.get("status"), description: form.get("description") || null, colorways: CSV(String(form.get("colors") ?? "")), sizes: CSV(String(form.get("sizes") ?? "")), collections: [], construction: { material: form.get("material") || null, primaryMaterial: form.get("material") || null, gsm: form.get("gsm") ? Number(form.get("gsm")) : null, fit: form.get("fit") || null, metadataSource: "PRODUCTION_METADATA_MANUAL" } }) });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); replaceProfile(payload.profile); setShowCreate(false); setSuccess("Manuelles Produktprofil wurde gespeichert.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Produktprofil konnte nicht erstellt werden."); }
    finally { setDetailLoading(false); }
  }

  async function createOrSyncShopifyProfile() {
    if (!selected) return;
    setDetailLoading(true); setError(null); setSuccess(null);
    try {
      const response = await fetch("/api/product-library/shopify-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selected.id, expectedVersion: selectedShopifyProfile?.version ?? null }) });
      const payload = await responsePayload<{ profile: ProductProfileView }>(response); replaceProfile(payload.profile); setSuccess("Shopify-Produktwissen wurde read-only synchronisiert. Shopify blieb unverändert.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Shopify-Produktwissen konnte nicht synchronisiert werden."); }
    finally { setDetailLoading(false); }
  }

  return (
    <div className="nx-studio product-library">
      <StudioHeader eyebrow="NexHQ · Produktintelligenz" title="Produktbibliothek" description="Shopify-Katalogwahrheit und manuell gepflegtes Produktionswissen für Image Studio." actions={<button type="button" className="nx-button" onClick={() => void loadProducts()} disabled={loading}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Aktualisieren</button>} />
      <div className="nx-page-content">
        <div className="product-library__tabs" role="tablist" aria-label="Produktquellen"><button type="button" role="tab" aria-selected={tab === "shopify"} className={`nx-tab${tab === "shopify" ? " is-active" : ""}`} onClick={() => setTab("shopify")}><ShoppingBag className="size-4" /> Shopify-Produkte</button><button type="button" role="tab" aria-selected={tab === "manual"} className={`nx-tab${tab === "manual" ? " is-active" : ""}`} onClick={() => setTab("manual")}><Boxes className="size-4" /> Manuelle Produkte</button></div>
        {error ? <div className="nx-notice nx-notice--error" role="alert"><strong>Produktdaten nicht verfügbar</strong><p>{error}</p><button type="button" className="nx-button" onClick={() => void loadProducts()}>Erneut versuchen</button></div> : null}
        {success ? <div className="nx-notice nx-notice--success" role="status"><CheckCircle2 className="size-4" /> {success}</div> : null}
        {loading ? <div className="nx-loading" role="status" aria-live="polite"><span className="nx-spinner" /><strong>Produktbibliothek wird geladen…</strong></div> : tab === "manual" ? (
          <div className="product-library__layout"><section><div className="product-library__section-heading"><div><p className="nx-page-header__eyebrow">Owner-Produktwissen</p><h2>Manuelle Produkte</h2></div><button type="button" className="nx-button nx-button--primary" onClick={() => setShowCreate((value) => !value)}><PackagePlus className="size-4" /> Produkt anlegen</button></div>
            {showCreate ? <form className="nx-card product-create-form" action={(form) => void createManual(form)}><h3>Grunddaten</h3><label>Produktname<input name="name" required /></label><label>Produkttyp<input name="productType" list="product-types" required /><datalist id="product-types">{PRODUCT_TYPE_SUGGESTIONS.map((type) => <option key={type}>{type}</option>)}</datalist></label><label>Status<select name="status" defaultValue="DRAFT"><option value="DRAFT">Entwurf</option><option value="SAMPLE">Muster</option><option value="UPCOMING">Geplant</option><option value="ACTIVE">Aktiv</option></select></label><label>Farben, kommagetrennt<input name="colors" required placeholder="Schwarz, Washed Black" /></label><label>Größen, optional<input name="sizes" placeholder="S, M, L, XL" /></label><label>Material<input name="material" /></label><label>GSM<input name="gsm" type="number" min="1" max="2000" /></label><label>Passform<input name="fit" placeholder="Oversized, Baggy, Regular …" /></label><label className="product-form-wide">Beschreibung<textarea name="description" /></label><button className="nx-button nx-button--primary" disabled={detailLoading}>Produkt speichern</button></form> : null}
            {manualProfiles.length ? <div className="product-library__grid">{manualProfiles.map((profile) => <button key={profile.productProfileId} type="button" className={`nx-card nx-card-button product-card${selectedProfileId === profile.productProfileId ? " nx-card--selected" : ""}`} onClick={() => { setSelected(null); setSelectedProfileId(profile.productProfileId); }}><span className="product-card__image">{profile.references[0]?.previewUrl ? <img src={profile.references[0].previewUrl} alt="" /> : <ImageIcon className="size-8" />}</span><span className="product-card__body"><span className="nx-status">Manuelles Produkt</span><strong>{profile.name}</strong><span>{profile.productType}</span><span>{ownerProductProfileStatusLabel(profile.status)} · Version {profile.version}</span><span>{profile.references.length} Bilder · {profile.printSurfaces.length} Druckflächen</span></span></button>)}</div> : <div className="nx-empty"><strong>Noch kein manuelles Produkt angelegt.</strong><p>Lege Muster, kommende Produkte oder externe Blanks unabhängig von Shopify an.</p></div>}
          </section><aside className="nx-card product-detail">{selectedProfile ? <><p className="nx-page-header__eyebrow">Manuelles Produkt</p><h2>{selectedProfile.name}</h2><p>{selectedProfile.productType} · {ownerProductProfileStatusLabel(selectedProfile.status)}</p><ProfileEditor profile={selectedProfile} onUpdated={replaceProfile} /></> : <div className="nx-empty"><strong>Wähle ein manuelles Produkt aus.</strong><p>Hier verwaltest du Material, Produktbilder und Druckflächen.</p></div>}</aside></div>
        ) : products.length === 0 ? <div className="nx-empty"><strong>Noch keine Shopify-Produkte verfügbar.</strong><p>Prüfe die Shopify-Verbindung und aktualisiere anschließend den Katalog.</p></div> : (
          <div className="product-library__layout"><section><div className="product-library__section-heading"><div><p className="nx-page-header__eyebrow">Live-Katalog</p><h2>Shopify-Produkte</h2></div><span className="nx-status nx-status--success">Shopify verifiziert</span></div><div className="product-library__grid">{products.map((product) => <button key={product.id} type="button" className={`nx-card nx-card-button product-card${selected?.id === product.id ? " nx-card--selected" : ""}`} onClick={() => void openProduct(product)}><span className="product-card__image">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <ImageIcon className="size-8" />}</span><span className="product-card__body"><span className="nx-status nx-status--success">Shopify verifiziert</span><strong>{product.title}</strong><span>{product.productType || "Produkttyp nicht angegeben"}</span><span>{ownerProductStatusLabel(product.status)} · Bestand {product.inventory}</span>{product.colors.length ? <span>Farben: {product.colors.join(", ")}</span> : null}</span></button>)}</div></section>
            <aside className="nx-card product-detail" aria-live="polite">{detailLoading ? <div className="nx-loading"><span className="nx-spinner" />Details werden geladen…</div> : selected ? <><p className="nx-page-header__eyebrow">Shopify verifiziert</p><h2>{selected.title}</h2><p>{selected.productType} · {selected.variants.length} Varianten</p><button type="button" className="nx-button" onClick={() => void createOrSyncShopifyProfile()} disabled={detailLoading}>{selectedShopifyProfile ? "Produktwissen aktualisieren" : "Produktwissen in NexHQ anlegen"}</button>{selectedShopifyProfile ? <ProfileEditor profile={selectedShopifyProfile} onUpdated={replaceProfile} /> : <><h3>Produktbilder</h3><div className="product-detail__images">{selected.imageReferences.map((image) => <figure key={image.id}><img src={image.url} alt={image.altText ?? `${selected.title} Produktreferenz`} /><figcaption>{image.altText || "Nicht klassifiziert"}</figcaption></figure>)}</div><h3>Varianten</h3><ul className="product-detail__variants">{selected.variants.map((variant) => <li key={variant.id}><strong>{variant.title}</strong><span>{variant.available ? "Verfügbar" : "Nicht verfügbar"} · Bestand {variant.inventory}</span></li>)}</ul><p className="nx-help">Speichere das Produktwissen in NexHQ, um Material, Rollen und Druckflächen zu ergänzen. Shopify wird dabei nicht verändert.</p></>}<TechnicalDetails><p>Quelle: Shopify Live-Katalog</p><p>Produkt-ID: {selected.id}</p></TechnicalDetails></> : <div className="nx-empty"><strong>Wähle ein Produkt aus.</strong><p>Hier erscheinen Varianten, Produktreferenzen und NexHQ-Produktwissen.</p></div>}</aside></div>
        )}
      </div>
    </div>
  );
}
