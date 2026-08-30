"use client";

/* eslint-disable @next/next/no-img-element -- authenticated signed previews and Shopify CDN images are dynamic owner data */

import { StudioHeader, TechnicalDetails } from "@/components/studio/studio-ui";
import type { PrintSurface } from "@/lib/image/print-surface/types";
import type {
  ProductProfile,
  ProductReferenceRole,
  ProductVisualReference,
} from "@/lib/product-library/types";
import {
  deriveShopifyProductSourceContext,
  PRODUCT_SOURCE_OWNER_LABELS,
} from "@/lib/product-library/product-source-context";
import { resolveProductFamilyReadiness } from "@/lib/product-library/product-family";
import { invalidateCachedOwnerData } from "@/lib/image/client-owner-data-cache";
import {
  OWNER_PRODUCT_REFERENCE_ROLE_LABELS,
  ownerProductProfileStatusLabel,
  ownerProductReferenceRoleLabel,
  ownerProductStatusLabel,
} from "@/lib/ux/owner-terminology";
import {
  Boxes,
  CheckCircle2,
  ImageIcon,
  PackagePlus,
  RefreshCw,
  ShoppingBag,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CatalogProduct = {
  id: string;
  title: string;
  vendor?: string | null;
  tags: string[];
  status: string;
  inventory: number;
  imageUrl: string | null;
  productType: string;
  collections: string[];
  colors: string[];
};

type ProductDetail = CatalogProduct & {
  description: string;
  imageReferences: Array<{
    id: string;
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  }>;
  variants: Array<{
    id: string;
    title: string;
    available: boolean;
    inventory: number;
    options: Array<{ name: string; value: string }>;
  }>;
};

type OwnerReference = Omit<ProductVisualReference, "privateStoragePath"> & {
  previewUrl?: string | null;
  previewExpiresAt?: string | null;
};
type ProductProfileView = Omit<ProductProfile, "references"> & {
  references: OwnerReference[];
};

const REFERENCE_ROLES = Object.keys(
  OWNER_PRODUCT_REFERENCE_ROLE_LABELS,
) as ProductReferenceRole[];
const CSV = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const PROFILE_API = "/api/product-library/profiles";

function completeness(profile: ProductProfileView) {
  const primaryReferences = profile.references.filter((reference) =>
    ["FEATURED", "FRONT"].includes(reference.role),
  ).length;
  const readySurface = profile.printSurfaces.filter(
    (surface) =>
      surface.geometryStatus !== "REQUIRES_CALIBRATION" && surface.quad,
  ).length;
  return [
    {
      label: "Grunddaten",
      complete: Boolean(profile.name && profile.productType),
    },
    { label: "Varianten", complete: profile.variants.length > 0 },
    {
      label: "Material",
      complete: Boolean(
        profile.construction.primaryMaterial || profile.construction.material,
      ),
    },
    {
      label: "Produktbilder",
      complete: primaryReferences > 0,
      value: `${profile.references.length}`,
    },
    {
      label: "Druckflächen",
      complete: readySurface > 0,
      value: `${readySurface}`,
    },
  ];
}

async function responsePayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      payload.error ?? "Produktdaten konnten nicht gespeichert werden.",
    );
  return payload;
}

function ProductProfileReadiness({ profile }: { profile: ProductProfileView }) {
  if (profile.productFamily) {
    const readiness = resolveProductFamilyReadiness(profile);
    return (
      <div className="product-readiness" aria-label="Image Studio Bereitschaft">
        <strong>{readiness.ready ? "Image Studio bereit" : "Einrichtung unvollständig"}</strong>
        {!readiness.ready ? (
          <ul>
            {readiness.missing.map((item) => (
              <li key={item}><span>○ {item}</span></li>
            ))}
          </ul>
        ) : (
          <p>Mindestens eine Farbe und Seite ist vollständig vorbereitet.</p>
        )}
        <span className={`nx-status ${readiness.ready ? "nx-status--success" : "nx-status--warning"}`}>
          {readiness.ready ? "Image Studio bereit" : "Einrichtung unvollständig"}
        </span>
      </div>
    );
  }
  const checks = completeness(profile);
  return (
    <div
      className="product-readiness"
      aria-label="Vollständigkeit des Produktwissens"
    >
      <strong>Produktwissen</strong>
      <ul>
        {checks.map((check) => (
          <li key={check.label}>
            <span>
              {check.complete ? "✓" : "○"} {check.label}
            </span>
            {check.value ? <em>{check.value}</em> : null}
          </li>
        ))}
      </ul>
      <span
        className={`nx-status ${checks.every((check) => check.complete) ? "nx-status--success" : "nx-status--warning"}`}
      >
        {checks.every((check) => check.complete)
          ? "Image Studio bereit"
          : "Produktwissen ergänzen"}
      </span>
    </div>
  );
}

