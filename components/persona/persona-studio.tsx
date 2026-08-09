"use client";

import {
  usePersonaStudio,
  type PersonaStudioController,
  type PersonaStudioSection,
} from "@/components/persona/use-persona-studio";
import {
  Aperture,
  Archive,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Home,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Shirt,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  Persona,
  PersonaReferenceAssetView,
  PersonaStatus,
} from "@/lib/persona/domain/types";
import {
  BrandCastView,
  CandidatesView,
  CreationProjectsView,
  PersonaCreatorView,
} from "@/components/persona/persona-creator-views";
import {
  PersonaStatusChip,
  personaStatusTone,
} from "@/components/persona/persona-status-chip";
import { parseMasterIdentityNotes } from "@/lib/persona/creation/master-identity-reference";
import { REFERENCE_PACKAGE_SLOT_LABELS, REFERENCE_PACKAGE_SLOTS } from "@/lib/persona/creation/reference-package/slots";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";
import { parseReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";
import type { ReferencePackageStatusView } from "@/lib/persona/creation/reference-package/types";

const NAV: Array<{
  id: PersonaStudioSection;
  label: string;
  icon: typeof Users;
}> = [
  { id: "dashboard", label: "Dashboard", icon: Layers },
  { id: "brand_cast", label: "Brand Cast", icon: CheckCircle2 },
  { id: "creator", label: "Brand Face Casting", icon: UserPlus },
  { id: "creation_projects", label: "Creation Projects", icon: Clapperboard },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "personas", label: "Reference Library", icon: UserRound },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "poses", label: "Poses", icon: Aperture },
  { id: "brand_looks", label: "Brand Looks", icon: Sparkles },
  { id: "outfits", label: "Outfits", icon: Shirt },
];

