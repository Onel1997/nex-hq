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
  Home,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Shirt,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Persona, PersonaStatus } from "@/lib/persona/domain/types";

const NAV: Array<{
  id: PersonaStudioSection;
  label: string;
  icon: typeof Users;
}> = [
  { id: "dashboard", label: "Dashboard", icon: Layers },
  { id: "personas", label: "Personas", icon: Users },
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
            Facility
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="ps-crumb ps-crumb-current">
            <UserRound className="size-3.5" />
            Persona Studio
          </span>
        </nav>
        <div className="ps-header-meta">
          <span className="ps-badge">Milaene Brand Cast</span>
          <span className="ps-badge ps-badge-muted">Phase 1 · Foundation</span>
        </div>
      </header>

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
              <p>Loading Brand Cast…</p>
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
          {studio.personas.map((persona) => (
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
          ))}
        </ul>
      </div>

      <div className="ps-detail-pane">
        {studio.selectedPersona ? (
          <PersonaDetail
            persona={studio.selectedPersona}
            studio={studio}
          />
        ) : (
          <div className="ps-empty">Select a persona to manage details and relations.</div>
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
  const references = studio.selectedReferences.filter((a) => {
    if (filterType !== "all" && a.asset_type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

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
          {references.map((asset) => (
            <li key={asset.id} className="ps-lib-card">
              <div>
                {asset.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.signed_url}
                    alt={asset.notes || asset.asset_type}
                    className="ps-ref-thumb"
                  />
                ) : null}
                <strong>
                  {asset.asset_type}
                  {asset.is_primary ? " · primary" : ""}
                </strong>
                <span>
                  {asset.view_angle} · {asset.framing} · {asset.status}
                </span>
                <em>
                  {asset.expression || "—"} · rights:{" "}
                  {asset.rights_confirmed ? "yes" : "no"}
                </em>
              </div>
              <div className="ps-actions">
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
              </div>
            </li>
          ))}
        </ul>
      </section>

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
    </div>
  );
}

function StatusPill({ status }: { status: PersonaStatus }) {
  return <span className={`ps-status ps-status-${status.toLowerCase()}`}>{status}</span>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