function ReferenceGallery({
  profile,
  editable,
  busy,
  onRoleChange,
}: {
  profile: ProductProfileView;
  editable: boolean;
  busy: boolean;
  onRoleChange: (
    referenceId: string,
    role: ProductReferenceRole,
  ) => Promise<void>;
}) {
  if (!profile.references.length)
    return (
      <div className="nx-empty">
        <strong>Noch keine Produktbilder.</strong>
        <p>Füge mindestens ein Haupt- oder Vorderseitenbild hinzu.</p>
      </div>
    );
  return (
    <div className="product-detail__images product-detail__images--managed">
      {profile.references.map((reference) => (
        <figure key={reference.referenceId}>
          {reference.previewUrl ? (
            <img
              src={reference.previewUrl}
              alt={reference.altText ?? `${profile.name} Produktreferenz`}
              loading="lazy"
            />
          ) : (
            <span className="product-card__image">
              <ImageIcon className="size-7" />
            </span>
          )}
          <figcaption>
            {editable ? (
              <label>
                Rolle
                <select
                  value={reference.role}
                  disabled={busy}
                  onChange={(event) =>
                    void onRoleChange(
                      reference.referenceId,
                      event.target.value as ProductReferenceRole,
                    )
                  }
                >
                  {REFERENCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ownerProductReferenceRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>{ownerProductReferenceRoleLabel(reference.role)}</span>
            )}
            {reference.width && reference.height ? (
              <span>
                {reference.width} × {reference.height}
              </span>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function SurfaceList({ surfaces }: { surfaces: PrintSurface[] }) {
  if (!surfaces.length)
    return (
      <div className="nx-empty">
        <strong>Keine eigene Produktkalibrierung gespeichert.</strong>
        <p>
          Image Studio verwendet für unterstützte Standardprodukte sichere
          NexHQ-Vorlagen. Sondergeometrie kann hier explizit ergänzt werden.
        </p>
      </div>
    );
  const side = (surface: PrintSurface) =>
    surface.region.startsWith("back") ? "Hinten" : "Vorne / Produktbereich";
  return (
    <div className="product-surface-library">
      {["Vorne / Produktbereich", "Hinten"].map((group) => {
        const grouped = surfaces.filter((surface) => side(surface) === group);
        if (!grouped.length) return null;
        return (
          <section key={group}>
            <h4>{group}</h4>
            <ul className="product-detail__variants">
              {grouped.map((surface) => (
                <li key={`${surface.printSurfaceId}:${surface.version}`}>
                  <strong>{surface.displayName ?? surface.region}</strong>
                  <span>
                    {surface.geometryStatus === "REQUIRES_CALIBRATION"
                      ? "○ Nicht eingerichtet"
                      : "✓ Bereit"}{" "}
                    · Version {surface.version}
                    {surface.reuse?.scope === "PRODUCT_FAMILY"
                      ? ` · Produktfamilie: ${surface.reuse.physicalProductLabel}`
                      : surface.variantId
                        ? " · Variantenbezogen"
                        : " · Für kompatible Varianten"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

type ActionFeedback = {
  state: "idle" | "working" | "success" | "error";
  message: string;
};

function ActionFeedbackLine({ feedback }: { feedback: ActionFeedback }) {
  if (feedback.state === "idle") return null;
  return (
    <p
      className={`product-action-feedback product-action-feedback--${feedback.state}`}
      role={feedback.state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {feedback.state === "working" ? <span className="nx-spinner" /> : null}
      {feedback.state === "success" ? <CheckCircle2 className="size-4" /> : null}
      {feedback.message}
    </p>
  );
}

function CalibrationBoxEditor({
  profile,
  side,
  onUpdated,
}: {
  profile: ProductProfileView;
  side: "FRONT" | "BACK";
  onUpdated: (profile: ProductProfileView) => void;
}) {
  const template = profile.productFamily?.placementTemplates.find(
    (entry) => entry.side === side,
  );
  const overlay = profile.references.find(
    (reference) =>
      reference.purpose === "PRINT_AREA_CALIBRATION" &&
      reference.productSide === side,
  );
  const [box, setBox] = useState(
    template?.normalizedRegion ?? { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  );
  const [editing, setEditing] = useState(template?.status !== "READY");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>({
    state: "idle",
    message: "",
  });
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    box: typeof box;
  } | null>(null);
  const templateSignature = template
    ? `${template.templateId}:${template.version}:${template.status}:${template.normalizedRegion.x}:${template.normalizedRegion.y}:${template.normalizedRegion.width}:${template.normalizedRegion.height}`
    : "none";
  const templateX = template?.normalizedRegion.x;
  const templateY = template?.normalizedRegion.y;
  const templateWidth = template?.normalizedRegion.width;
  const templateHeight = template?.normalizedRegion.height;
  const templateStatus = template?.status;

  useEffect(() => {
    if (
      templateX == null ||
      templateY == null ||
      templateWidth == null ||
      templateHeight == null
    ) return;
    setBox({
      x: templateX,
      y: templateY,
      width: templateWidth,
      height: templateHeight,
    });
    if (templateStatus === "READY") setEditing(false);
  }, [
    templateHeight,
    templateSignature,
    templateStatus,
    templateWidth,
    templateX,
    templateY,
  ]);

  const regionUnchanged = Boolean(
    template &&
      ["x", "y", "width", "height"].every(
        (key) =>
          Math.abs(
            box[key as keyof typeof box] -
              template.normalizedRegion[key as keyof typeof box],
          ) < 0.000001,
      ),
  );
  const needsSave = Boolean(
    template && (template.status !== "READY" || !regionUnchanged),
  );

  function updateBox(next: typeof box) {
    setBox(next);
    setFeedback({ state: "idle", message: "" });
  }

  function pointerStart(
    event: React.PointerEvent,
    mode: "move" | "resize",
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      box,
    };
  }

  function pointerMove(event: React.PointerEvent) {
    const active = drag.current;
    const frame = frameRef.current?.getBoundingClientRect();
    if (!active || !frame) return;
    const dx = (event.clientX - active.startX) / frame.width;
    const dy = (event.clientY - active.startY) / frame.height;
    if (active.mode === "move") {
      updateBox({
        ...active.box,
        x: Math.max(0, Math.min(1 - active.box.width, active.box.x + dx)),
        y: Math.max(0, Math.min(1 - active.box.height, active.box.y + dy)),
      });
      return;
    }
    updateBox({
      ...active.box,
      width: Math.max(0.05, Math.min(1 - active.box.x, active.box.width + dx)),
      height: Math.max(0.05, Math.min(1 - active.box.y, active.box.height + dy)),
    });
  }

  async function upload(file: File) {
    setBusy(true);
    setEditing(true);
    setFeedback({ state: "working", message: "Vorlage wird hochgeladen …" });
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("expectedVersion", String(profile.version));
      form.set("side", side);
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/placement-templates`,
        { method: "POST", body: form },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(response);
      const draft = payload.profile.productFamily?.placementTemplates.find(
        (entry) => entry.side === side,
      );
      if (draft) setBox(draft.normalizedRegion);
      onUpdated(payload.profile);
      setFeedback({
        state: "success",
        message:
          draft?.detection === "MANUAL_REQUIRED"
            ? "Vorlage hochgeladen ✓ · Rechteck bitte visuell festlegen."
            : "Vorlage hochgeladen ✓ · Druckfläche erkannt ✓",
      });
    } catch {
      setFeedback({
        state: "error",
        message: "Upload fehlgeschlagen. Erneut versuchen.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!template || !needsSave) return;
    setBusy(true);
    setFeedback({ state: "working", message: "Druckfläche wird gespeichert …" });
    try {
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/placement-templates`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: profile.version,
            side,
            normalizedRegion: box,
          }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(response);
      const saved = payload.profile.productFamily?.placementTemplates.find(
        (entry) => entry.side === side,
      );
      if (saved) setBox(saved.normalizedRegion);
      onUpdated(payload.profile);
      setFeedback({ state: "success", message: "Druckfläche gespeichert ✓" });
      setEditing(false);
    } catch {
      setFeedback({
        state: "error",
        message: "Druckfläche konnte nicht gespeichert werden.",
      });
    } finally {
      setBusy(false);
    }
  }

  const sideLabel = side === "FRONT" ? "Vorne" : "Hinten";
  if (template?.status === "READY" && !editing) {
    return (
      <section className="product-family-calibration product-family-calibration--compact">
        <div className="product-family-calibration__saved">
          {overlay?.previewUrl ? (
            <img src={overlay.previewUrl} alt={`${profile.name} ${sideLabel} Druckfläche`} />
          ) : (
            <span className="product-card__image"><ImageIcon className="size-6" /></span>
          )}
          <div>
            <h4>{sideLabel}</h4>
            <p><CheckCircle2 className="size-4" /> Druckfläche bereit</p>
          </div>
          <button
            type="button"
            className="nx-button"
            onClick={() => {
              setEditing(true);
              setFeedback({ state: "idle", message: "" });
            }}
          >
            Bearbeiten
          </button>
        </div>
        <ActionFeedbackLine feedback={feedback} />
      </section>
    );
  }

  return (
    <section className="product-family-calibration product-family-calibration--editing">
      <div className="product-family-calibration__head">
        <div>
          <h4>{sideLabel}</h4>
          <p>{template ? "Rechteck prüfen" : "Noch nicht eingerichtet"}</p>
        </div>
        <label className="nx-button">
          {overlay ? "Vorlage ersetzen" : "MarketPrint-Bild hochladen"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      <ActionFeedbackLine feedback={feedback} />
      {overlay?.previewUrl && template ? (
        <>
          <div
            ref={frameRef}
            className="product-family-calibration__frame"
            onPointerMove={pointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <img src={overlay.previewUrl} alt={`${profile.name} Druckflächen-Kalibrierung`} />
            <div
              className="product-family-calibration__box"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              onPointerDown={(event) => pointerStart(event, "move")}
            >
              <span>Erlaubter Druckbereich</span>
              <button
                type="button"
                aria-label="Druckfläche skalieren"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  pointerStart(event, "resize");
                }}
              />
            </div>
          </div>
          <div className="is-staging-actions">
            {needsSave ? (
              <button
                type="button"
                className="nx-button nx-button--primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy
                  ? "Druckfläche wird gespeichert …"
                  : template.status === "READY"
                    ? "Änderungen speichern"
                    : "Druckfläche speichern"}
              </button>
            ) : (
              <span className="product-calibration-clean"><CheckCircle2 className="size-4" /> Gespeichert ✓</span>
            )}
            <button
              type="button"
              className="nx-button"
              disabled={busy}
              onClick={() => {
                updateBox(template.normalizedRegion);
                if (template.status === "READY") setEditing(false);
              }}
            >
              {template.status === "READY" ? "Schließen" : "Zurücksetzen"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function BlankAssetUploader({
  profile,
  colorKey,
  colorName,
  side,
  reference,
  onUpdated,
}: {
  profile: ProductProfileView;
  colorKey: string;
  colorName: string;
  side: "FRONT" | "BACK";
  reference: ProductProfileView["references"][number] | undefined;
  onUpdated: (profile: ProductProfileView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmedReference, setConfirmedReference] = useState(reference);
  const [feedback, setFeedback] = useState<ActionFeedback>({ state: "idle", message: "" });
  useEffect(() => setConfirmedReference(reference), [reference]);
  const displayed = reference ?? confirmedReference;
  const sideLabel = side === "FRONT" ? "Vorne" : "Hinten";

  async function upload(file: File) {
    setBusy(true);
    setFeedback({ state: "working", message: "Wird hochgeladen …" });
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("expectedVersion", String(profile.version));
      form.set("role", side);
      form.set("purpose", "BLANK_PRODUCT");
      form.set("familyColorKey", colorKey);
      form.set("productSide", side);
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/references`,
        { method: "POST", body: form },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(response);
      const persisted = payload.profile.references.find(
        (item) =>
          item.purpose === "BLANK_PRODUCT" &&
          item.familyColorKey === colorKey &&
          item.productSide === side,
      );
      setConfirmedReference(persisted);
      onUpdated(payload.profile);
      setFeedback({ state: "success", message: "Hochgeladen ✓" });
    } catch {
      setFeedback({ state: "error", message: "Upload fehlgeschlagen. Erneut versuchen." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-family-blank-slot">
      {displayed?.previewUrl ? (
        <img src={displayed.previewUrl} alt={`${colorName} ${sideLabel}`} />
      ) : (
        <span className="product-card__image"><ImageIcon className="size-6" /></span>
      )}
      <div className="product-family-blank-slot__body">
        <strong>{sideLabel}</strong>
        <span className={displayed ? "is-uploaded" : ""}>
          {busy ? "Wird hochgeladen …" : displayed ? "✓ Hochgeladen" : "Noch kein Bild"}
        </span>
        <ActionFeedbackLine feedback={feedback} />
      </div>
      <label className="nx-button">
        {displayed ? "Ersetzen" : "Blank hochladen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
    </div>
  );
}

function ProductFamilyEditor({
  profile,
  shopifyProducts,
  onUpdated,
}: {
  profile: ProductProfileView;
  shopifyProducts: CatalogProduct[];
  onUpdated: (profile: ProductProfileView) => void;
}) {
  const family = profile.productFamily;
  const [busy, setBusy] = useState(false);
  const [colorFeedback, setColorFeedback] = useState<ActionFeedback>({ state: "idle", message: "" });
  const [shopifyFeedback, setShopifyFeedback] = useState<ActionFeedback>({ state: "idle", message: "" });
  if (!family) return null;

  async function addColor(form: FormData) {
    setBusy(true);
    setColorFeedback({ state: "working", message: "Farbe wird gespeichert …" });
    try {
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/colors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: profile.version, colorName: form.get("colorName") }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(response);
      onUpdated(payload.profile);
      setColorFeedback({ state: "success", message: "Farbe gespeichert ✓" });
    } catch {
      setColorFeedback({ state: "error", message: "Farbe konnte nicht gespeichert werden." });
    } finally {
      setBusy(false);
    }
  }

  async function mapShopify(form: FormData) {
    setBusy(true);
    setShopifyFeedback({ state: "working", message: "Shopify-Zuordnung wird gespeichert …" });
    try {
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/link-shopify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: profile.version,
            ownerAttestation: true,
            colorKey: form.get("colorKey"),
            shopifyProductId: form.get("shopifyProductId"),
            shopifyVariantIds: [],
          }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(response);
      onUpdated(payload.profile);
      setShopifyFeedback({ state: "success", message: "Shopify-Zuordnung gespeichert ✓" });
    } catch {
      setShopifyFeedback({ state: "error", message: "Shopify-Zuordnung konnte nicht gespeichert werden." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-family-editor">
      <details open>
        <summary>Farben</summary>
        <div className="product-detail-section">
          <div className="product-family-colors">
            {family.colors.map((color) => (
              <section key={color.colorId} className="nx-card">
                <h4>{color.colorName}</h4>
                <div className="product-family-blanks">
                  {(["FRONT", "BACK"] as const).map((side) => {
                    const reference = profile.references.find(
                      (item) => item.purpose === "BLANK_PRODUCT" && item.familyColorKey === color.colorKey && item.productSide === side,
                    );
                    return (
                      <BlankAssetUploader
                        key={side}
                        profile={profile}
                        colorKey={color.colorKey}
                        colorName={color.colorName}
                        side={side}
                        reference={reference}
                        onUpdated={onUpdated}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <form className="product-upload" action={(form) => void addColor(form)}>
            <label>Farbname<input name="colorName" required placeholder="z. B. Babyblau" /></label>
            <button className="nx-button nx-button--primary" disabled={busy}>Farbe hinzufügen</button>
          </form>
          <ActionFeedbackLine feedback={colorFeedback} />
        </div>
      </details>
      <details open>
        <summary>Druckfläche</summary>
        <div className="product-detail-section">
          <p className="nx-help">Ein grünes Front- und Back-Bild genügt für alle Farben dieser Produktfamilie.</p>
          <CalibrationBoxEditor profile={profile} side="FRONT" onUpdated={onUpdated} />
          <CalibrationBoxEditor profile={profile} side="BACK" onUpdated={onUpdated} />
        </div>
      </details>
      <details>
        <summary>Shopify-Zuordnung (optional)</summary>
        <div className="product-detail-section">
          <p className="nx-help">
            Verknüpft eine Farbe im Hintergrund mit einem verifizierten
            Shopify-Produkt. Im Image Studio bleibt die Produktfamilie der
            einfache Auswahlbegriff.
          </p>
          <form className="product-upload" action={(form) => void mapShopify(form)}>
            <label>
              Farbe
              <select name="colorKey" required>
                <option value="">Farbe auswählen</option>
                {family.colors.map((color) => (
                  <option key={color.colorId} value={color.colorKey}>{color.colorName}</option>
                ))}
              </select>
            </label>
            <label>
              Shopify-Produkt
              <select name="shopifyProductId" required>
                <option value="">Shopify-Produkt auswählen</option>
                {shopifyProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.title}</option>
                ))}
              </select>
            </label>
            <button className="nx-button" disabled={busy}>Zuordnen</button>
          </form>
          <ActionFeedbackLine feedback={shopifyFeedback} />
        </div>
      </details>
    </div>
  );
}

function ProfileEditor({
  profile,
  onUpdated,
  familyContent,
}: {
  profile: ProductProfileView;
  onUpdated: (profile: ProductProfileView) => void;
  familyContent?: ReactNode;
}) {
  const familyMode = Boolean(profile.productFamily);
  const [busy, setBusy] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [productSaveFeedback, setProductSaveFeedback] =
    useState<ActionFeedback>({ state: "idle", message: "" });
  const [material, setMaterial] = useState(
    profile.construction.primaryMaterial ?? profile.construction.material ?? "",
  );
  const [gsm, setGsm] = useState(profile.construction.gsm?.toString() ?? "");
  const [fit, setFit] = useState(profile.construction.fit ?? "");
  const [construction, setConstruction] = useState(
    profile.construction.otherNotes ?? profile.construction.construction ?? "",
  );
  const [surfaceRegion, setSurfaceRegion] =
    useState<PrintSurface["region"]>("front_center");
  const [surfaceName, setSurfaceName] = useState("Vorne mittig");
  const [surfaceVariant, setSurfaceVariant] = useState("");
  const [surfaceAttested, setSurfaceAttested] = useState(false);
  const [quad, setQuad] = useState([
    "0.32",
    "0.30",
    "0.68",
    "0.30",
    "0.67",
    "0.70",
    "0.33",
    "0.70",
  ]);

  useEffect(() => {
    setMaterial(
      profile.construction.primaryMaterial ??
        profile.construction.material ??
        "",
    );
    setGsm(profile.construction.gsm?.toString() ?? "");
    setFit(profile.construction.fit ?? "");
    setConstruction(
      profile.construction.otherNotes ??
        profile.construction.construction ??
        "",
    );
  }, [profile]);

  async function saveKnowledge() {
    setBusy(true);
    setProductSaving(true);
    setMessage(null);
    setProductSaveFeedback({
      state: "working",
      message: "Produktdaten werden gespeichert …",
    });
    try {
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: profile.version,
            construction: {
              material: material || null,
              primaryMaterial: material || null,
              materials: material ? [{ name: material, percentage: null }] : [],
              gsm: gsm ? Number(gsm) : null,
              fit: fit || null,
              otherNotes: construction || null,
              metadataSource: "PRODUCTION_METADATA_MANUAL",
            },
          }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      onUpdated(payload.profile);
      setProductSaveFeedback({ state: "success", message: "Gespeichert ✓" });
    } catch (error) {
      setProductSaveFeedback({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Produktdaten konnten nicht gespeichert werden.",
      });
    } finally {
      setProductSaving(false);
      setBusy(false);
    }
  }

  async function uploadReference(form: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      form.set("expectedVersion", String(profile.version));
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/references`,
        { method: "POST", body: form },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      onUpdated(payload.profile);
      setMessage("Produktbild privat gespeichert.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Produktbild konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(referenceId: string, role: ProductReferenceRole) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/references/${encodeURIComponent(referenceId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: profile.version, role }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      onUpdated(payload.profile);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Referenzrolle konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSurface() {
    if (!surfaceAttested) {
      setMessage(
        "Bestätige zuerst, dass du die Druckfläche bewusst definiert hast.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const numbers = quad.map(Number);
      const response = await fetch(
        `${PROFILE_API}/${encodeURIComponent(profile.productProfileId)}/surfaces`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: profile.version,
            printSurfaceId: `${surfaceRegion}:${surfaceVariant || "all"}`,
            displayName: surfaceName,
            region: surfaceRegion,
            variantId: surfaceVariant || null,
            surfaceKind: "PRINT",
            supportedPrintMethods: profile.construction.supportedPrintMethods,
            quad: [
              [numbers[0], numbers[1]],
              [numbers[2], numbers[3]],
              [numbers[4], numbers[5]],
              [numbers[6], numbers[7]],
            ].map(([x, y]) => ({ x, y })),
            calibrationAttestation: true,
          }),
        },
      );
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      onUpdated(payload.profile);
      setSurfaceAttested(false);
      setMessage("Druckfläche als neue Produktversion gespeichert.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Druckfläche konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-profile-editor">
      {message ? (
        <div className="nx-notice" role="status">
          {message}
        </div>
      ) : null}
      {!familyMode ? <details open>
        <summary>Übersicht</summary>
        <div className="product-detail-section">
          <p>{profile.description || "Keine Beschreibung hinterlegt."}</p>
          <p>
            <strong>Produktquelle:</strong>{" "}
            {PRODUCT_SOURCE_OWNER_LABELS[profile.sourceContext.sourceProvider]}
            {profile.sourceContext.authority === "SHOPIFY_METADATA"
              ? " · durch Shopify-Metadaten belegt"
              : profile.sourceContext.authority === "OWNER_CONFIRMED"
                ? " · vom Owner bestätigt"
                : ""}
          </p>
          <ProductProfileReadiness profile={profile} />
        </div>
      </details> : null}
      {!familyMode ? <details>
        <summary>Varianten</summary>
        <div className="product-detail-section">
          <ul className="product-detail__variants">
            {profile.variants.map((variant) => (
              <li key={variant.variantId}>
                <strong>{variant.title}</strong>
                <span>
                  {variant.color ?? "Keine Farbe"}
                  {variant.size ? ` · ${variant.size}` : ""} ·{" "}
                  {variant.available == null
                    ? "Verfügbarkeit unbekannt"
                    : variant.available
                      ? "Verfügbar"
                      : "Nicht verfügbar"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details> : null}
      <details open>
        <summary>{familyMode ? "Produkt" : "Material & Stoff"}</summary>
        <div className="product-detail-section product-form-grid">
          {familyMode ? (
            <div className="product-form-wide product-family-product-summary">
              <p>{profile.description || "Keine Beschreibung hinterlegt."}</p>
              <p>
                <strong>Bekleidungstyp:</strong> {profile.productType} ·{" "}
                <strong>Lieferant:</strong>{" "}
                {profile.productFamily?.supplierName || "Nicht angegeben"}
              </p>
              <ProductProfileReadiness profile={profile} />
            </div>
          ) : null}
          <label>
            Primärmaterial
            <input
              value={material}
              onChange={(event) => {
                setMaterial(event.target.value);
                setProductSaveFeedback({ state: "idle", message: "" });
              }}
              placeholder="z. B. 100 % Baumwolle"
            />
          </label>
          <label>
            GSM
            <input
              type="number"
              min="1"
              max="2000"
              value={gsm}
              onChange={(event) => {
                setGsm(event.target.value);
                setProductSaveFeedback({ state: "idle", message: "" });
              }}
            />
          </label>
          <label>
            Passform
            <input
              value={fit}
              onChange={(event) => {
                setFit(event.target.value);
                setProductSaveFeedback({ state: "idle", message: "" });
              }}
              placeholder="z. B. Oversized"
            />
          </label>
          <label className="product-form-wide">
            Konstruktion und Details
            <textarea
              value={construction}
              onChange={(event) => {
                setConstruction(event.target.value);
                setProductSaveFeedback({ state: "idle", message: "" });
              }}
            />
          </label>
          <button
            type="button"
            className="nx-button nx-button--primary"
            disabled={busy}
            onClick={() => void saveKnowledge()}
          >
            {productSaving ? "Produktdaten werden gespeichert …" : "Produktdaten speichern"}
          </button>
          <ActionFeedbackLine feedback={productSaveFeedback} />
        </div>
      </details>
      {familyContent}
      {!familyMode ? <details open>
        <summary>Produktbilder</summary>
        <div className="product-detail-section">
          <ReferenceGallery
            profile={profile}
            editable
            busy={busy}
            onRoleChange={changeRole}
          />
          {profile.authority === "MANUAL_PROFILE" ? (
            <form
              className="product-upload"
              action={(form) => void uploadReference(form)}
            >
              <label>
                Bildrolle
                <select name="role" defaultValue="FRONT">
                  {REFERENCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ownerProductReferenceRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Produktfoto
                <input
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                />
              </label>
              <label>
                Beschreibung
                <input name="altText" placeholder="Optional" />
              </label>
              <button className="nx-button" disabled={busy}>
                <Upload className="size-4" /> Bild privat hochladen
              </button>
            </form>
          ) : (
            <p className="nx-help">
              Shopify-Bilder werden read-only synchronisiert. Rollen können in
              NexHQ gepflegt werden.
            </p>
          )}
        </div>
      </details> : null}
      <details className="nx-technical">
        <summary>
          {familyMode
            ? "Technische Details"
            : "Technische Produktdaten · Druckflächen kalibrieren"}
        </summary>
        <div className="product-detail-section">
          {familyMode ? (
            <>
              <h4>Referenzen und Rollen</h4>
              <ReferenceGallery
                profile={profile}
                editable
                busy={busy}
                onRoleChange={changeRole}
              />
              <h4>Varianten</h4>
              <ul className="product-detail__variants">
                {profile.variants.map((variant) => (
                  <li key={variant.variantId}>
                    <strong>{variant.title}</strong>
                    <span>{variant.color ?? "Keine Farbe"}{variant.size ? ` · ${variant.size}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="nx-help">
            Optional für Sonderprodukte oder eine präzisere, owner-definierte
            Produktgeometrie. Diese Einstellungen sind vom Artwork unabhängig
            und überschreiben die Standardvorlage nur für das Produkt.
          </p>
          <SurfaceList surfaces={profile.printSurfaces} />
          <div className="product-surface-form">
            <label>
              Name
              <input
                value={surfaceName}
                onChange={(event) => setSurfaceName(event.target.value)}
              />
            </label>
            <label>
              Bereich
              <select
                value={surfaceRegion}
                onChange={(event) =>
                  setSurfaceRegion(event.target.value as PrintSurface["region"])
                }
              >
                <option value="front_center">Vorne mittig</option>
                <option value="front_left_chest">Brust links</option>
                <option value="front_right_chest">Brust rechts</option>
                <option value="back_center">Rückseite mittig</option>
                <option value="left_sleeve">Linker Ärmel</option>
                <option value="right_sleeve">Rechter Ärmel</option>
                <option value="left_leg">Linkes Bein</option>
                <option value="right_leg">Rechtes Bein</option>
                <option value="upper_left_leg">Linkes oberes Bein</option>
                <option value="upper_right_leg">Rechtes oberes Bein</option>
                <option value="custom">Eigener Bereich</option>
              </select>
            </label>
            <label>
              Variante
              <select
                value={surfaceVariant}
                onChange={(event) => setSurfaceVariant(event.target.value)}
              >
                <option value="">Alle Varianten</option>
                {profile.variants.map((variant) => (
                  <option key={variant.variantId} value={variant.variantId}>
                    {variant.title}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Normalisierte Eckpunkte</legend>
              <div className="product-quad-grid">
                {[
                  "OL X",
                  "OL Y",
                  "OR X",
                  "OR Y",
                  "UR X",
                  "UR Y",
                  "UL X",
                  "UL Y",
                ].map((label, index) => (
                  <label key={label}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={quad[index]}
                      onChange={(event) =>
                        setQuad((current) =>
                          current.map((value, item) =>
                            item === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="product-attestation">
              <input
                type="checkbox"
                checked={surfaceAttested}
                onChange={(event) => setSurfaceAttested(event.target.checked)}
              />{" "}
              Ich habe die Druckfläche bewusst auf der Produktreferenz
              definiert.
            </label>
            <button
              type="button"
              className="nx-button"
              disabled={busy || !surfaceAttested}
              onClick={() => void saveSurface()}
            >
              Druckfläche speichern
            </button>
          </div>
        </div>
      </details>
      <TechnicalDetails>
        <p>Authority: {profile.authority}</p>
        <p>Profil-ID: {profile.productProfileId}</p>
        <p>Version: {profile.version}</p>
        {profile.shopifyProductId ? (
          <p>Shopify Produkt-ID: {profile.shopifyProductId}</p>
        ) : null}
        {profile.shopifyLink ? (
          <p>Explizit verknüpft mit: {profile.shopifyLink.shopifyProductId}</p>
        ) : null}
      </TechnicalDetails>
    </div>
  );
}

export function ProductLibraryWorkspace() {
  const [tab, setTab] = useState<"shopify" | "manual">("shopify");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profiles, setProfiles] = useState<ProductProfileView[]>([]);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProfile =
    profiles.find(
      (profile) => profile.productProfileId === selectedProfileId,
    ) ?? null;
  const selectedShopifyProfile = selected
    ? (profiles.find((profile) => profile.shopifyProductId === selected.id) ??
      null)
    : null;
  const manualProfiles = useMemo(
    () => profiles.filter((profile) => profile.authority === "MANUAL_PROFILE"),
    [profiles],
  );
  const selectedSource = selected
    ? deriveShopifyProductSourceContext({
        vendor: selected.vendor,
        tags: selected.tags,
        capturedAt: new Date().toISOString(),
      })
    : null;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogResponse, profilesResponse] = await Promise.all([
        fetch("/api/shopify/products", { cache: "no-store" }),
        fetch(PROFILE_API, { cache: "no-store" }),
      ]);
      const catalog = await responsePayload<{ products: CatalogProduct[] }>(
        catalogResponse,
      );
      const profilePayload = await responsePayload<{
        profiles: ProductProfileView[];
      }>(profilesResponse);
      setProducts(catalog.products);
      setProfiles(profilePayload.profiles);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Produktbibliothek konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function replaceProfile(profile: ProductProfileView) {
    invalidateCachedOwnerData("image:product-family-production");
    setProfiles((current) => [
      profile,
      ...current.filter(
        (item) => item.productProfileId !== profile.productProfileId,
      ),
    ]);
    setSelectedProfileId(profile.productProfileId);
  }

  async function openProduct(product: CatalogProduct) {
    setDetailLoading(true);
    setError(null);
    setSelectedProfileId(null);
    try {
      const response = await fetch(
        `/api/shopify/products/${encodeURIComponent(product.id)}`,
        { cache: "no-store" },
      );
      const payload = await responsePayload<{ product: ProductDetail }>(
        response,
      );
      setSelected(payload.product);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Produktdetails konnten nicht geladen werden.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function createManual(form: FormData) {
    setDetailLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(PROFILE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          productType: form.get("productType"),
          status: form.get("status"),
          description: form.get("description") || null,
          colorways: CSV(String(form.get("colors") ?? "")),
          sizes: CSV(String(form.get("sizes") ?? "")),
          collections: [],
          construction: {
            material: form.get("material") || null,
            primaryMaterial: form.get("material") || null,
            gsm: form.get("gsm") ? Number(form.get("gsm")) : null,
            fit: form.get("fit") || null,
            metadataSource: "PRODUCTION_METADATA_MANUAL",
          },
          productFamily: {
            enabled: true,
            supplierName: form.get("supplier") || null,
          },
        }),
      });
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      replaceProfile(payload.profile);
      setShowCreate(false);
      setSuccess("Produktfamilie wurde gespeichert.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Produktprofil konnte nicht erstellt werden.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function createOrSyncShopifyProfile() {
    if (!selected) return;
    setDetailLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/product-library/shopify-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          expectedVersion: selectedShopifyProfile?.version ?? null,
        }),
      });
      const payload = await responsePayload<{ profile: ProductProfileView }>(
        response,
      );
      replaceProfile(payload.profile);
      setSuccess(
        "Shopify-Produktwissen wurde read-only synchronisiert. Shopify blieb unverändert.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Shopify-Produktwissen konnte nicht synchronisiert werden.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="nx-studio product-library">
      <StudioHeader
        eyebrow="Xeriamo · Produktintelligenz"
        title="Produktbibliothek"
        description="Shopify-Katalogwahrheit und manuell gepflegtes Produktionswissen für Image Studio."
        actions={
          <button
            type="button"
            className="nx-button"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />{" "}
            Aktualisieren
          </button>
        }
      />
      <div className="nx-page-content">
        <div
          className="product-library__tabs"
          role="tablist"
          aria-label="Produktquellen"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "shopify"}
            className={`nx-tab${tab === "shopify" ? " is-active" : ""}`}
            onClick={() => setTab("shopify")}
          >
            <ShoppingBag className="size-4" /> Shopify-Produkte
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "manual"}
            className={`nx-tab${tab === "manual" ? " is-active" : ""}`}
            onClick={() => setTab("manual")}
          >
            <Boxes className="size-4" /> Produktfamilien
          </button>
        </div>
        {error ? (
          <div className="nx-notice nx-notice--error" role="alert">
            <strong>Produktdaten nicht verfügbar</strong>
            <p>{error}</p>
            <button
              type="button"
              className="nx-button"
              onClick={() => void loadProducts()}
            >
              Erneut versuchen
            </button>
          </div>
        ) : null}
        {success ? (
          <div className="nx-notice nx-notice--success" role="status">
            <CheckCircle2 className="size-4" /> {success}
          </div>
        ) : null}
        {loading ? (
          <div className="nx-loading" role="status" aria-live="polite">
            <span className="nx-spinner" />
            <strong>Produktbibliothek wird geladen…</strong>
          </div>
        ) : tab === "manual" ? (
          <div className="product-library__layout">
            <section>
              <div className="product-library__section-heading">
                <div>
                  <p className="nx-page-header__eyebrow">Owner-Produktwissen</p>
                  <h2>Produktfamilien</h2>
                </div>
                <button
                  type="button"
                  className="nx-button nx-button--primary"
                  onClick={() => setShowCreate((value) => !value)}
                >
                  <PackagePlus className="size-4" /> Produktkategorie hinzufügen
                </button>
              </div>
              {showCreate ? (
                <form
                  className="nx-card product-create-form"
                  action={(form) => void createManual(form)}
                >
                  <h3>Grunddaten</h3>
                  <label>
                    Name
                    <input name="name" required placeholder="z. B. Vacancy T-Shirt" />
                  </label>
                  <label>
                    Bekleidungstyp
                    <select name="productType" required defaultValue="T-Shirt">
                      <option>T-Shirt</option>
                      <option>Hoodie</option>
                      <option>Zip Hoodie</option>
                      <option>Jogger</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue="ACTIVE">
                      <option value="DRAFT">Entwurf</option>
                      <option value="SAMPLE">Muster</option>
                      <option value="UPCOMING">Geplant</option>
                      <option value="ACTIVE">Aktiv</option>
                    </select>
                  </label>
                  <input name="colors" type="hidden" value="" readOnly />
                  <label>
                    Lieferant, optional
                    <input name="supplier" placeholder="z. B. MarketPrint" />
                  </label>
                  <label>
                    Größen, optional
                    <input name="sizes" placeholder="S, M, L, XL" />
                  </label>
                  <label>
                    Material
                    <input name="material" />
                  </label>
                  <label>
                    GSM
                    <input name="gsm" type="number" min="1" max="2000" />
                  </label>
                  <label>
                    Passform
                    <input
                      name="fit"
                      placeholder="Oversized, Baggy, Regular …"
                    />
                  </label>
                  <label className="product-form-wide">
                    Beschreibung
                    <textarea name="description" />
                  </label>
                  <button
                    className="nx-button nx-button--primary"
                    disabled={detailLoading}
                  >
                    Produktfamilie speichern
                  </button>
                </form>
              ) : null}
              {manualProfiles.length ? (
                <div className="product-library__grid">
                  {manualProfiles.map((profile) => (
                    <button
                      key={profile.productProfileId}
                      type="button"
                      className={`nx-card nx-card-button product-card${selectedProfileId === profile.productProfileId ? " nx-card--selected" : ""}`}
                      onClick={() => {
                        setSelected(null);
                        setSelectedProfileId(profile.productProfileId);
                      }}
                    >
                      <span className="product-card__image">
                        {profile.references[0]?.previewUrl ? (
                          <img src={profile.references[0].previewUrl} alt="" />
                        ) : (
                          <ImageIcon className="size-8" />
                        )}
                      </span>
                      <span className="product-card__body">
                        <span className="nx-status">Produktfamilie</span>
                        <strong>{profile.name}</strong>
                        <span>{profile.productType}</span>
                        <span>
                          {ownerProductProfileStatusLabel(profile.status)} ·
                          Version {profile.version}
                        </span>
                        <span>
                          {profile.references.length} Bilder ·{" "}
                          {profile.printSurfaces.length} Druckflächen
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="nx-empty">
                  <strong>Noch keine Produktfamilie angelegt.</strong>
                  <p>
                    Lege einen physischen Blank an und ergänze Farben,
                    Produktbilder und Druckflächen.
                  </p>
                </div>
              )}
            </section>
            <aside className="nx-card product-detail">
              {selectedProfile ? (
                <>
                  <p className="nx-page-header__eyebrow">Produktfamilie</p>
                  <h2>{selectedProfile.name}</h2>
                  <p>
                    {selectedProfile.productType} ·{" "}
                    {ownerProductProfileStatusLabel(selectedProfile.status)}
                  </p>
                  <ProfileEditor
                    profile={selectedProfile}
                    onUpdated={replaceProfile}
                    familyContent={
                      selectedProfile.productFamily ? (
                        <ProductFamilyEditor
                          profile={selectedProfile}
                          shopifyProducts={products}
                          onUpdated={replaceProfile}
                        />
                      ) : null
                    }
                  />
                </>
              ) : (
                <div className="nx-empty">
                  <strong>Wähle eine Produktfamilie aus.</strong>
                  <p>
                    Hier verwaltest du Material, Produktbilder und Druckflächen.
                  </p>
                </div>
              )}
            </aside>
          </div>
        ) : products.length === 0 ? (
          <div className="nx-empty">
            <strong>Noch keine Shopify-Produkte verfügbar.</strong>
            <p>
              Prüfe die Shopify-Verbindung und aktualisiere anschließend den
              Katalog.
            </p>
          </div>
        ) : (
          <div className="product-library__layout">
            <section>
              <div className="product-library__section-heading">
                <div>
                  <p className="nx-page-header__eyebrow">Live-Katalog</p>
                  <h2>Shopify-Produkte</h2>
                </div>
                <span className="nx-status nx-status--success">
                  Shopify verifiziert
                </span>
              </div>
              <div className="product-library__grid">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`nx-card nx-card-button product-card${selected?.id === product.id ? " nx-card--selected" : ""}`}
                    onClick={() => void openProduct(product)}
                  >
                    <span className="product-card__image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <ImageIcon className="size-8" />
                      )}
                    </span>
                    <span className="product-card__body">
                      <span className="nx-status nx-status--success">
                        Shopify verifiziert
                      </span>
                      <strong>{product.title}</strong>
                      <span>
                        {product.productType || "Produkttyp nicht angegeben"}
                      </span>
                      <span>
                        {ownerProductStatusLabel(product.status)} · Bestand{" "}
                        {product.inventory}
                      </span>
                      {product.colors.length ? (
                        <span>Farben: {product.colors.join(", ")}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <aside className="nx-card product-detail" aria-live="polite">
              {detailLoading ? (
                <div className="nx-loading">
                  <span className="nx-spinner" />
                  Details werden geladen…
                </div>
              ) : selected ? (
                <>
                  <p className="nx-page-header__eyebrow">Shopify verifiziert</p>
                  <h2>{selected.title}</h2>
                  <p>
                    {selected.productType} · {selected.variants.length}{" "}
                    Varianten
                  </p>
                  <p>
                    <strong>Produktquelle:</strong>{" "}
                    {
                      PRODUCT_SOURCE_OWNER_LABELS[
                        selectedSource?.sourceProvider ?? "UNKNOWN"
                      ]
                    }
                    {selectedSource?.authority === "SHOPIFY_METADATA"
                      ? " · durch Shopify-Metadaten belegt"
                      : ""}
                  </p>
                  <button
                    type="button"
                    className="nx-button"
                    onClick={() => void createOrSyncShopifyProfile()}
                    disabled={detailLoading}
                  >
                    {selectedShopifyProfile
                      ? "Produktwissen aktualisieren"
                      : "Produktwissen in NexHQ anlegen"}
                  </button>
                  {selectedShopifyProfile ? (
                    <ProfileEditor
                      profile={selectedShopifyProfile}
                      onUpdated={replaceProfile}
                    />
                  ) : (
                    <>
                      <h3>Produktbilder</h3>
                      <div className="product-detail__images">
                        {selected.imageReferences.map((image) => (
                          <figure key={image.id}>
                            <img
                              src={image.url}
                              alt={
                                image.altText ??
                                `${selected.title} Produktreferenz`
                              }
                            />
                            <figcaption>
                              {image.altText || "Nicht klassifiziert"}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                      <h3>Varianten</h3>
                      <ul className="product-detail__variants">
                        {selected.variants.map((variant) => (
                          <li key={variant.id}>
                            <strong>{variant.title}</strong>
                            <span>
                              {variant.available
                                ? "Verfügbar"
                                : "Nicht verfügbar"}{" "}
                              · Bestand {variant.inventory}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="nx-help">
                        Speichere das Produktwissen in NexHQ, um Material,
                        Rollen und Druckflächen zu ergänzen. Shopify wird dabei
                        nicht verändert.
                      </p>
                    </>
                  )}
                  <TechnicalDetails>
                    <p>Quelle: Shopify Live-Katalog</p>
                    <p>Produkt-ID: {selected.id}</p>
                    <p>
                      Shopify Vendor: {selected.vendor ?? "Nicht angegeben"}
                    </p>
                    <p>
                      Quellnachweise:{" "}
                      {selectedSource?.evidence
                        .map((item) => `${item.field}: ${item.value}`)
                        .join(" · ") || "Keine verifizierbaren Metadaten"}
                    </p>
                  </TechnicalDetails>
                </>
              ) : (
                <div className="nx-empty">
                  <strong>Wähle ein Produkt aus.</strong>
                  <p>
                    Hier erscheinen Varianten, Produktreferenzen und
                    NexHQ-Produktwissen.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