export function PersonaStudio() {
  const studio = usePersonaStudio();

  return (
    <div className="ps-shell">
      <header className="ps-header">
        <nav className="ps-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/" className="ps-crumb">
            <Home className="size-3.5" />
            NexHQ
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="ps-crumb ps-crumb-current">
            <UserRound className="size-3.5" />
            Persona Studio
          </span>
        </nav>
        <div className="ps-header-meta">
          <span className="ps-badge">Milaene Brand Cast</span>
          <span className="ps-badge ps-badge-muted">Phase 1.8 · Brand Faces</span>
          {studio.health ? (
            <span
              className={`ps-badge ps-health-badge ps-health-${studio.health.status}`}
              title={studio.health.message}
            >
              {studio.health.uiLabel}
            </span>
          ) : null}
        </div>
      </header>

      {studio.health && studio.health.status !== "healthy" ? (
        <div className={`ps-health-banner ps-health-${studio.health.status}`} role="status">
          <p>{studio.health.message}</p>
        </div>
      ) : null}

      <div className="ps-body">
        <aside className="ps-sidebar" aria-label="Persona Studio">
          <p className="ps-sidebar-title">Libraries</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = studio.section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ps-nav-item${active ? " is-active" : ""}`}
                onClick={() => studio.setSection(item.id)}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}

          <div className="ps-sidebar-future">
            <p className="ps-sidebar-title">Future</p>
            <div className="ps-future-card">
              <span>Image Studio</span>
              <em>Coming later</em>
            </div>
            <div className="ps-future-card">
              <span>Video Studio</span>
              <em>Coming later</em>
            </div>
          </div>
        </aside>

        <main className="ps-main">
          {studio.loading && !studio.snapshot ? (
            <div className="ps-loading">
              <Loader2 className="size-7 animate-spin" />
              <p>Preparing the Brand Cast…</p>
            </div>
          ) : studio.error ? (
            <div className="ps-error">
              <p>{studio.error}</p>
              <button type="button" onClick={() => void studio.refresh()}>
                Retry
              </button>
            </div>
          ) : studio.section === "dashboard" ? (
            <DashboardView studio={studio} />
          ) : studio.section === "brand_cast" ? (
            <BrandCastView studio={studio} />
          ) : studio.section === "creator" ? (
            <PersonaCreatorView studio={studio} />
          ) : studio.section === "creation_projects" ? (
            <CreationProjectsView studio={studio} />
          ) : studio.section === "candidates" ? (
            <CandidatesView studio={studio} />
          ) : studio.section === "personas" ? (
            <PersonasView studio={studio} />
          ) : studio.section === "locations" ? (
            <LocationsView studio={studio} />
          ) : studio.section === "camera" ? (
            <CameraView studio={studio} />
          ) : studio.section === "poses" ? (
            <PosesView studio={studio} />
          ) : studio.section === "brand_looks" ? (
            <BrandLooksView studio={studio} />
          ) : (
            <OutfitsView studio={studio} />
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardView({ studio }: { studio: PersonaStudioController }) {
  const cards = [
    {
      label: "Approved Personas",
      value: studio.counts.approved_personas,
      hint: `${studio.counts.review_personas} in review`,
      section: "personas" as const,
    },
    {
      label: "Locations",
      value: studio.counts.locations,
      hint: "Active sets",
      section: "locations" as const,
    },
    {
      label: "Camera Presets",
      value: studio.counts.camera_presets,
      hint: "Framing library",
      section: "camera" as const,
    },
    {
      label: "Pose Packs",
      value: studio.counts.pose_packs,
      hint: "Active poses",
      section: "poses" as const,
    },
    {
      label: "Brand Looks",
      value: studio.counts.brand_looks,
      hint: "Visual systems",
      section: "brand_looks" as const,
    },
    {
      label: "Outfits",
      value: studio.counts.outfits,
      hint: "Reusable sets",
      section: "outfits" as const,
    },
  ];

  return (
    <div className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>Persona Studio</h1>
          <p>
            Official Milaene Brand Cast — permanent approved personas for Image
            Studio, Video Studio, Shopify assets, and campaigns.
          </p>
        </div>
      </header>

      <div className="ps-dash-grid">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            className="ps-dash-card"
            onClick={() => studio.setSection(card.section)}
          >
            <span className="ps-dash-label">{card.label}</span>
            <strong className="ps-dash-value">{card.value}</strong>
            <span className="ps-dash-hint">{card.hint}</span>
          </button>
        ))}
      </div>

      <section className="ps-section">
        <h2>Approval workflow</h2>
        <ol className="ps-workflow">
          <li>Draft</li>
          <li>Review</li>
          <li className="is-emphasis">Approved</li>
          <li>Archived</li>
        </ol>
        <p className="ps-muted">
          Only Approved personas may later be used by Image Studio and Video
          Studio. Consistency is the highest priority.
        </p>
      </section>
    </div>
  );
}

function PersonasView({ studio }: { studio: PersonaStudioController }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await studio.createPersona({ name, role });
      setName("");
      setRole("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-panel ps-split">
      <div className="ps-list-pane">
        <header className="ps-panel-header compact">
          <div>
            <h1>Personas</h1>
            <p>Brand Cast members and approval status.</p>
          </div>
          <button
            type="button"
            className="ps-btn"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="size-3.5" />
            New
          </button>
        </header>

        {creating ? (
          <div className="ps-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Persona name"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role"
              aria-label="Persona role"
            />
            {error ? <p className="ps-inline-error">{error}</p> : null}
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy || !name.trim() || !role.trim()}
              onClick={() => void handleCreate()}
            >
              Create draft
            </button>
          </div>
        ) : null}

        <ul className="ps-entity-list">
          {studio.personas.length === 0 ? (
            <li className="ps-empty-state ps-empty-state--inline">
              <p className="ps-eyebrow">Cast</p>
              <strong>No Brand Cast has been approved yet.</strong>
              <p>Create a draft face or open Brand Face Casting to begin discovery.</p>
            </li>
          ) : (
            studio.personas.map((persona) => (
              <li key={persona.id}>
                <button
                  type="button"
                  className={`ps-entity-row${
                    studio.selectedPersonaId === persona.id ? " is-active" : ""
                  }`}
                  onClick={() => studio.selectPersona(persona.id)}
                >
                  <div>
                    <strong>{persona.name}</strong>
                    <span>{persona.role}</span>
                  </div>
                  <StatusPill status={persona.status} />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="ps-detail-pane">
        {studio.selectedPersona ? (
          <PersonaDetail
            persona={studio.selectedPersona}
            studio={studio}
          />
        ) : (
          <div className="ps-empty-state">
            <p className="ps-eyebrow">Brand Cast</p>
            <strong>Select a Brand Face</strong>
            <p>
              Choose a persona to review identity, references, and readiness for Image and
              Video Studio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonaDetail({
  persona,
  studio,
}: {
  persona: Persona;
  studio: PersonaStudioController;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const readiness = studio.selectedReadiness;
  const allReferences = studio.selectedReferences;
  const masterReference =
    allReferences.find((a) => parseMasterIdentityNotes(a.notes)) ?? null;
  const references = allReferences.filter((a) => {
    if (filterType !== "all" && a.asset_type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });
  const previewAsset =
    previewAssetId == null
      ? null
      : (allReferences.find((a) => a.id === previewAssetId) ?? null);

  return (
    <div className="ps-detail">
      <header className="ps-detail-header">
        <div>
          <h2>{persona.name}</h2>
          <p>{persona.role}</p>
        </div>
        <StatusPill status={persona.status} />
      </header>

      {readiness ? (
        <div className="ps-readiness">
          <span className={`ps-ready-chip ps-ready-${readiness.state}`}>
            {readiness.state}
          </span>
          <span>
            Image ready: {readiness.image_ready ? "yes" : "no"} · Video ready:{" "}
            {readiness.video_ready ? "yes" : "no"}
          </span>
          {!readiness.completeness.visually_complete ? (
            <span className="ps-inline-error">Visuell unvollständig</span>
          ) : (
            <span>Visuell vollständig</span>
          )}
        </div>
      ) : null}

      <dl className="ps-meta-grid">
        <Meta label="Gender" value={persona.gender} />
        <Meta label="Age range" value={persona.age_range} />
        <Meta label="Height" value={persona.height} />
        <Meta label="Body type" value={persona.body_type} />
        <Meta label="Skin tone" value={persona.skin_tone} />
        <Meta label="Hair" value={persona.hair} />
        <Meta label="Beard" value={persona.beard || "—"} />
        <Meta label="Eyes" value={persona.eye_color} />
        <Meta label="Expression" value={persona.expression} />
        <Meta label="Brand fit" value={`${persona.brand_fit_score}`} />
        <Meta label="Personality" value={persona.personality} />
        <Meta label="Style" value={persona.style} />
        <Meta label="Visual identity notes" value={persona.visual_identity_notes} />
        <Meta label="Prohibited changes" value={persona.prohibited_changes} />
        <Meta
          label="Image use"
          value={persona.image_use_approved ? "approved" : "not set"}
        />
        <Meta
          label="Video use"
          value={persona.video_use_approved ? "approved" : "not set"}
        />
      </dl>

      {persona.notes ? <p className="ps-notes">{persona.notes}</p> : null}

      {error ? <p className="ps-inline-error">{error}</p> : null}

      <ReferencePackagePanel
        personaId={persona.id}
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onRefresh={() => studio.selectPersona(persona.id)}
        referenceRevision={studio.selectedReferences
          .map((a) => `${a.id}:${a.status}`)
          .sort()
          .join("|")}
      />

      <section className="ps-section">
        <h3>Referenzbibliothek</h3>
        {readiness ? (
          <ul className="ps-completeness">
            <li className={readiness.completeness.front_portrait ? "is-ok" : ""}>
              Front portrait
            </li>
            <li className={readiness.completeness.left_profile ? "is-ok" : ""}>
              Left profile
            </li>
            <li className={readiness.completeness.right_profile ? "is-ok" : ""}>
              Right profile
            </li>
            <li className={readiness.completeness.full_body_front ? "is-ok" : ""}>
              Full body front
            </li>
            <li
              className={
                readiness.completeness.full_body_side_or_three_quarter ? "is-ok" : ""
              }
            >
              Full body side / three-quarter
            </li>
            <li className={readiness.completeness.neutral_expression ? "is-ok" : ""}>
              Neutral expression
            </li>
            <li
              className={
                readiness.completeness.optional_video_reference ? "is-ok" : ""
              }
            >
              Optional video reference
            </li>
          </ul>
        ) : null}

        <div className="ps-form">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            aria-label="Referenz hochladen"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set("file", file);
              form.set("asset_type", "portrait");
              form.set("view_angle", "front");
              form.set("framing", "head_shoulders");
              form.set("expression", "neutral");
              form.set("rights_confirmed", "true");
              void run(() => studio.uploadReference(persona.id, form));
              e.target.value = "";
            }}
          />
        </div>

        <div className="ps-chip-row" style={{ marginBottom: "0.75rem" }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter asset type"
          >
            <option value="all">All types</option>
            <option value="portrait">portrait</option>
            <option value="profile">profile</option>
            <option value="full_body">full_body</option>
            <option value="three_quarter">three_quarter</option>
            <option value="video_reference">video_reference</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">All statuses</option>
            <option value="uploaded">uploaded</option>
            <option value="review">review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <ul className="ps-card-list">
          {references.map((asset) => {
            const masterMeta = parseMasterIdentityNotes(asset.notes);
            const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
            const isGeneratedPkg = pkgMeta != null;
            const canSetPrimary = !masterMeta && !isGeneratedPkg;
            const slotLabel = pkgMeta
              ? REFERENCE_PACKAGE_SLOT_LABELS[pkgMeta.slot] ?? pkgMeta.slot
              : asset.view_angle;
            return (
            <li
              key={asset.id}
              className={`ps-lib-card${masterMeta ? " is-master-identity" : ""}`}
              data-testid={masterMeta ? "master-identity-reference" : undefined}
            >
              <div>
                {asset.signed_url ? (
                  <button
                    type="button"
                    className="ps-ref-thumb-btn"
                    onClick={() => setPreviewAssetId(asset.id)}
                    aria-label={`Open large preview: ${slotLabel}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.signed_url}
                      alt={
                        masterMeta
                          ? "MASTER IDENTITY REFERENCE — Original selected Brand Face"
                          : asset.notes || asset.asset_type
                      }
                      className="ps-ref-thumb"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ps-btn"
                    onClick={() => setPreviewAssetId(asset.id)}
                  >
                    Open preview
                  </button>
                )}
                {masterMeta ? (
                  <div className="ps-master-identity-banner">
                    <PersonaStatusChip
                      label="MASTER IDENTITY REFERENCE"
                      tone="selected"
                    />
                    <p className="ps-muted" style={{ margin: "0.35rem 0 0" }}>
                      Original selected Brand Face
                      {masterMeta.original_provider
                        ? ` · ${masterMeta.original_provider}`
                        : ""}
                    </p>
                  </div>
                ) : null}
                <strong>
                  {masterMeta
                    ? "Master portrait"
                    : pkgMeta
                      ? slotLabel
                      : asset.asset_type}
                  {asset.is_primary ? " · primary" : ""}
                </strong>
                <span>
                  {asset.view_angle} · {asset.framing} · {asset.status}
                  {pkgMeta?.identity_decision === "identity_mismatch"
                    ? " · mismatch"
                    : ""}
                </span>
                <em>
                  {asset.expression || "—"} · rights:{" "}
                  {asset.rights_confirmed ? "yes" : "no"}
                </em>
              </div>
              <div className="ps-actions">
                {canSetPrimary ? (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      studio.patchReference(persona.id, asset.id, {
                        is_primary: true,
                        status: asset.status === "uploaded" ? "approved" : asset.status,
                        rights_confirmed: true,
                      }),
                    )
                  }
                >
                  Primär
                </button>
                ) : masterMeta ? (
                  <span className="ps-muted" style={{ fontSize: "0.75rem" }}>
                    Immutable source — cannot be replaced
                  </span>
                ) : (
                  <span className="ps-muted" style={{ fontSize: "0.75rem" }}>
                    Supporting reference — cannot become Master
                  </span>
                )}
                {!masterMeta ? (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      studio.patchReference(persona.id, asset.id, {
                        status: "approved",
                        rights_confirmed: true,
                      }),
                    )
                  }
                >
                  Freigeben
                </button>
                ) : null}
                {!masterMeta ? (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      studio.patchReference(persona.id, asset.id, {
                        status: "rejected",
                        is_primary: false,
                      }),
                    )
                  }
                >
                  Ablehnen
                </button>
                ) : null}
                {!masterMeta ? (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      studio.patchReference(persona.id, asset.id, {
                        status: "archived",
                        is_primary: false,
                      }),
                    )
                  }
                >
                  Archiv
                </button>
                ) : null}
                {!masterMeta ? (
                <button
                  type="button"
                  className="ps-btn ps-btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm("Referenz wirklich löschen?")) return;
                    void run(() => studio.removeReference(persona.id, asset.id));
                  }}
                >
                  Löschen
                </button>
                ) : null}
                <button
                  type="button"
                  className="ps-btn"
                  onClick={() => setPreviewAssetId(asset.id)}
                >
                  Preview
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      </section>

      {previewAsset ? (
        <ReferencePreviewLightbox
          asset={previewAsset}
          master={masterReference}
          personaId={persona.id}
          identityLocked={persona.identity_lock_status === "approved"}
          busy={busy}
          onClose={() => setPreviewAssetId(null)}
          onApprove={() =>
            void run(async () => {
              await studio.patchReference(persona.id, previewAsset.id, {
                status: "approved",
                rights_confirmed: true,
              });
            })
          }
          onReject={() =>
            void run(async () => {
              await studio.patchReference(persona.id, previewAsset.id, {
                status: "rejected",
                is_primary: false,
              });
            })
          }
          onReassigned={() => {
            void studio.selectPersona(persona.id);
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}

      <section className="ps-section">
        <h3>Preferred libraries</h3>
        <RelationBlock
          title="Locations"
          ids={persona.preferred_location_ids}
          options={studio.locations.map((l) => ({ id: l.id, label: l.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "locations", ids }),
            )
          }
        />
        <RelationBlock
          title="Camera Presets"
          ids={persona.preferred_camera_preset_ids}
          options={studio.cameraPresets.map((c) => ({ id: c.id, label: c.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, {
                kind: "camera_presets",
                ids,
              }),
            )
          }
        />
        <RelationBlock
          title="Poses"
          ids={persona.preferred_pose_ids}
          options={studio.poses.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "poses", ids }),
            )
          }
        />
        <RelationBlock
          title="Brand Looks"
          ids={persona.preferred_brand_look_ids}
          options={studio.brandLooks.map((b) => ({ id: b.id, label: b.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "brand_looks", ids }),
            )
          }
        />
        <RelationBlock
          title="Outfits"
          ids={persona.preferred_outfit_ids}
          options={studio.outfits.map((o) => ({ id: o.id, label: o.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "outfits", ids }),
            )
          }
        />
      </section>

      <section className="ps-section">
        <h3>Workflow</h3>
        <div className="ps-actions">
          <button
            type="button"
            className="ps-btn"
            disabled={busy}
            onClick={() =>
              void run(() =>
                studio.patchPersona(persona.id, {
                  image_use_approved: true,
                  visual_identity_notes:
                    persona.visual_identity_notes || "Locked Brand Cast identity",
                  prohibited_changes:
                    persona.prohibited_changes || "No face morphing or age shift",
                  default_hair_style: persona.default_hair_style || persona.hair,
                  default_expression:
                    persona.default_expression || persona.expression,
                  default_body_proportions:
                    persona.default_body_proportions || persona.body_type,
                  default_styling_notes:
                    persona.default_styling_notes || persona.style,
                  gender: persona.gender || "unspecified",
                  age_range: persona.age_range || "25-35",
                  height: persona.height || "175cm",
                  body_type: persona.body_type || "athletic",
                  skin_tone: persona.skin_tone || "neutral",
                  hair: persona.hair || "dark",
                  eye_color: persona.eye_color || "brown",
                  expression: persona.expression || "neutral",
                  personality: persona.personality || "composed",
                  style: persona.style || "quiet luxury",
                }),
              )
            }
          >
            Mark profile ready
          </button>
          {persona.status === "Draft" ? (
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  studio.patchPersona(persona.id, { action: "submit_review" }),
                )
              }
            >
              Submit for review
            </button>
          ) : null}
          {persona.status === "Review" ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  studio.patchPersona(persona.id, { action: "approve" }),
                )
              }
            >
              <CheckCircle2 className="size-3.5" />
              Approve
            </button>
          ) : null}
          {persona.status !== "Archived" ? (
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  studio.patchPersona(persona.id, { action: "archive" }),
                )
              }
            >
              <Archive className="size-3.5" />
              Archive
            </button>
          ) : (
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  studio.patchPersona(persona.id, { action: "reopen_draft" }),
                )
              }
            >
              Reopen as draft
            </button>
          )}
          <button
            type="button"
            className="ps-btn ps-btn-danger"
            disabled={busy}
            onClick={() => void run(() => studio.removePersona(persona.id))}
          >
            Delete
          </button>
        </div>
        {error ? <p className="ps-inline-error">{error}</p> : null}
      </section>
    </div>
  );
}

function RelationBlock({
  title,
  ids,
  options,
  onChange,
}: {
  title: string;
  ids: string[];
  options: Array<{ id: string; label: string }>;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="ps-relation">
      <div className="ps-relation-title">{title}</div>
      <div className="ps-chip-row">
        {options.map((opt) => {
          const active = ids.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={`ps-chip${active ? " is-active" : ""}`}
              onClick={() => {
                onChange(
                  active ? ids.filter((id) => id !== opt.id) : [...ids, opt.id],
                );
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocationsView({ studio }: { studio: PersonaStudioController }) {
  return (
    <LibraryPanel
      title="Locations"
      description="Sets and environments for consistent Brand Cast shoots."
      onCreate={() =>
        studio.createLibraryItem("/api/persona/locations", {
          name: "Architecture",
          category: "Urban",
          setting: "outdoor",
          description: "Clean architectural exterior for campaign frames.",
          tags: ["architecture", "urban"],
          active: true,
        })
      }
      onDelete={(id) => studio.deleteLibraryItem(`/api/persona/locations/${id}`)}
      rows={studio.locations.map((l) => ({
        id: l.id,
        title: l.name,
        subtitle: `${l.category} · ${l.setting}`,
        meta: l.tags.join(", "),
      }))}
    />
  );
}

function CameraView({ studio }: { studio: PersonaStudioController }) {
  return (
    <LibraryPanel
      title="Camera Presets"
      description="Focal length, framing, lighting, and grade recipes."
      onCreate={() =>
        studio.createLibraryItem("/api/persona/camera", {
          name: "Street",
          focal_length: "35mm",
          framing: "Environmental portrait",
          lighting_style: "Available light",
          color_grade: "Cool desaturated",
          notes: "Urban movement frames.",
        })
      }
      onDelete={(id) => studio.deleteLibraryItem(`/api/persona/camera/${id}`)}
      rows={studio.cameraPresets.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.focal_length} · ${c.framing}`,
        meta: c.lighting_style,
      }))}
    />
  );
}

function PosesView({ studio }: { studio: PersonaStudioController }) {
  return (
    <LibraryPanel
      title="Poses"
      description="Reusable body directions for product-safe consistency."
      onCreate={() =>
        studio.createLibraryItem("/api/persona/poses", {
          name: "Walk Pause",
          category: "Movement",
          description: "Mid-stride pause with soft eye contact.",
          body_direction: "Toward camera",
          suitable_products: ["outerwear", "sneakers"],
          active: true,
        })
      }
      onDelete={(id) => studio.deleteLibraryItem(`/api/persona/poses/${id}`)}
      rows={studio.poses.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.category} · ${p.body_direction}`,
        meta: p.suitable_products.join(", "),
      }))}
    />
  );
}

function BrandLooksView({ studio }: { studio: PersonaStudioController }) {
  return (
    <LibraryPanel
      title="Brand Looks"
      description="Mood and color systems for the Brand Cast."
      onCreate={() =>
        studio.createLibraryItem("/api/persona/brand-looks", {
          name: "Minimal",
          description: "Sparse, quiet frames with maximum product clarity.",
          mood: "Still",
          color_style: "Soft neutrals",
          styling_notes: "No busy props; emphasize silhouette.",
        })
      }
      onDelete={(id) => studio.deleteLibraryItem(`/api/persona/brand-looks/${id}`)}
      rows={studio.brandLooks.map((b) => ({
        id: b.id,
        title: b.name,
        subtitle: b.mood,
        meta: b.color_style,
      }))}
    />
  );
}

function OutfitsView({ studio }: { studio: PersonaStudioController }) {
  return (
    <LibraryPanel
      title="Outfits"
      description="Reusable clothing combinations for cast consistency."
      onCreate={() =>
        studio.createLibraryItem("/api/persona/outfits", {
          name: "Silver Accent Kit",
          description: "Minimal jewelry layer for quiet luxury.",
          items: ["Silver Ring", "Minimal Accessories"],
          tags: ["accessories"],
          active: true,
        })
      }
      onDelete={(id) => studio.deleteLibraryItem(`/api/persona/outfits/${id}`)}
      rows={studio.outfits.map((o) => ({
        id: o.id,
        title: o.name,
        subtitle: o.items.join(" · "),
        meta: o.tags.join(", "),
      }))}
    />
  );
}

function LibraryPanel({
  title,
  description,
  rows,
  onCreate,
  onDelete,
}: {
  title: string;
  description: string;
  rows: Array<{ id: string; title: string; subtitle: string; meta: string }>;
  onCreate: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="ps-btn ps-btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void onCreate()
              .catch((err) =>
                setError(err instanceof Error ? err.message : "Create failed"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </header>
      {error ? <p className="ps-inline-error">{error}</p> : null}
      {rows.length === 0 ? (
        <div className="ps-empty-state">
          <p className="ps-eyebrow">Library</p>
          <strong>Nothing cast for this shelf yet.</strong>
          <p>Add your first entry to keep Brand Cast shoots consistent.</p>
        </div>
      ) : (
      <ul className="ps-card-list">
        {rows.map((row) => (
          <li key={row.id} className="ps-lib-card">
            <div>
              <strong>{row.title}</strong>
              <span>{row.subtitle}</span>
              {row.meta ? <em>{row.meta}</em> : null}
            </div>
            <button
              type="button"
              className="ps-btn ps-btn-danger"
              onClick={() => void onDelete(row.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}

function ReferencePackagePanel({
  personaId,
  busy,
  onBusy,
  onError,
  onRefresh,
  referenceRevision,
}: {
  personaId: string;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onRefresh: () => void;
  /** Changes when reference asset statuses change — reloads package coverage. */
  referenceRevision: string;
}) {
  const [status, setStatus] = useState<ReferencePackageStatusView | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingEstimate, setPendingEstimate] = useState<{
    imageCount: number;
    estimatedMin: number;
    estimatedMax: number;
    maxAuthorizedSpend: number;
    provider: string;
    slots?: string[];
  } | null>(null);
  const [regenSlot, setRegenSlot] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch(`/api/persona/${personaId}/reference-package`);
    const data = (await res.json()) as {
      error?: string;
      status?: ReferencePackageStatusView;
    };
    if (!res.ok) throw new Error(data.error ?? "Reference Package status failed");
    setStatus(data.status ?? null);
  }

  useEffect(() => {
    void loadStatus().catch((err) =>
      onError(err instanceof Error ? err.message : "Status failed"),
    );
    // Reload on persona open and whenever reference statuses change (approve/reject).
    // No provider call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, referenceRevision]);

  async function prepare(slot?: string) {
    onBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          slot
            ? { action: "prepare_regenerate", slot }
            : { action: "prepare" },
        ),
      });
      const data = (await res.json()) as {
        error?: string;
        confirmationToken?: string;
        estimate?: {
          imageCount: number;
          estimatedMin: number;
          estimatedMax: number;
          maxAuthorizedSpend: number;
          provider: string;
        };
        slots?: string[];
        providerCalled?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Prepare failed");
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: provider must not run on prepare");
      }
      setPendingToken(data.confirmationToken ?? null);
      setPendingEstimate(
        data.estimate
          ? { ...data.estimate, slots: data.slots }
          : null,
      );
      setRegenSlot(slot ?? null);
      await loadStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Prepare failed");
    } finally {
      onBusy(false);
    }
  }

  async function confirm() {
    if (!pendingToken || !pendingEstimate) return;
    onBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          regenSlot
            ? {
                action: "confirm_regenerate",
                slot: regenSlot,
                confirmationToken: pendingToken,
                costConfirmed: true,
              }
            : {
                action: "confirm",
                confirmationToken: pendingToken,
                costConfirmed: true,
              },
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPendingToken(null);
      setPendingEstimate(null);
      setRegenSlot(null);
      await loadStatus();
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      onBusy(false);
    }
  }

  const slotStatusLabel: Record<string, string> = {
    missing: "Missing",
    queued: "Queued",
    generating: "Generating",
    identity_check: "Identity Check",
    review: "Review",
    accepted: "Accepted",
    mismatch: "Mismatch",
    failed: "Failed",
    rejected: "Rejected",
  };

  function slotPrimaryLabel(slot: {
    status: string;
    wrongCameraDirection?: boolean;
  }): string {
    if (slot.wrongCameraDirection) return "Wrong camera direction";
    return slotStatusLabel[slot.status] ?? slot.status;
  }

  return (
    <section className="ps-section" data-testid="reference-package-panel">
      <h3>REFERENCE PACKAGE</h3>
      <p className="ps-muted">
        Same person, different camera angles · subject-perspective direction lock ·
        OpenAI image edit · Master Identity as source
      </p>
      {status?.referencePackageReady ? (
        <PersonaStatusChip label="Reference Package Ready" tone="selected" />
      ) : (
        <span className="ps-muted">
          Coverage {status?.acceptedCount ?? 0}/{status?.requiredCount ?? 5}{" "}
          (approved only)
        </span>
      )}

      <ul className="ps-ref-pkg-slots">
        {(status?.slots ?? []).map((slot) => (
          <li key={slot.slot} className="ps-ref-pkg-slot">
            <div className="ps-ref-pkg-slot-main">
              <strong>{slot.label}</strong>
              <span>{slotPrimaryLabel(slot)}</span>
              {slot.status !== "accepted" && (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() => void prepare(slot.slot)}
                >
                  Regenerate this angle
                </button>
              )}
            </div>
            {slot.wrongCameraDirection ? (
              <p className="ps-ref-pkg-meta ps-inline-error">
                Wrong camera direction · Suggest: Reassign angle (if target free)
                or Reject
              </p>
            ) : null}
            {(slot.identityDecision ||
              slot.humanReview ||
              slot.angleManuallyReassigned) && (
              <p className="ps-ref-pkg-meta ps-muted">
                {slot.identityDecision
                  ? `Identity: ${
                      slot.identityDecision === "identity_warning"
                        ? "warning"
                        : slot.identityDecision === "identity_match"
                          ? "match"
                          : slot.identityDecision === "identity_mismatch"
                            ? "mismatch"
                            : slot.identityDecision
                    }`
                  : null}
                {slot.humanReview
                  ? `${slot.identityDecision ? " · " : ""}Human review: ${slot.humanReview}`
                  : null}
                {slot.angleManuallyReassigned
                  ? `${slot.identityDecision || slot.humanReview ? " · " : ""}Angle: manually reassigned`
                  : null}
              </p>
            )}
            {slot.attemptHistory && slot.attemptHistory.length > 0 ? (
              <ul className="ps-ref-pkg-history" aria-label={`${slot.label} attempt history`}>
                {slot.attemptHistory.map((att, idx) => (
                  <li key={att.id}>
                    Attempt {idx + 1} — Generated for{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[att.reference_slot] ??
                      att.reference_slot}
                    {att.identity_decision
                      ? ` · Identity evaluation: ${
                          att.identity_decision === "identity_warning"
                            ? "warning"
                            : att.identity_decision === "identity_match"
                              ? "match"
                              : att.identity_decision === "identity_mismatch"
                                ? "mismatch"
                                : att.identity_decision
                        }`
                      : ""}
                    {att.reassigned_from && att.effective_slot
                      ? ` · Reassigned → ${
                          REFERENCE_PACKAGE_SLOT_LABELS[att.effective_slot] ??
                          att.effective_slot
                        }`
                      : ""}
                    {att.effective_slot &&
                    slot.humanReview === "approved" &&
                    att.generated_asset_id === slot.acceptedAssetId
                      ? " · Human review: approved"
                      : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {!pendingEstimate ? (
        <button
          type="button"
          className="ps-btn ps-btn-primary"
          disabled={busy || status?.referencePackageReady === true}
          onClick={() => void prepare()}
        >
          Prepare missing Reference Package angles
        </button>
      ) : (
        <div className="ps-ref-pkg-confirm" data-testid="reference-package-confirm">
          {pendingEstimate.slots?.length === 1 ? (
            <p>
              Slot: <strong>{pendingEstimate.slots[0]}</strong>
            </p>
          ) : (
            <p>
              Slots:{" "}
              <strong>{(pendingEstimate.slots ?? []).join(", ") || "package"}</strong>
            </p>
          )}
          <p>
            <strong>{pendingEstimate.imageCount}</strong> image
            {pendingEstimate.imageCount === 1 ? "" : "s"} · Provider:{" "}
            <strong>{pendingEstimate.provider}</strong>
          </p>
          <p>
            Estimated €{pendingEstimate.estimatedMin.toFixed(2)} – €
            {pendingEstimate.estimatedMax.toFixed(2)}
          </p>
          <p>
            Maximum authorized spend: €
            {pendingEstimate.maxAuthorizedSpend.toFixed(2)}
          </p>
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {pendingEstimate.imageCount === 1
              ? "Confirm & regenerate"
              : "Confirm & generate"}
          </button>
          <button
            type="button"
            className="ps-btn"
            disabled={busy}
            onClick={() => {
              setPendingToken(null);
              setPendingEstimate(null);
              setRegenSlot(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

function referencePreviewStatusLabel(asset: PersonaReferenceAssetView): string {
  const pkg = parseReferencePackageAssetNotes(asset.notes);
  if (pkg?.identity_decision === "identity_mismatch") return "mismatch";
  if (asset.status === "approved") return "accepted";
  if (asset.status === "rejected") return "rejected";
  if (asset.status === "review" || asset.status === "uploaded") return "review";
  return asset.status;
}

function ReferencePreviewLightbox({
  asset,
  master,
  personaId,
  identityLocked,
  busy,
  onClose,
  onApprove,
  onReject,
  onReassigned,
  onError,
}: {
  asset: PersonaReferenceAssetView;
  master: PersonaReferenceAssetView | null;
  personaId: string;
  identityLocked: boolean;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReassigned: () => void;
  onError: (msg: string | null) => void;
}) {
  const masterMeta = parseMasterIdentityNotes(asset.notes);
  const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
  const isMaster = masterMeta != null;
  const isGenerated = pkgMeta != null;
  const [compare, setCompare] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [targetSlot, setTargetSlot] = useState<ReferencePackageSlot | "">("");
  const [reassignBusy, setReassignBusy] = useState(false);

  const requestedSlot = pkgMeta?.requested_slot ?? pkgMeta?.slot;
  const effectiveSlot = pkgMeta?.effective_slot ?? pkgMeta?.slot;
  const isReassigned =
    Boolean(pkgMeta?.reassigned_from) ||
    (requestedSlot != null &&
      effectiveSlot != null &&
      requestedSlot !== effectiveSlot);

  const slotLabel = isMaster
    ? "MASTER IDENTITY REFERENCE"
    : effectiveSlot
      ? REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot
      : `${asset.asset_type} · ${asset.view_angle}`;

  const canReassign =
    isGenerated && !isMaster && !identityLocked && pkgMeta != null;

  const mismatchBlocksApprove =
    pkgMeta?.identity_decision === "identity_mismatch";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function confirmReassign() {
    if (!targetSlot || !canReassign) return;
    setReassignBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign_angle",
          assetId: asset.id,
          targetSlot,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        providerCalled?: boolean;
      };
      if (!res.ok) {
        throw new Error(
          data.error ?? "Target slot already has an accepted reference.",
        );
      }
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: reassignment must not call a provider");
      }
      setReassignOpen(false);
      setTargetSlot("");
      onReassigned();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reassign failed");
    } finally {
      setReassignBusy(false);
    }
  }

  const showCompare =
    compare && isGenerated && master?.signed_url && asset.signed_url;

  return (
    <div
      className="ps-ref-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Reference large preview"
      data-testid="reference-preview-lightbox"
    >
      <button
        type="button"
        className="ps-ref-lightbox-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="ps-ref-lightbox-panel">
        <header className="ps-ref-lightbox-header">
          <div>
            <strong>{slotLabel}</strong>
            {isReassigned ? (
              <span className="ps-ref-reassigned-badge" data-testid="reassigned-badge">
                REASSIGNED
              </span>
            ) : null}
            <p className="ps-muted" style={{ margin: "0.25rem 0 0" }}>
              {isMaster ? "Master" : isGenerated ? "Generated reference" : "Reference"}{" "}
              · status: {referencePreviewStatusLabel(asset)}
              {pkgMeta?.identity_decision
                ? ` · identity: ${pkgMeta.identity_decision}`
                : ""}
            </p>
            {isGenerated && requestedSlot && effectiveSlot ? (
              <dl className="ps-ref-angle-meta">
                <div>
                  <dt>Requested angle</dt>
                  <dd>
                    {REFERENCE_PACKAGE_SLOT_LABELS[requestedSlot] ?? requestedSlot}
                  </dd>
                </div>
                <div>
                  <dt>Effective angle</dt>
                  <dd>
                    {REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot}
                  </dd>
                </div>
              </dl>
            ) : null}
            {isGenerated && requestedSlot ? (
              <ul className="ps-ref-angle-history" aria-label="Angle history">
                <li>
                  Generated for{" "}
                  {REFERENCE_PACKAGE_SLOT_LABELS[requestedSlot] ?? requestedSlot}
                </li>
                {pkgMeta?.identity_decision ? (
                  <li>
                    Identity evaluation:{" "}
                    {pkgMeta.identity_decision === "identity_warning"
                      ? "warning"
                      : pkgMeta.identity_decision === "identity_match"
                        ? "match"
                        : pkgMeta.identity_decision === "identity_mismatch"
                          ? "mismatch"
                          : pkgMeta.identity_decision}
                  </li>
                ) : null}
                {pkgMeta?.angle_direction === "incorrect" ? (
                  <li className="ps-inline-error">
                    Wrong camera direction — Reassign angle or Reject
                  </li>
                ) : null}
                {isReassigned && effectiveSlot ? (
                  <li>
                    Reassigned →{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot}
                  </li>
                ) : null}
                {asset.status === "approved" ? (
                  <li>Human review: approved</li>
                ) : asset.status === "rejected" ? (
                  <li>Human review: rejected</li>
                ) : null}
              </ul>
            ) : null}
          </div>
          <div className="ps-ref-lightbox-actions">
            {isGenerated && master?.signed_url ? (
              <button
                type="button"
                className="ps-btn"
                onClick={() => setCompare((v) => !v)}
              >
                {compare ? "Hide Master compare" : "Compare with Master"}
              </button>
            ) : null}
            {!isMaster ? (
              <>
                <button
                  type="button"
                  className="ps-btn ps-btn-primary"
                  disabled={busy || mismatchBlocksApprove}
                  onClick={onApprove}
                  title={
                    mismatchBlocksApprove
                      ? "Identity mismatch cannot become Accepted"
                      : undefined
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={onReject}
                >
                  Reject
                </button>
                {canReassign ? (
                  <button
                    type="button"
                    className="ps-btn"
                    disabled={busy || reassignBusy}
                    onClick={() => setReassignOpen((v) => !v)}
                  >
                    Reassign angle
                  </button>
                ) : null}
              </>
            ) : (
              <span className="ps-muted" style={{ fontSize: "0.8rem" }}>
                Immutable Master — cannot approve as replacement or delete
              </span>
            )}
            <button type="button" className="ps-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {reassignOpen && canReassign ? (
          <div className="ps-ref-reassign" data-testid="reassign-angle-panel">
            <p className="ps-muted">
              Reassign this paid generation to the correct subject-perspective
              slot. No new image will be generated.
            </p>
            <label>
              Target slot
              <select
                value={targetSlot}
                onChange={(e) =>
                  setTargetSlot(e.target.value as ReferencePackageSlot | "")
                }
                aria-label="Target angle slot"
              >
                <option value="">Select slot…</option>
                {REFERENCE_PACKAGE_SLOTS.filter((s) => s !== effectiveSlot).map(
                  (slot) => (
                    <option key={slot} value={slot}>
                      {REFERENCE_PACKAGE_SLOT_LABELS[slot]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={!targetSlot || reassignBusy || busy}
              onClick={() => void confirmReassign()}
            >
              Confirm reassignment
            </button>
          </div>
        ) : null}

        {showCompare ? (
          <div className="ps-ref-lightbox-compare" data-testid="reference-master-compare">
            <figure>
              <figcaption>Master</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={master.signed_url!}
                alt="MASTER IDENTITY REFERENCE"
              />
            </figure>
            <figure>
              <figcaption>Generated reference · {slotLabel}</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.signed_url!} alt={slotLabel} />
            </figure>
          </div>
        ) : asset.signed_url ? (
          <div className="ps-ref-lightbox-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.signed_url}
              alt={slotLabel}
            />
          </div>
        ) : (
          <p className="ps-muted">No signed URL available for this reference.</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PersonaStatus }) {
  return (
    <PersonaStatusChip label={status} tone={personaStatusTone(status)} />
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
