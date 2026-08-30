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
import type { IdentityLockEligibilityView } from "@/lib/persona/creation/identity-lock/types";
import type {
  LegacyIdentityReconciliationView,
  LegacyReconciliationConfirmations,
} from "@/lib/persona/creation/identity-lock/legacy-reconciliation-service";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewChecklist,
  type IdentityReviewCheckKey,
} from "@/lib/persona/domain/creation-types";
import type { BrandModelApprovalsView } from "@/lib/persona/creation/use-approvals/types";
import {
  reconcileAfterPersonaMutation,
  VIDEO_IDENTITY_REVIEW_SAVING_LABEL,
  VIDEO_USE_APPROVAL_SAVING_LABEL,
} from "@/lib/persona/studio/persona-mutation-reconcile";
import type {
  VideoIdentityReadinessView,
  VideoIdentityReviewChecklist,
} from "@/lib/persona/creation/video-readiness/types";
import type {
  ReferenceRightsConfirmations,
  ReferenceRightsView,
} from "@/lib/persona/creation/reference-rights/types";
import { canProposeMirrorSalvage } from "@/lib/persona/creation/reference-package/mirror-salvage";
import { StudioStepper } from "@/components/studio/studio-ui";
import { PERSONA_PROGRESS_STEPS, ownerStatusLabel } from "@/lib/ux/owner-terminology";

const NAV: Array<{
  id: PersonaStudioSection;
  label: string;
  icon: typeof Users;
}> = [
  { id: "dashboard", label: "Überblick", icon: Layers },
  { id: "brand_cast", label: "Brand Cast", icon: CheckCircle2 },
  { id: "creator", label: "Neues Model entdecken", icon: UserPlus },
  { id: "creation_projects", label: "Entdeckungsprojekte", icon: Clapperboard },
  { id: "candidates", label: "Kandidaten", icon: Users },
  { id: "personas", label: "Markenmodelle", icon: UserRound },
  { id: "locations", label: "Orte", icon: MapPin },
  { id: "camera", label: "Kamera", icon: Camera },
  { id: "poses", label: "Posen", icon: Aperture },
  { id: "brand_looks", label: "Markenlooks", icon: Sparkles },
  { id: "outfits", label: "Outfits", icon: Shirt },
];

function hasCurrentVideoApprovalProjection(persona: Persona): boolean {
  return Boolean(
    persona.video_use_approved &&
      persona.video_identity_ready &&
      persona.video_identity_review_id &&
      persona.video_use_approval_review_id === persona.video_identity_review_id &&
      persona.video_identity_ready_lock_version === persona.identity_lock_version &&
      persona.video_use_approval_lock_version === persona.identity_lock_version,
  );
}

const RECONCILIATION_REVIEW_LABELS: Record<IdentityReviewCheckKey, string> = {
  same_person_across_references: "Alle Referenzen zeigen dieselbe Person",
  stable_face_structure: "Die Gesichtsstruktur ist stabil",
  stable_skin_tone: "Der Hautton ist stabil",
  stable_body_proportions: "Die Körperproportionen sind stabil",
  no_ai_anatomy_defects: "Keine offensichtlichen Anatomiefehler",
  no_inconsistent_age: "Die Altersdarstellung ist konsistent",
  no_changing_eye_color: "Die Augenfarbe ist konsistent",
  no_unapproved_hairline_change: "Keine unbestätigte Änderung des Haaransatzes",
  no_text_watermark_artifacts: "Keine Text- oder Wasserzeichenartefakte",
  realistic_hands_where_visible: "Sichtbare Hände wirken realistisch",
  suitable_for_image_generation: "Das Paket ist für die Image-Nutzung geeignet",
  suitable_for_video_generation:
    "Die Video-Identität ist geeignet (optional; erteilt keine Video-Freigabe)",
};

const EMPTY_RECONCILIATION_CHECKLIST = Object.fromEntries(
  IDENTITY_REVIEW_CHECK_KEYS.map((key) => [key, false]),
) as IdentityReviewChecklist;

const EMPTY_RECONCILIATION_CONFIRMATIONS: LegacyReconciliationConfirmations = {
  masterIdentityReferenceCorrect: false,
  requiredReferenceCoverageReviewed: false,
  samePersonAcrossReferences: false,
  noObviousIdentityMismatch: false,
  acceptableForImageUse: false,
  remainOfficialBrandModelIdentity: false,
};

const EMPTY_REFERENCE_RIGHTS_CONFIRMATIONS: ReferenceRightsConfirmations = {
  hasNecessaryRightsOrAuthorization: false,
  masterIdentityReferenceAuthorized: false,
  canonicalReferencesAuthorized: false,
  aiAssistedImageProductionAuthorized: false,
  workspaceBrandUseAuthorized: false,
};

export function PersonaStudio() {
  const studio = usePersonaStudio();

  return (
    <div className="ps-shell nx-studio">
      <header className="ps-header">
        <nav className="ps-breadcrumbs" aria-label="Brotkrümelnavigation">
          <Link href="/" className="ps-crumb">
            <Home className="size-3.5" />
            Xeriamo
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="ps-crumb ps-crumb-current">
            <UserRound className="size-3.5" />
            Persona Studio
          </span>
        </nav>
        <div className="ps-header-meta">
          <span className="ps-badge">Milaene Markenmodels</span>
          <span className="ps-badge ps-badge-muted">Identität · Rechte · Freigaben</span>
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
          <p className="ps-sidebar-title">Markenmodels</p>
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
            <p className="ps-sidebar-title">Weitere Studios</p>
            <div className="ps-future-card">
              <span>Image Studio</span>
              <em>Freigegebene Models verwenden</em>
            </div>
            <div className="ps-future-card">
              <span>Video Studio</span>
              <em>Später verfügbar</em>
            </div>
          </div>
        </aside>

        <main className="ps-main">
          {studio.loading && !studio.snapshot ? (
            <div className="ps-loading">
              <Loader2 className="size-7 animate-spin" />
              <p>Markenmodels werden geladen…</p>
            </div>
          ) : studio.error ? (
            <div className="ps-error">
              <p>{studio.error}</p>
              <button type="button" onClick={() => void studio.refresh()}>
                Erneut versuchen
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
      label: "Freigegebene Modelle",
      value: studio.counts.approved_personas,
      hint: `${studio.counts.review_personas} in Prüfung`,
      section: "personas" as const,
    },
    {
      label: "Orte",
      value: studio.counts.locations,
      hint: "Aktive Sets",
      section: "locations" as const,
    },
    {
      label: "Kamera-Vorgaben",
      value: studio.counts.camera_presets,
      hint: "Bildaufbau-Bibliothek",
      section: "camera" as const,
    },
    {
      label: "Posen-Sets",
      value: studio.counts.pose_packs,
      hint: "Aktive Posen",
      section: "poses" as const,
    },
    {
      label: "Markenlooks",
      value: studio.counts.brand_looks,
      hint: "Visuelle Systeme",
      section: "brand_looks" as const,
    },
    {
      label: "Outfits",
      value: studio.counts.outfits,
      hint: "Wiederverwendbare Sets",
      section: "outfits" as const,
    },
  ];

  return (
    <div className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <p className="nx-page-header__eyebrow">Wer trägt Milaene?</p>
          <h1>Markenmodelle</h1>
          <p>
            Entdecke Models, festige ihre Identität, prüfe Referenzrechte und gib sie gezielt für Produktionen frei.
          </p>
        </div>
      </header>

      <div className="ps-persona-home-actions">
        <button type="button" className="nx-card nx-card-button ps-persona-home-action" onClick={() => studio.setSection("personas")}><UserRound className="size-5" /><strong>Markenmodelle</strong><span>Alle Identitäten und ihren Fortschritt ansehen</span></button>
        <button type="button" className="nx-card nx-card-button ps-persona-home-action" onClick={() => studio.setSection("creator")}><UserPlus className="size-5" /><strong>Neues Model entdecken</strong><span>Vier Kandidaten vergleichen und bewusst auswählen</span></button>
        <button type="button" className="nx-card nx-card-button ps-persona-home-action" onClick={() => studio.setSection("brand_cast")}><CheckCircle2 className="size-5" /><strong>Freigegebene Modelle</strong><span>Produktionsbereite Mitglieder des Brand Cast</span></button>
        <button type="button" className="nx-card nx-card-button ps-persona-home-action" onClick={() => studio.setSection("creation_projects")}><Clapperboard className="size-5" /><strong>Modelle in Bearbeitung</strong><span>Offene Entdeckungen und Prüfungen fortsetzen</span></button>
      </div>

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
        <h2>So wird ein Model produktionsbereit</h2>
        <StudioStepper steps={PERSONA_PROGRESS_STEPS} current={0} />
        <p className="ps-muted">
          Nur ausdrücklich freigegebene Markenmodels dürfen im Image Studio verwendet werden. Identität und Rechte bleiben dabei geschützt.
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
      setError(err instanceof Error ? err.message : "Entwurf konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-panel ps-split">
      <div className="ps-list-pane">
        <header className="ps-panel-header compact">
          <div>
            <h1>Markenmodelle</h1>
            <p>Identität, Referenzen, Rechte und Produktionsfreigabe auf einen Blick.</p>
          </div>
          <button
            type="button"
            className="ps-btn"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="size-3.5" />
            Neu
          </button>
        </header>

        {creating ? (
          <div className="ps-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Name des Models"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Rolle"
              aria-label="Rolle des Models"
            />
            {error ? <p className="ps-inline-error">{error}</p> : null}
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy || !name.trim() || !role.trim()}
              onClick={() => void handleCreate()}
            >
              Entwurf anlegen
            </button>
          </div>
        ) : null}

        <ul className="ps-entity-list">
          {studio.personas.length === 0 ? (
            <li className="ps-empty-state ps-empty-state--inline">
              <p className="ps-eyebrow">Cast</p>
              <strong>Noch kein Markenmodel vorhanden.</strong>
              <p>Lege einen Entwurf an oder starte eine neue Model-Entdeckung.</p>
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
            <strong>Wähle ein Markenmodel aus.</strong>
            <p>
              Prüfe Identität, Referenzen, Rechte und Freigaben des ausgewählten Models.
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
        <div className="ps-readiness" data-testid="persona-readiness-header">
          <span
            className={`ps-ready-chip ps-ready-${readiness.visual_status ?? readiness.state}`}
            data-testid="persona-visual-status"
          >
            {ownerStatusLabel(readiness.visual_status ?? readiness.state)}
          </span>
          {readiness.reference_coverage ? (
            <span data-testid="persona-reference-coverage">
              Referenzen {readiness.reference_coverage.accepted}/
              {readiness.reference_coverage.required}
            </span>
          ) : null}
          <span>
            Identität: {readiness.identity_locked ? "festgeschrieben" : "noch offen"}
          </span>
          <span>
            Für Bilder:{" "}
            {readiness.image_identity_ready
              ? "bereit"
              : "noch nicht bereit"}
          </span>
          <span>
            Image-Freigabe:{" "}
            {readiness.image_use_approved ?? persona.image_use_approved
              ? "freigegeben"
              : "nicht freigegeben"}
          </span>
          <span>
            Video-Freigabe:{" "}
            {hasCurrentVideoApprovalProjection(persona)
              ? "freigegeben"
              : "nicht freigegeben"}
          </span>
          <span>
            Brand Cast:{" "}
            {readiness.brand_cast_approved ?? persona.brand_cast_approved
              ? "freigegeben"
              : "nicht freigegeben"}
          </span>
          {readiness.references_complete ? (
            <span data-testid="persona-visual-complete">
              Referenzpaket vollständig
            </span>
          ) : (
            <span className="ps-inline-error" data-testid="persona-visual-incomplete">
              Referenzen unvollständig
            </span>
          )}
        </div>
      ) : null}

      <dl className="ps-meta-grid">
        <Meta label="Geschlecht" value={persona.gender} />
        <Meta label="Altersspanne" value={persona.age_range} />
        <Meta label="Größe" value={persona.height} />
        <Meta label="Körperbau" value={persona.body_type} />
        <Meta label="Hautton" value={persona.skin_tone} />
        <Meta label="Haare" value={persona.hair} />
        <Meta label="Bart" value={persona.beard || "—"} />
        <Meta label="Augen" value={persona.eye_color} />
        <Meta label="Ausdruck" value={persona.expression} />
        <Meta label="Markenpassung" value={`${persona.brand_fit_score}`} />
        <Meta label="Persönlichkeit" value={persona.personality} />
        <Meta label="Stil" value={persona.style} />
        <Meta label="Hinweise zur Identität" value={persona.visual_identity_notes} />
        <Meta label="Unzulässige Änderungen" value={persona.prohibited_changes} />
        <Meta
          label="Image-Nutzung"
          value={persona.image_use_approved ? "freigegeben" : "nicht festgelegt"}
        />
        <Meta
          label="Video-Nutzung"
          value={hasCurrentVideoApprovalProjection(persona) ? "freigegeben" : "nicht festgelegt"}
        />
      </dl>

      {persona.notes ? <p className="ps-notes">{persona.notes}</p> : null}

      {error ? (
        <div className="ps-section ps-inline-error" data-testid="persona-section-error">
          <strong>Bereich konnte nicht geladen werden</strong>
          <p>{error}</p>
          <button
            type="button"
            className="ps-btn"
            onClick={() => {
              setError(null);
              studio.selectPersona(persona.id);
            }}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}

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

      <IdentityLockPanel
        persona={persona}
        references={allReferences}
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onLocked={() => studio.selectPersona(persona.id)}
        referenceRevision={studio.selectedReferences
          .map((a) => `${a.id}:${a.status}`)
          .sort()
          .join("|")}
      />

      {persona.identity_lock_status === "approved" ? (
        <ReferenceRightsPanel
          persona={persona}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onUpdated={() => studio.selectPersona(persona.id)}
        />
      ) : null}

      {persona.identity_lock_status === "approved" ? (
        <VideoIdentityReadinessPanel
          persona={persona}
          references={allReferences}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onReviewed={() => studio.reloadPersonaDetail(persona.id)}
        />
      ) : null}

      {persona.identity_lock_status === "approved" ? (
        <BrandModelApprovalsPanel
          persona={persona}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onApproved={() => studio.reloadPersonaDetail(persona.id)}
        />
      ) : null}

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
            <option value="all">Alle Typen</option>
            <option value="portrait">Porträt</option>
            <option value="profile">Profil</option>
            <option value="full_body">Ganzkörper</option>
            <option value="three_quarter">Dreiviertel</option>
            <option value="video_reference">Videoreferenz</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">Alle Status</option>
            <option value="uploaded">Hochgeladen</option>
            <option value="review">In Prüfung</option>
            <option value="approved">Freigegeben</option>
            <option value="rejected">Abgelehnt</option>
            <option value="archived">Archiviert</option>
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
                          ? "MASTER-IDENTITÄTSREFERENZ — ursprünglich ausgewähltes Markenmodel"
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
                      label="MASTER-IDENTITÄTSREFERENZ"
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
                    ? "Master-Porträt"
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
                    Unterstützende Referenz – kann nicht zum Master werden
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
                    const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
                    const historical =
                      asset.status === "superseded" ||
                      (pkgMeta != null && asset.status !== "review");
                    const msg = historical
                      ? "Historische Referenz wird entfernt. Die aktuelle genehmigte Referenz bleibt unverändert. Fortfahren?"
                      : "Referenz wirklich löschen?";
                    if (!window.confirm(msg)) return;
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
          allReferences={allReferences}
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
          onMirroredCreated={(derivedAssetId) => {
            void studio.selectPersona(persona.id);
            setPreviewAssetId(derivedAssetId);
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}

      <section className="ps-section">
        <h3>Bevorzugte Produktionsbibliotheken</h3>
        <RelationBlock
          title="Orte"
          ids={persona.preferred_location_ids}
          options={studio.locations.map((l) => ({ id: l.id, label: l.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "locations", ids }),
            )
          }
        />
        <RelationBlock
          title="Kamera-Vorgaben"
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
          title="Posen"
          ids={persona.preferred_pose_ids}
          options={studio.poses.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(ids) =>
            void run(() =>
              studio.patchPersona(persona.id, { kind: "poses", ids }),
            )
          }
        />
        <RelationBlock
          title="Markenlooks"
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
        <h3>Freigabeablauf</h3>
        <div className="ps-actions">
          <button
            type="button"
            className="ps-btn"
            disabled={busy}
            onClick={() =>
              void run(() =>
                studio.patchPersona(persona.id, {
                  visual_identity_notes:
                    persona.visual_identity_notes || "Festgeschriebene Brand-Cast-Identität",
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
              Zur Prüfung senden
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
              Freigeben
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
              Archivieren
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
              Als Entwurf wieder öffnen
            </button>
          )}
          <button
            type="button"
            className="ps-btn ps-btn-danger"
            disabled={busy}
            onClick={() => void run(() => studio.removePersona(persona.id))}
          >
            Löschen
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
      description="Sets und Umgebungen für konsistente Brand-Cast-Aufnahmen."
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
      description="Stimmungs- und Farbsysteme für den Brand Cast."
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
          <p className="ps-eyebrow">Bibliothek</p>
          <strong>Noch kein Eintrag in diesem Bereich.</strong>
          <p>Füge den ersten Eintrag hinzu, um Brand-Cast-Aufnahmen konsistent zu halten.</p>
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

function IdentityLockPanel({
  persona,
  references,
  busy,
  onBusy,
  onError,
  onLocked,
  referenceRevision,
}: {
  persona: Persona;
  references: PersonaReferenceAssetView[];
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onLocked: () => void;
  referenceRevision: string;
}) {
  const [eligibility, setEligibility] = useState<IdentityLockEligibilityView | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [reconciliation, setReconciliation] =
    useState<LegacyIdentityReconciliationView | null>(null);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(
    null,
  );
  const [reconciliationChecklist, setReconciliationChecklist] =
    useState<IdentityReviewChecklist>({ ...EMPTY_RECONCILIATION_CHECKLIST });
  const [reconciliationConfirmations, setReconciliationConfirmations] =
    useState<LegacyReconciliationConfirmations>({
      ...EMPTY_RECONCILIATION_CONFIRMATIONS,
    });
  const [reconciliationAcknowledged, setReconciliationAcknowledged] =
    useState(false);
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const identityLocked = persona.identity_lock_status === "approved";
  const refById = new Map(references.map((r) => [r.id, r]));
  const master = references.find((r) => parseMasterIdentityNotes(r.notes)) ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [res, reconciliationRes] = await Promise.all([
          fetch(`/api/persona/${persona.id}/identity-lock`),
          fetch(`/api/persona/${persona.id}/identity-reconciliation`),
        ]);
        const data = (await res.json().catch(() => null)) as {
          eligibility?: IdentityLockEligibilityView;
          error?: string;
          code?: string;
        } | null;
        if (!res.ok) {
          throw new Error(
            data?.error ??
              `Identity lock status failed (${res.status})`,
          );
        }
        const reconciliationData = (await reconciliationRes
          .json()
          .catch(() => null)) as {
          reconciliation?: LegacyIdentityReconciliationView;
          error?: string;
        } | null;
        if (!reconciliationRes.ok) {
          throw new Error(
            reconciliationData?.error ??
              `Identity reconciliation status failed (${reconciliationRes.status})`,
          );
        }
        if (!cancelled) {
          if (data?.eligibility) setEligibility(data.eligibility);
          setReconciliation(reconciliationData?.reconciliation ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error
              ? err.message
              : "Status der Identitätsfestschreibung konnte nicht geladen werden",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona.id, referenceRevision, identityLocked, onError]);

  async function confirmLock() {
    onBusy(true);
    setLockError(null);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${persona.id}/identity-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock", confirmIdentityLock: true }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        stage?: string;
        requestId?: string;
        code?: string;
        persona?: Persona;
      } | null;
      if (!res.ok) {
        const parts = [
          body?.error ?? res.statusText,
          body?.stage ? `stage=${body.stage}` : null,
          body?.requestId ? `requestId=${body.requestId}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(" · "));
      }
      setConfirmOpen(false);
      setLockError(null);
      // Reload persona + readiness + identity-lock eligibility (no manual refresh).
      onLocked();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Identität konnte nicht festgeschrieben werden";
      setLockError(msg);
      // Contained Identity Lock error — do not claim success / do not mutate refs.
      onError(null);
    } finally {
      onBusy(false);
    }
  }

  async function submitReconciliation(decision: "approved" | "rejected") {
    if (!reconciliation?.sourceSnapshot) return;
    onBusy(true);
    setReconciliationError(null);
    onError(null);
    try {
      const res = await fetch(
        `/api/persona/${persona.id}/identity-reconciliation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            expectedSnapshotId: reconciliation.sourceSnapshot.id,
            expectedLockVersion: reconciliation.sourceSnapshot.lockVersion,
            decision,
            acknowledgeHistoricalProvenanceMissing: reconciliationAcknowledged,
            checklist: reconciliationChecklist,
            confirmations: reconciliationConfirmations,
            reviewerNotes: reconciliationNotes,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Reconciliation failed (${res.status})`);
      }
      setReconciliationOpen(false);
      onLocked();
    } catch (err) {
      setReconciliationError(
        err instanceof Error ? err.message : "Identitätsabgleich fehlgeschlagen",
      );
    } finally {
      onBusy(false);
    }
  }

  const preview = eligibility?.preview;
  const canonicalSlots =
    reconciliation?.sourceSnapshot?.canonicalReferences ??
    preview?.canonicalReferences ??
    [];
  const reconciliationVisualEvidenceAvailable = Boolean(
    master?.signed_url &&
      canonicalSlots.length === REFERENCE_PACKAGE_SLOTS.length &&
      canonicalSlots.every((slot) => refById.get(slot.assetId)?.signed_url),
  );
  const requiredReviewPassed = IDENTITY_REVIEW_CHECK_KEYS.filter(
    (key) => key !== "suitable_for_video_generation",
  ).every((key) => reconciliationChecklist[key] === true);
  const confirmationsPassed = Object.values(reconciliationConfirmations).every(
    (value) => value === true,
  );

  function provenanceBadge(provenance: string): string {
    switch (provenance) {
      case "human_warning_approved":
        return "Warnung menschlich bestätigt";
      case "human_mismatch_override":
        return "Menschliche Überschreibung";
      case "derived_mirror":
        return "Abgeleitetes Spiegelbild";
      case "reassigned":
        return "Neu zugeordnet";
      case "replacement_approved":
        return "Ersetzung freigegeben";
      default:
        return "Maschinelle Übereinstimmung";
    }
  }

  return (
    <section className="ps-section" data-testid="identity-lock-panel">
      <h3>IDENTITÄTSFESTSCHREIBUNG</h3>
      {identityLocked ? (
        <>
          <PersonaStatusChip label="Festgeschrieben" tone="selected" />
          <p className="ps-muted">
            Offizielles Identitätspaket · 1 Master + 5 unterstützende Referenzen
            {persona.identity_locked_at
              ? ` · festgeschrieben ${new Date(persona.identity_locked_at).toLocaleString("de-DE")}`
              : ""}
          </p>
          {!reconciliationVisualEvidenceAvailable ? (
            <p className="ps-inline-error">
              Eine oder mehrere private Referenzvorschauen sind nicht verfügbar. Lade neu oder
              stelle den signierten Zugriff wieder her, bevor du entscheidest.
            </p>
          ) : null}
        </>
      ) : (
        <p className="ps-muted">
          Schreibe genau diesen Master und die fünf kanonischen Referenzen als dauerhafte
          Markenmodel-Identität fest. Keine Generierung — nur ausdrückliche Freigabe.
        </p>
      )}

      {reconciliation?.requiresHumanReconciliation ? (
        <div
          className="ps-reconciliation-warning"
          data-testid="legacy-identity-reconciliation-required"
        >
          <strong>Ältere Identität muss abgeglichen werden</strong>
          <p>
            Die historische Festschreibung Version {reconciliation.sourceSnapshot?.lockVersion ?? "—"}
            enthält keine exakt gespeicherte Vor-Lock-Prüfherkunft. Sie bleibt erhalten, aber die
            nachgelagerte Markenmodel-Nutzung bleibt gesperrt, bis du eine aktuelle menschliche Prüfung vornimmst.
          </p>
          <p className="ps-muted">
            Aktuelles Paket: {reconciliation.currentPackage.coverage.accepted}/
            {reconciliation.currentPackage.coverage.required} Referenzen · Master
            {" "}
            {reconciliation.currentPackage.masterReferenceAssetId
              ? "vorhanden"
              : "fehlt"}
            {" · "}
            {reconciliation.currentPackage.packageMatchesHistoricalSnapshot
              ? "stimmt mit historischer Festschreibung überein"
              : "stimmt nicht mit historischer Festschreibung überein"}
          </p>
          {reconciliation.blockingReasons.length > 0 ? (
            <ul className="ps-inline-error">
              {reconciliation.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            disabled={busy || !reconciliation.canReconcile}
            data-testid="open-legacy-identity-reconciliation"
            onClick={() => setReconciliationOpen(true)}
          >
            Identität prüfen und abgleichen
          </button>
        </div>
      ) : null}

      {eligibility ? (
        <div className="ps-muted">
          Abdeckung {eligibility.coverage.accepted}/{eligibility.coverage.required} ·
          Reference Package:{" "}
          {eligibility.referencePackageReady ? "Bereit" : "Unvollständig"}
        </div>
      ) : null}

      {!identityLocked && eligibility && !eligibility.eligibleForIdentityLock ? (
        <ul className="ps-inline-error">
          {eligibility.blockingReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="ps-ref-pkg-slots">
        {master ? (
          <div className="ps-ref-pkg-slot" data-testid="identity-lock-master">
            <strong>MASTER-IDENTITÄT</strong>
            {master.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={master.signed_url}
                alt="Master-Identitätsreferenz"
                className="ps-ref-thumb"
              />
            ) : (
              <span className="ps-muted">Master-Referenz</span>
            )}
          </div>
        ) : (
          <p className="ps-inline-error">Master-Identitätsreferenz fehlt</p>
        )}

        <ul className="ps-ref-pkg-slots">
          {canonicalSlots.map((slot) => {
            const asset = refById.get(slot.assetId);
            return (
              <li
                key={slot.slot}
                className="ps-ref-pkg-slot"
                data-testid={`identity-lock-slot-${slot.slot}`}
              >
                <strong>{REFERENCE_PACKAGE_SLOT_LABELS[slot.slot]}</strong>
                {asset?.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.signed_url}
                    alt={REFERENCE_PACKAGE_SLOT_LABELS[slot.slot]}
                    className="ps-ref-thumb"
                  />
                ) : null}
                <span className="ps-ref-pkg-meta">{provenanceBadge(slot.provenance)}</span>
                {slot.effectiveSlot !== slot.slot ? (
                  <span className="ps-ref-pkg-meta">Effective: {slot.effectiveSlot}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {!identityLocked && eligibility?.eligibleForIdentityLock ? (
        <button
          type="button"
          className="ps-btn ps-btn-primary"
          disabled={busy}
          data-testid="lock-brand-identity"
          onClick={() => setConfirmOpen(true)}
        >
          LOCK BRAND IDENTITY
        </button>
      ) : null}

      {confirmOpen ? (
        <div className="ps-ref-pkg-confirm" data-testid="identity-lock-confirm">
          <h4>Diese Markenidentität festschreiben?</h4>
          <p>
            This Master + these five references will become the official permanent
            identity package for this Brand Model. Future Image Studio and Video
            Studio outputs will use this identity. Normal reference editing will be
            disabled after locking.
          </p>
          <p className="ps-muted">Keine Provider-Kosten.</p>
          {lockError ? (
            <div className="ps-inline-error" data-testid="identity-lock-error">
              <strong>Festschreiben der Identität fehlgeschlagen</strong>
              <p>{lockError}</p>
            </div>
          ) : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setLockError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="confirm-identity-lock"
              onClick={() => void confirmLock()}
            >
              Confirm Identity Lock
            </button>
          </div>
        </div>
      ) : null}

      {reconciliationOpen && reconciliation?.sourceSnapshot ? (
        <div
          className="ps-ref-pkg-confirm ps-reconciliation-review"
          data-testid="legacy-identity-reconciliation-review"
        >
          <h4>PRÜFUNG DES ÄLTEREN IDENTITÄTSABGLEICHS</h4>
          <p>
            Review the current immutable Master and all five reference images
            shown above. This is a present-day owner decision—not evidence that a
            historical review occurred.
          </p>
          <label className="ps-check">
            <input
              type="checkbox"
              checked={reconciliationAcknowledged}
              onChange={(event) =>
                setReconciliationAcknowledged(event.target.checked)
              }
            />
            I understand that historical review provenance is fehlt and this
            records a new reconciliation review now.
          </label>

          <div className="ps-reconciliation-checks">
            {IDENTITY_REVIEW_CHECK_KEYS.map((key) => (
              <label className="ps-check" key={key}>
                <input
                  type="checkbox"
                  checked={reconciliationChecklist[key]}
                  onChange={(event) =>
                    setReconciliationChecklist((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {RECONCILIATION_REVIEW_LABELS[key]}
              </label>
            ))}
          </div>

          <div className="ps-reconciliation-checks">
            <label className="ps-check">
              <input
                type="checkbox"
                checked={reconciliationConfirmations.masterIdentityReferenceCorrect}
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    masterIdentityReferenceCorrect: event.target.checked,
                  }))
                }
              />
              Master-Identitätsreferenz is correct
            </label>
            <label className="ps-check">
              <input
                type="checkbox"
                checked={
                  reconciliationConfirmations.requiredReferenceCoverageReviewed
                }
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    requiredReferenceCoverageReviewed: event.target.checked,
                  }))
                }
              />
              I reviewed all 5/5 required reference roles
            </label>
            <label className="ps-check">
              <input
                type="checkbox"
                checked={reconciliationConfirmations.samePersonAcrossReferences}
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    samePersonAcrossReferences: event.target.checked,
                  }))
                }
              />
              The images represent the same person
            </label>
            <label className="ps-check">
              <input
                type="checkbox"
                checked={reconciliationConfirmations.noObviousIdentityMismatch}
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    noObviousIdentityMismatch: event.target.checked,
                  }))
                }
              />
              No obvious identity mismatch is present
            </label>
            <label className="ps-check">
              <input
                type="checkbox"
                checked={reconciliationConfirmations.acceptableForImageUse}
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    acceptableForImageUse: event.target.checked,
                  }))
                }
              />
              The package is acceptable for Image use
            </label>
            <label className="ps-check">
              <input
                type="checkbox"
                checked={
                  reconciliationConfirmations.remainOfficialBrandModelIdentity
                }
                onChange={(event) =>
                  setReconciliationConfirmations((current) => ({
                    ...current,
                    remainOfficialBrandModelIdentity: event.target.checked,
                  }))
                }
              />
              This package may remain the official Brand Model identity
            </label>
          </div>

          <label className="ps-upload">
            Review notes (required for rejection)
            <textarea
              value={reconciliationNotes}
              maxLength={2000}
              rows={3}
              onChange={(event) => setReconciliationNotes(event.target.value)}
            />
          </label>

          <p className="ps-muted">
            Approval creates lock version {reconciliation.sourceSnapshot.lockVersion + 1}
            {" "}with this current review. Version {reconciliation.sourceSnapshot.lockVersion}
            {" "}is not changed. Existing approval values are preserved because the
            package must match exactly; Video approval is never granted here.
          </p>
          {reconciliationError ? (
            <p className="ps-inline-error" data-testid="reconciliation-error">
              {reconciliationError}
            </p>
          ) : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => setReconciliationOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-danger"
              disabled={
                busy ||
                !reconciliationAcknowledged ||
                !reconciliationNotes.trim()
              }
              data-testid="reject-legacy-identity-reconciliation"
              onClick={() => void submitReconciliation("rejected")}
            >
              Reject current identity
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={
                busy ||
                !reconciliationAcknowledged ||
                !requiredReviewPassed ||
                !confirmationsPassed ||
                !reconciliationVisualEvidenceAvailable
              }
              data-testid="approve-legacy-identity-reconciliation"
              onClick={() => void submitReconciliation("approved")}
            >
              Approve &amp; Create New Lock Version
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReferenceRightsPanel({
  persona,
  busy,
  onBusy,
  onError,
  onUpdated,
}: {
  persona: Persona;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (message: string | null) => void;
  onUpdated: () => void;
}) {
  const [view, setView] = useState<ReferenceRightsView | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmations, setConfirmations] =
    useState<ReferenceRightsConfirmations>({
      ...EMPTY_REFERENCE_RIGHTS_CONFIRMATIONS,
    });
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/persona/${persona.id}/reference-rights`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => null)) as {
          rights?: ReferenceRightsView;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(
            body?.error ?? `Reference rights status failed (${response.status})`,
          );
        }
        if (!cancelled) setView(body?.rights ?? null);
      } catch (error) {
        if (!cancelled) {
          onError(
            error instanceof Error
              ? error.message
              : "Status der Referenzrechte konnte nicht geladen werden",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona.id, persona.updated_at, onError]);

  async function submit(decision: "confirmed" | "rejected") {
    if (!view) return;
    onBusy(true);
    onError(null);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/persona/${persona.id}/reference-rights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            expectedIdentityLockSnapshotId: view.identityLockSnapshotId,
            expectedIdentityLockVersion: view.identityLockVersion,
            expectedIdentityFingerprint: view.identityFingerprint,
            decision,
            confirmations,
            rejectionReason,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        result?: { rights?: ReferenceRightsView };
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error ?? `Reference rights decision failed (${response.status})`,
        );
      }
      if (body?.result?.rights) setView(body.result.rights);
      setReviewOpen(false);
      onUpdated();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Entscheidung zu den Referenzrechten fehlgeschlagen",
      );
    } finally {
      onBusy(false);
    }
  }

  const allConfirmed = Object.values(confirmations).every(Boolean);

  return (
    <section className="ps-section" data-testid="reference-rights-panel">
      <h3>REFERENZRECHTE</h3>
      {!view ? (
        <p className="ps-muted">Referenzrechte werden geprüft…</p>
      ) : view.rightsConfirmed ? (
        <>
          <PersonaStatusChip label="REFERENZRECHTE BESTÄTIGT" tone="selected" />
          <p className="ps-muted">
            Master plus 5/5 kanonische Referenzen sind für das aktuell festgeschriebene Markenmodel auf Asset-Ebene autorisiert.
            {view.exactAuditedConfirmation
              ? " Die geprüfte Bestätigung ist exakt mit dieser Lock-Version verknüpft."
              : ""}
          </p>
        </>
      ) : (
        <div className="ps-reconciliation-warning">
          <strong>Bestätigung der Referenzrechte erforderlich</strong>
          <p>
            {view.missingRightsAssetIds.length} von 6 festgeschriebenen Identitäts-Assets besitzen keine dauerhaft gespeicherte Rechtebestätigung. Das Image Studio bleibt gesperrt.
          </p>
          <ul className="ps-completeness">
            {view.assetRights.map((asset) => (
              <li
                key={asset.assetId}
                className={asset.rightsConfirmed ? "is-ok" : ""}
              >
                {asset.role.replaceAll("_", " ")} · {asset.rightsConfirmed ? "bestätigt" : "fehlt"}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            disabled={busy || !view.canConfirm}
            data-testid="open-reference-rights-review"
            onClick={() => setReviewOpen(true)}
          >
            Referenzrechte prüfen &amp; bestätigen
          </button>
        </div>
      )}

      {reviewOpen && view ? (
        <div className="ps-ref-pkg-confirm ps-reconciliation-review">
          <h4>Referenzrechte bestätigen</h4>
          <p>
            Bestätige nur, wenn du die erforderlichen Rechte oder Autorisierungen für den exakten Master und die fünf kanonischen Referenzen der Identitätsfestschreibung besitzt.
          </p>
          {(
            [
              [
                "hasNecessaryRightsOrAuthorization",
                "Ich besitze die erforderlichen Rechte oder Autorisierungen für diese Identitäts-Assets.",
              ],
              [
                "masterIdentityReferenceAuthorized",
                "Die Master-Identitätsreferenz ist für diese Nutzung autorisiert.",
              ],
              [
                "canonicalReferencesAuthorized",
                "Alle fünf kanonischen Referenzen sind für diese Nutzung autorisiert.",
              ],
              [
                "aiAssistedImageProductionAuthorized",
                "Diese Assets dürfen für KI-gestützte Produktionen im Image Studio verwendet werden.",
              ],
              [
                "workspaceBrandUseAuthorized",
                "Diese Autorisierung gilt für die Markenproduktion von Milaene im aktuellen Arbeitsbereich.",
              ],
            ] as const
          ).map(([key, label]) => (
            <label className="ps-check" key={key}>
              <input
                type="checkbox"
                checked={confirmations[key]}
                onChange={(event) =>
                  setConfirmations((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
          <label className="ps-upload">
            Ablehnungsgrund (nur bei Ablehnung erforderlich)
            <textarea
              rows={3}
              maxLength={2000}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
            />
          </label>
          <p className="ps-muted">
            Geltungsbereich: aktuelle Lock-Version {view.identityLockVersion}. Es wird keine Bildgenerierung gestartet.
          </p>
          {actionError ? <p className="ps-inline-error">{actionError}</p> : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => setReviewOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-danger"
              disabled={busy || !rejectionReason.trim()}
              onClick={() => void submit("rejected")}
            >
              Rechtebestätigung ablehnen
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy || !allConfirmed}
              data-testid="confirm-reference-rights"
              onClick={() => void submit("confirmed")}
            >
              Referenzrechte bestätigen
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const VIDEO_REVIEW_LABELS: Record<keyof VideoIdentityReviewChecklist, string> = {
  faceIdentityStable: "Gesichtsidentität bleibt über alle Referenzen stabil",
  masterReferenceValid: "Master-Referenz ist eindeutig und gültig",
  anglesSufficient: "Blickwinkel reichen für Video-Bewegung aus",
  hairstyleConsistent: "Frisur und Haarlinie sind konsistent",
  facialHairConsistent: "Gesichtsbehaarung ist konsistent",
  ageAppearanceConsistent: "Alterswirkung ist konsistent",
  bodyFrameUsable: "Körperbau ist für die Videoquelle nachvollziehbar",
  noIdentityConflict: "Es gibt keinen ungelösten Identitätskonflikt",
  referencesSuitableForMotion: "Referenzen sind für Bewegungsübertragung geeignet",
};

const VIDEO_REFERENCE_ROLE_LABELS: Record<
  VideoIdentityReadinessView["canonicalReferences"][number]["role"],
  string
> = {
  front: "Frontal",
  three_quarter_left: "Dreiviertel links",
  three_quarter_right: "Dreiviertel rechts",
  left_profile: "Profil links",
  right_profile: "Profil rechts",
};

function emptyVideoReviewChecklist(): VideoIdentityReviewChecklist {
  return Object.fromEntries(
    Object.keys(VIDEO_REVIEW_LABELS).map((key) => [key, false]),
  ) as VideoIdentityReviewChecklist;
}

function VideoIdentityReadinessPanel({
  persona,
  references,
  busy,
  onBusy,
  onError,
  onReviewed,
}: {
  persona: Persona;
  references: PersonaReferenceAssetView[];
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (message: string | null) => void;
  onReviewed: () => Promise<void>;
}) {
  const [view, setView] = useState<VideoIdentityReadinessView | null>(null);
  const [checklist, setChecklist] = useState<VideoIdentityReviewChecklist>(
    emptyVideoReviewChecklist,
  );
  const [note, setNote] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadReadinessView(): Promise<VideoIdentityReadinessView | null> {
    const response = await fetch(`/api/persona/${persona.id}/video-identity-review`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as {
      readiness?: VideoIdentityReadinessView;
      error?: string;
    } | null;
    if (!response.ok || !data?.readiness) {
      return null;
    }
    return data.readiness;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const readiness = await loadReadinessView();
        if (!cancelled && readiness) setView(readiness);
      } catch (error) {
        if (!cancelled) {
          onError(
            error instanceof Error
              ? error.message
              : "Video-Bereitschaft konnte nicht geladen werden.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona.id, persona.video_identity_ready, onError]);

  async function submit(decision: "APPROVE" | "REJECT") {
    if (!view || busy) return;
    onBusy(true);
    onError(null);
    setActionError(null);
    setStatusMessage(VIDEO_IDENTITY_REVIEW_SAVING_LABEL);
    try {
      const response = await fetch(
        `/api/persona/${persona.id}/video-identity-review`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            expectedIdentityLockSnapshotId: view.identityLockSnapshotId,
            expectedIdentityLockVersion: view.identityLockVersion,
            expectedIdentityFingerprint: view.identityFingerprint,
            expectedReferencePackageFingerprint:
              view.referencePackageFingerprint,
            checklist,
            decision,
            note,
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? response.statusText);

      setReviewOpen(false);
      setChecklist(emptyVideoReviewChecklist());
      setNote("");

      const reconcileResult = await reconcileAfterPersonaMutation({
        reloadPersona: onReviewed,
        reloadPanelState: loadReadinessView,
        applyPanelState: setView,
      });
      if (reconcileResult.refreshWarning) {
        setActionError(reconcileResult.refreshWarning);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Video-Identitätsprüfung konnte nicht gespeichert werden.",
      );
    } finally {
      onBusy(false);
      setStatusMessage(null);
    }
  }

  const referenceById = new Map(references.map((reference) => [reference.id, reference]));
  const master = view ? referenceById.get(view.masterReferenceAssetId) : null;
  const allChecked = Object.values(checklist).every(Boolean);

  return (
    <section className="ps-section" data-testid="video-identity-readiness-panel">
      <div className="ps-section-heading-row">
        <div>
          <p className="ps-kicker">VIDEO-MEILENSTEIN</p>
          <h3>Video-Identität</h3>
          <p className="ps-muted">
            Die Bildfreigabe ersetzt diese eigenständige menschliche Prüfung nicht.
          </p>
        </div>
        <span className={`ps-ready-chip ${view?.videoIdentityReady ? "is-ok" : ""}`}>
          {view?.videoIdentityReady
            ? "Video-Identität bereit"
            : "Video noch nicht bereit"}
        </span>
      </div>

      {view ? (
        <>
          <ul className="ps-completeness">
            <li className="is-ok">Identity Lock · Version {view.identityLockVersion}</li>
            <li className={view.referencePackageSufficientForV1 ? "is-ok" : ""}>
              Referenzpaket · {view.referencePackageSufficientForV1 ? "vollständig" : "unvollständig"}
            </li>
            <li className={view.referenceRightsConfirmed ? "is-ok" : ""}>
              Referenzrechte · {view.referenceRightsConfirmed ? "bestätigt" : "offen"}
            </li>
            <li className={view.currentReview?.decision === "APPROVE" ? "is-ok" : ""}>
              Menschliche Prüfung · {view.currentReview
                ? view.currentReview.decision === "APPROVE"
                  ? "bestanden"
                  : "abgelehnt"
                : "offen"}
            </li>
          </ul>

          {view.blockers.map((blocker) => (
            <p className="ps-inline-error" key={blocker}>{blocker}</p>
          ))}

          {statusMessage ? (
            <p className="ps-muted" data-testid="video-identity-review-saving">
              {statusMessage}
            </p>
          ) : null}

          {!view.videoIdentityReady && view.canReview && !reviewOpen ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="open-video-identity-review"
              onClick={() => setReviewOpen(true)}
            >
              Video-Identität prüfen
            </button>
          ) : null}

          {reviewOpen ? (
            <div className="ps-video-review" data-testid="video-identity-review-form">
              <div className="ps-video-review-references">
                <figure className="ps-video-master-reference">
                  {master?.signed_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived private signed reference
                    <img src={master.signed_url} alt="Master-Identitätsreferenz" />
                  ) : (
                    <div className="ps-ref-empty">Vorschau nicht verfügbar</div>
                  )}
                  <figcaption>Master-Identitätsreferenz</figcaption>
                </figure>
                <div className="ps-video-reference-grid">
                  {view.canonicalReferences.map((entry) => {
                    const reference = referenceById.get(entry.assetId);
                    return (
                      <figure key={entry.assetId}>
                        {reference?.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived private signed reference
                          <img
                            src={reference.signed_url}
                            alt={VIDEO_REFERENCE_ROLE_LABELS[entry.role]}
                          />
                        ) : (
                          <div className="ps-ref-empty">Keine Vorschau</div>
                        )}
                        <figcaption>{VIDEO_REFERENCE_ROLE_LABELS[entry.role]}</figcaption>
                      </figure>
                    );
                  })}
                </div>
              </div>

              <fieldset className="ps-video-review-checklist">
                <legend>Prüfliste</legend>
                {(Object.keys(VIDEO_REVIEW_LABELS) as Array<keyof VideoIdentityReviewChecklist>).map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={checklist[key]}
                      onChange={(event) =>
                        setChecklist((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{VIDEO_REVIEW_LABELS[key]}</span>
                  </label>
                ))}
              </fieldset>
              <label className="ps-field">
                <span>Notiz (optional)</span>
                <textarea
                  value={note}
                  maxLength={2_000}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {actionError ? <p className="ps-inline-error">{actionError}</p> : null}
              <div className="ps-btn-row">
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() => setReviewOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="ps-btn ps-btn-danger"
                  disabled={busy}
                  data-testid="reject-video-identity-review"
                  onClick={() => void submit("REJECT")}
                >
                  Prüfung ablehnen
                </button>
                <button
                  type="button"
                  className="ps-btn ps-btn-primary"
                  disabled={busy || !allChecked}
                  data-testid="approve-video-identity-review"
                  onClick={() => void submit("APPROVE")}
                >
                  Video-Identität bestätigen
                </button>
              </div>
              <details>
                <summary>Technische Details</summary>
                <dl className="ps-meta-grid">
                  <Meta label="Lock-Version" value={`v${view.identityLockVersion}`} />
                  <Meta label="Lock-Snapshot" value={view.identityLockSnapshotId} />
                  <Meta label="Identitätsfingerabdruck" value={view.identityFingerprint} />
                  <Meta label="Referenzpaket-Fingerabdruck" value={view.referencePackageFingerprint} />
                </dl>
              </details>
            </div>
          ) : null}
        </>
      ) : (
        <p className="ps-muted">Video-Bereitschaft wird geprüft …</p>
      )}
    </section>
  );
}

function BrandModelApprovalsPanel({
  persona,
  busy,
  onBusy,
  onError,
  onApproved,
}: {
  persona: Persona;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
  onApproved: () => Promise<void>;
}) {
  const [view, setView] = useState<BrandModelApprovalsView | null>(null);
  const [confirmGate, setConfirmGate] = useState<
    "image_use" | "video_use" | "brand_cast" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadApprovalsView(): Promise<BrandModelApprovalsView | null> {
    const res = await fetch(`/api/persona/${persona.id}/use-approvals`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      approvals?: BrandModelApprovalsView;
      error?: string;
    } | null;
    if (!res.ok || !data?.approvals) {
      return null;
    }
    return data.approvals;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const approvals = await loadApprovalsView();
        if (!cancelled && approvals) setView(approvals);
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : "Freigabestatus konnte nicht geladen werden.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    persona.id,
    persona.image_use_approved,
    persona.video_use_approved,
    persona.brand_cast_approved,
    persona.approved,
    persona.status,
    persona.video_identity_ready,
    onError,
  ]);

  async function confirmApproval() {
    if (!confirmGate || busy) return;
    onBusy(true);
    setActionError(null);
    onError(null);
    setStatusMessage(
      confirmGate === "video_use"
        ? VIDEO_USE_APPROVAL_SAVING_LABEL
        : confirmGate === "image_use"
          ? "Image-Freigabe wird gespeichert …"
          : "Brand-Cast-Freigabe wird gespeichert …",
    );
    try {
      const body =
        confirmGate === "image_use"
          ? { action: "approve_image_use", confirmImageUseApproval: true }
          : confirmGate === "video_use"
            ? { action: "approve_video_use", confirmVideoUseApproval: true }
            : { action: "approve_brand_cast", confirmBrandCastApproval: true };
      const res = await fetch(`/api/persona/${persona.id}/use-approvals`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        persona?: Persona;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? res.statusText);
      }
      setConfirmGate(null);

      const reconcileResult = await reconcileAfterPersonaMutation({
        reloadPersona: onApproved,
        reloadPanelState: loadApprovalsView,
        applyPanelState: setView,
      });
      if (reconcileResult.refreshWarning) {
        setActionError(reconcileResult.refreshWarning);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Freigabe fehlgeschlagen.",
      );
    } finally {
      onBusy(false);
      setStatusMessage(null);
    }
  }

  const imageApproved =
    view?.imageUse.alreadyApproved ?? persona.image_use_approved;
  const videoApproved =
    view?.videoUse.alreadyApproved ?? hasCurrentVideoApprovalProjection(persona);
  const brandCastApproved =
    view?.brandCast.alreadyApproved ??
    persona.brand_cast_approved;

  function blockerLabel(reason: string): string {
    const labels: Record<string, string> = {
      "Identity is not locked": "Die Identität ist noch nicht festgeschrieben.",
      "Valid identity lock snapshot and persisted identity review are missing or unresolved":
        "Der aktuelle Identity Lock kann nicht sicher aufgelöst werden.",
      "Identity lock snapshot does not belong to this Persona":
        "Der Identity Lock gehört nicht zu diesem Markenmodel.",
      "Locked Brand Model reference rights are not confirmed.":
        "Die Referenzrechte des festgeschriebenen Markenmodels sind nicht bestätigt.",
      "Image identity validation is not complete":
        "Die Identitätsprüfung für Bilder ist nicht abgeschlossen.",
      "Identity revision is pending": "Eine Identitätsüberarbeitung ist offen.",
      "Persona is archived": "Dieses Markenmodel ist archiviert.",
      "Image Studio use is not approved":
        "Die Nutzung im Image Studio ist nicht freigegeben.",
      "Official Brand Cast not approved":
        "Das Markenmodel ist noch nicht im Brand Cast freigegeben.",
    };
    return labels[reason] ?? reason;
  }

  return (
    <section className="ps-section" data-testid="brand-model-approvals-panel">
      <h3>FREIGABEN DES MARKENMODELS</h3>
      <ul className="ps-completeness" data-testid="brand-model-approvals-list">
        <li className="is-ok">
          Identität · festgeschrieben
        </li>
        <li className={imageApproved ? "is-ok" : ""}>
          Image Studio · {imageApproved ? "freigegeben" : "nicht freigegeben"}
          {!imageApproved && view?.imageUse.eligible ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="approve-image-use"
              onClick={() => setConfirmGate("image_use")}
            >
              Für Image Studio freigeben
            </button>
          ) : null}
          {!imageApproved && view && !view.imageUse.eligible
            ? view.imageUse.blockingReasons.map((r) => (
                <span key={r} className="ps-muted">
                  {blockerLabel(r)}
                </span>
              ))
            : null}
        </li>
        <li className={videoApproved ? "is-ok" : ""}>
          Video Studio ·{" "}
          {videoApproved
            ? "freigegeben"
            : view?.videoUse.statusLabel === "Not ready"
              ? "noch nicht bereit"
              : "nicht freigegeben"}
          {!videoApproved && view?.videoUse.eligible ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="approve-video-use"
              onClick={() => setConfirmGate("video_use")}
            >
              Für Video Studio freigeben
            </button>
          ) : null}
          {!videoApproved && view && !view.videoUse.eligible
            ? view.videoUse.blockingReasons.map((r) => (
                <span key={r} className="ps-muted">
                  {blockerLabel(r)}
                </span>
              ))
            : null}
        </li>
        <li className={brandCastApproved ? "is-ok" : ""}>
          Brand Cast · {brandCastApproved ? "offizielles Mitglied" : "nicht freigegeben"}
          {!brandCastApproved && view?.brandCast.eligible ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="approve-brand-cast"
              onClick={() => setConfirmGate("brand_cast")}
            >
              In Brand Cast aufnehmen
            </button>
          ) : null}
          {!brandCastApproved && view && !view.brandCast.eligible
            ? view.brandCast.blockingReasons.map((r) => (
                <span key={r} className="ps-muted">
                  {blockerLabel(r)}
                </span>
              ))
            : null}
        </li>
      </ul>

      {statusMessage ? (
        <p className="ps-muted" data-testid="brand-model-approval-saving">
          {statusMessage}
        </p>
      ) : null}

      {confirmGate === "image_use" ? (
        <div className="ps-ref-pkg-confirm" data-testid="image-use-confirm">
          <h4>Dieses Markenmodel für das Image Studio freigeben?</h4>
          <p>
            Diese Identität darf danach für Milaene Kampagnenbilder, Produktbilder und Social Assets im Image Studio verwendet werden.
          </p>
          {actionError ? (
            <div className="ps-inline-error">
              <p>{actionError}</p>
            </div>
          ) : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => {
                setConfirmGate(null);
                setActionError(null);
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="confirm-image-use"
              onClick={() => void confirmApproval()}
            >
              Image-Nutzung freigeben
            </button>
          </div>
        </div>
      ) : null}

      {confirmGate === "video_use" ? (
        <div className="ps-ref-pkg-confirm" data-testid="video-use-confirm">
          <h4>Dieses Markenmodel für das Video Studio freigeben?</h4>
          <p>
            Diese festgeschriebene Identität darf danach für Milaene Video- und Kampagnenabläufe verwendet werden.
          </p>
          <ul className="ps-completeness">
            <li className="is-ok">Markenmodel · {persona.name}</li>
            <li className={view?.identityLocked ? "is-ok" : ""}>
              Identity Lock · Version {view?.lockedIdentity?.lockVersion ?? persona.identity_lock_version}
            </li>
            <li className={view?.eligibility.referenceRightsConfirmed ? "is-ok" : ""}>
              Referenzrechte · {view?.eligibility.referenceRightsConfirmed ? "bestätigt" : "offen"}
            </li>
            <li className={view?.videoIdentityReady ? "is-ok" : ""}>
              Video-Identität · {view?.videoIdentityReady ? "bereit" : "nicht bereit"}
            </li>
          </ul>
          {actionError ? (
            <div className="ps-inline-error">
              <p>{actionError}</p>
            </div>
          ) : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => {
                setConfirmGate(null);
                setActionError(null);
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="confirm-video-use"
              onClick={() => void confirmApproval()}
            >
              Video-Nutzung freigeben
            </button>
          </div>
        </div>
      ) : null}

      {confirmGate === "brand_cast" ? (
        <div className="ps-ref-pkg-confirm" data-testid="brand-cast-confirm">
          <h4>In den offiziellen Brand Cast aufnehmen?</h4>
          <p>
            Dieses Markenmodel wird ein offizielles, dauerhaftes Gesicht von Milaene. Die Freigabe erfolgt bewusst und getrennt von anderen Produktionsfreigaben.
          </p>
          {actionError ? (
            <div className="ps-inline-error">
              <p>{actionError}</p>
            </div>
          ) : null}
          <div className="ps-btn-row">
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => {
                setConfirmGate(null);
                setActionError(null);
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={busy}
              data-testid="confirm-brand-cast"
              onClick={() => void confirmApproval()}
            >
              In Brand Cast aufnehmen
            </button>
          </div>
        </div>
      ) : null}
    </section>
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
    directionPlan?: {
      requested_slot: string;
      provider_direction_strategy: string;
      provider_requested_direction: string;
      direction_generation_unreliable: boolean;
      invertedFallbackEligible: boolean;
      disclosure: {
        targetSlotLabel: string;
        directionStrategyLabel: string;
        reason: string | null;
        providerInstructionNote: string;
        finalAcceptanceNote: string;
      };
    };
  } | null>(null);
  const [regenSlot, setRegenSlot] = useState<string | null>(null);
  const [regenAcceptedAssetId, setRegenAcceptedAssetId] = useState<string | null>(
    null,
  );

  async function loadStatus() {
    const res = await fetch(`/api/persona/${personaId}/reference-package`);
    const data = (await res.json()) as {
      error?: string;
      status?: ReferencePackageStatusView;
    };
    if (!res.ok) throw new Error(data.error ?? "Status des Referenzpakets konnte nicht geladen werden");
    setStatus(data.status ?? null);
  }

  useEffect(() => {
    void loadStatus().catch((err) =>
      onError(err instanceof Error ? err.message : "Status konnte nicht geladen werden"),
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
        directionPlan?: {
          requested_slot: string;
          provider_direction_strategy: string;
          provider_requested_direction: string;
          direction_generation_unreliable: boolean;
          invertedFallbackEligible: boolean;
          disclosure: {
            targetSlotLabel: string;
            directionStrategyLabel: string;
            reason: string | null;
            providerInstructionNote: string;
            finalAcceptanceNote: string;
          };
        };
      };
      if (!res.ok) throw new Error(data.error ?? "Prepare failed");
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: provider must not run on prepare");
      }
      setPendingToken(data.confirmationToken ?? null);
      setPendingEstimate(
        data.estimate
          ? {
              ...data.estimate,
              slots: data.slots,
              directionPlan: data.directionPlan,
            }
          : null,
      );
      setRegenSlot(slot ?? null);
      setRegenAcceptedAssetId(null);
      await loadStatus();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Prepare failed");
    } finally {
      onBusy(false);
    }
  }

  async function prepareAcceptedReplacement(incumbentAssetId: string) {
    onBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare_regenerate_accepted",
          assetId: incumbentAssetId,
        }),
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
        providerCalled?: boolean;
        slot?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Prepare failed");
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: provider must not run on prepare");
      }
      setPendingToken(data.confirmationToken ?? null);
      setPendingEstimate(
        data.estimate
          ? { ...data.estimate, slots: data.slot ? [data.slot] : undefined }
          : null,
      );
      setRegenSlot(data.slot ?? null);
      setRegenAcceptedAssetId(incumbentAssetId);
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
          regenAcceptedAssetId
            ? {
                action: "confirm_regenerate_accepted",
                assetId: regenAcceptedAssetId,
                confirmationToken: pendingToken,
                costConfirmed: true,
              }
            : regenSlot
            ? {
                action: "confirm_regenerate",
                slot: regenSlot,
                confirmationToken: pendingToken,
                costConfirmed: true,
                invertedFallbackConfirmed:
                  pendingEstimate.directionPlan
                    ?.provider_direction_strategy === "inverted_fallback"
                    ? true
                    : undefined,
              }
            : {
                action: "confirm",
                confirmationToken: pendingToken,
                costConfirmed: true,
              },
        ),
      });
      const data = (await res.json()) as {
        error?: string;
        replacementAssetId?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPendingToken(null);
      setPendingEstimate(null);
      setRegenSlot(null);
      setRegenAcceptedAssetId(null);
      await loadStatus();
      onRefresh();
      if (data.replacementAssetId) {
        // Parent refresh will reload references; open happens on next preview click.
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      onBusy(false);
    }
  }

  const slotStatusLabel: Record<string, string> = {
    missing: "Fehlt",
    queued: "In Warteschlange",
    generating: "Wird erstellt",
    identity_check: "Identitätsprüfung",
    review: "In Prüfung",
    accepted: "Akzeptiert",
    identity_warning: "Identitätswarnung",
    identity_mismatch: "Identität weicht ab",
    wrong_camera_direction: "Falsche Kamerarichtung",
    mismatch: "Abweichung",
    failed: "Fehlgeschlagen",
    rejected: "Abgelehnt",
  };

  function slotPrimaryLabel(slot: {
    state?: string;
    status: string;
    coverageLabel?: string | null;
    wrongCameraDirection?: boolean;
  }): string {
    if (slot.coverageLabel) return slot.coverageLabel;
    if (slot.wrongCameraDirection) return "Falsche Kamerarichtung";
    const key = slot.state ?? slot.status;
    return slotStatusLabel[key] ?? key;
  }

  return (
    <section className="ps-section" data-testid="reference-package-panel">
      <h3>REFERENZPAKET</h3>
      <p className="ps-muted">
        Dieselbe Person aus verschiedenen Kamerawinkeln · feste Subjektperspektive · Master-Identität als Quelle
      </p>
      {status?.referencePackageReady ? (
        <PersonaStatusChip label="Referenzpaket vollständig" tone="selected" />
      ) : (
        <span className="ps-muted">
          Abdeckung {status?.acceptedCount ?? 0}/{status?.requiredCount ?? 5}{" "}
          (nur freigegebene Referenzen)
        </span>
      )}

      <ul className="ps-ref-pkg-slots">
        {(status?.slots ?? []).map((slot) => (
          <li key={slot.slot} className="ps-ref-pkg-slot">
            <div className="ps-ref-pkg-slot-main">
              <strong>{slot.label}</strong>
              <span>
                {slotPrimaryLabel(slot)}
              </span>
              {slot.state !== "accepted" &&
                !slot.usable &&
                !slot.directionGenerationUnreliable && (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={() => void prepare(slot.slot)}
                >
                  Diesen Winkel neu erstellen
                </button>
              )}
              {(slot.state === "accepted" || slot.usable) &&
                slot.acceptedAssetId &&
                !slot.pendingReplacementAssetId &&
                !status?.identityLocked && (
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  data-testid="regenerate-accepted-angle"
                  onClick={() =>
                    void prepareAcceptedReplacement(slot.acceptedAssetId!)
                  }
                >
                  Freigegebenen Winkel neu erstellen
                </button>
              )}
            </div>
            {slot.directionGenerationUnreliable ? (
              <p className="ps-ref-pkg-meta ps-inline-error">
                Diese Kamerarichtung konnte nicht zuverlässig erstellt werden. Nutze einen manuellen Upload, lasse den Platz unvollständig oder verwende später einen anderen Referenzablauf.
              </p>
            ) : null}
            {slot.wrongCameraDirection && !slot.directionGenerationUnreliable ? (
              <p className="ps-ref-pkg-meta ps-inline-error">
                Falsche Kamerarichtung · Winkel neu zuordnen (wenn frei) oder ablehnen
              </p>
            ) : null}
            {(slot.identityDecision ||
              slot.humanReview ||
              slot.angleManuallyReassigned) && (
              <p className="ps-ref-pkg-meta ps-muted">
                {slot.identityDecision
                  ? `Identität: ${
                      slot.identityDecision === "identity_warning"
                        ? "Warnung"
                        : slot.identityDecision === "identity_match"
                          ? "Übereinstimmung"
                          : slot.identityDecision === "identity_mismatch"
                            ? "Abweichung"
                            : slot.identityDecision
                    }`
                  : null}
                {slot.humanReview
                  ? `${slot.identityDecision ? " · " : ""}Menschliche Prüfung: ${slot.humanReview}`
                  : null}
                {slot.angleManuallyReassigned
                  ? `${slot.identityDecision || slot.humanReview ? " · " : ""}Winkel: manuell neu zugeordnet`
                  : null}
              </p>
            )}
            {slot.attemptHistory && slot.attemptHistory.length > 0 ? (
              <details className="nx-technical">
              <summary>Technische Versuchshistorie</summary>
              <ul className="ps-ref-pkg-history" aria-label={`${slot.label} Versuchshistorie`}>
                {slot.attemptHistory.map((att, idx) => (
                  <li key={att.id}>
                    Versuch {idx + 1} — Ziel:{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[att.reference_slot] ??
                      att.reference_slot}
                    {att.provider === "derived_local" ||
                    att.derivation_type === "horizontal_mirror"
                      ? " · Derived salvage: Horizontal mirror"
                      : att.provider === "openai"
                        ? " · Generated by OpenAI"
                        : ""}
                    {att.replacement_candidate
                      ? " · Ersatzkandidat"
                      : ""}
                    {att.replacement_for_asset_id
                      ? ` · Ersetzt Asset: ${att.replacement_for_asset_id}`
                      : ""}
                    {att.provider_direction_strategy
                      ? ` · Provider strategy: ${
                          att.provider_direction_strategy ===
                          "inverted_fallback"
                            ? "inverted fallback"
                            : "canonical"
                        }`
                      : ""}
                    {att.provider_requested_direction
                      ? ` · Provider requested: ${
                          REFERENCE_PACKAGE_SLOT_LABELS[
                            att.provider_requested_direction
                          ] ?? att.provider_requested_direction
                        }`
                      : ""}
                    {att.profile_identity_mode
                      ? ` · Profile mode: ${att.profile_identity_mode}`
                      : ""}
                    {att.profile_prompt_version
                      ? ` · Profile prompt: ${att.profile_prompt_version}`
                      : ""}
                    {att.detected_orientation
                      ? att.derivation_type === "horizontal_mirror"
                        ? ` · Actual after mirror: ${att.detected_orientation.replace(/_/g, " ")}`
                        : ` · Actual detected: ${att.detected_orientation.replace(/_/g, " ")}`
                      : ""}
                    {att.angle_direction
                      ? ` · Angle result: ${att.angle_direction}`
                      : ""}
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
                    {att.derivation_type === "horizontal_mirror" ||
                    att.provider === "derived_local"
                      ? " · Cost: €0.00"
                      : att.cost_eur != null
                        ? ` · Cost: €${att.cost_eur.toFixed(2)}`
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
                      ? " · Menschliche Prüfung: approved"
                      : ""}
                  </li>
                ))}
              </ul>
              </details>
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
          Fehlende Referenzwinkel vorbereiten
        </button>
      ) : (
        <div className="ps-ref-pkg-confirm" data-testid="reference-package-confirm">
          {pendingEstimate.directionPlan ? (
            <div
              className="ps-ref-pkg-direction-plan"
              data-testid="reference-package-direction-plan"
            >
              <p>
                Zielplatz:{" "}
                <strong>
                  {pendingEstimate.directionPlan.disclosure.targetSlotLabel}
                </strong>
              </p>
              <p>
                Richtungsstrategie:{" "}
                <strong>
                  {
                    pendingEstimate.directionPlan.disclosure
                      .directionStrategyLabel
                  }
                </strong>
              </p>
              {pendingEstimate.directionPlan.disclosure.reason ? (
                <p>
                  Grund:{" "}
                  <strong>
                    {pendingEstimate.directionPlan.disclosure.reason}
                  </strong>
                </p>
              ) : null}
              <p>
                Provider-Anweisung:{" "}
                <strong>
                  {
                    pendingEstimate.directionPlan.disclosure
                      .providerInstructionNote
                  }
                </strong>
              </p>
              <p>
                Abschließende Freigabe:{" "}
                {
                  pendingEstimate.directionPlan.disclosure
                    .finalAcceptanceNote
                }
              </p>
            </div>
          ) : pendingEstimate.slots?.length === 1 ? (
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
            <strong>{pendingEstimate.imageCount}</strong> Bild{pendingEstimate.imageCount === 1 ? "" : "er"} · Anbieter:{" "}
            <strong>{pendingEstimate.provider}</strong>
          </p>
          <p>
            Geschätzt €{pendingEstimate.estimatedMin.toFixed(2)} – €
            {pendingEstimate.estimatedMax.toFixed(2)}
          </p>
          <p>
            Maximal autorisierte Kosten: €
            {pendingEstimate.maxAuthorizedSpend.toFixed(2)}
          </p>
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {pendingEstimate.imageCount === 1
              ? "Bestätigen & neu generieren"
              : "Bestätigen & generieren"}
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
  if (
    pkg?.identity_decision === "identity_mismatch" &&
    pkg.human_identity_review === "approved_override" &&
    asset.status === "approved"
  ) {
    return "accepted — human identity override";
  }
  if (pkg?.identity_decision === "identity_mismatch") return "mismatch";
  if (asset.status === "approved") return "accepted";
  if (asset.status === "rejected") return "rejected";
  if (asset.status === "review" || asset.status === "uploaded") return "review";
  return asset.status;
}

function ReferencePreviewLightbox({
  asset,
  master,
  allReferences,
  personaId,
  identityLocked,
  busy,
  onClose,
  onApprove,
  onReject,
  onReassigned,
  onMirroredCreated,
  onError,
}: {
  asset: PersonaReferenceAssetView;
  master: PersonaReferenceAssetView | null;
  allReferences: PersonaReferenceAssetView[];
  personaId: string;
  identityLocked: boolean;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReassigned: () => void;
  onMirroredCreated?: (derivedAssetId: string) => void;
  onError: (msg: string | null) => void;
}) {
  const masterMeta = parseMasterIdentityNotes(asset.notes);
  const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
  const isMaster = masterMeta != null;
  const isGenerated = pkgMeta != null;
  const [compare, setCompare] = useState(false);
  const [masterComparedInSession, setMasterComparedInSession] = useState(false);
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [targetSlot, setTargetSlot] = useState<ReferencePackageSlot | "">("");
  const [reassignBusy, setReassignBusy] = useState(false);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [replacementBusy, setReplacementBusy] = useState(false);

  const requestedSlot = pkgMeta?.requested_slot ?? pkgMeta?.slot;
  const effectiveSlot = pkgMeta?.effective_slot ?? pkgMeta?.slot;
  const isReassigned =
    Boolean(pkgMeta?.reassigned_from) ||
    (requestedSlot != null &&
      effectiveSlot != null &&
      requestedSlot !== effectiveSlot);
  const isDerivedMirror = pkgMeta?.derivation_type === "horizontal_mirror";
  const isReplacementCandidate = pkgMeta?.replacement_candidate === true;
  const incumbentAsset = isReplacementCandidate && pkgMeta?.replacement_for_asset_id
    ? allReferences.find((a) => a.id === pkgMeta.replacement_for_asset_id) ?? null
    : null;

  const slotLabel = isMaster
    ? "MASTER-IDENTITÄTSREFERENZ"
    : effectiveSlot
      ? REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot
      : `${asset.asset_type} · ${asset.view_angle}`;

  const canReassign =
    isGenerated && !isMaster && !identityLocked && pkgMeta != null;

  const mismatchBlocksApprove =
    pkgMeta?.identity_decision === "identity_mismatch";

  const angleCorrect = pkgMeta?.angle_direction === "correct";
  const alreadyOverridden =
    pkgMeta?.human_identity_review === "approved_override" &&
    asset.status === "approved";
  const canOfferIdentityOverride =
    isGenerated &&
    !isMaster &&
    !identityLocked &&
    mismatchBlocksApprove &&
    angleCorrect &&
    !alreadyOverridden &&
    pkgMeta?.human_identity_review !== "rejected";

  const mirrorGate =
    isGenerated && requestedSlot
      ? canProposeMirrorSalvage({
          isMaster: false,
          isStageBGenerated: true,
          identityLocked,
          assetStatus: asset.status,
          identityDecision: pkgMeta?.identity_decision,
          angleDirection: pkgMeta?.angle_direction,
          detectedOrientation: pkgMeta?.detected_orientation ?? null,
          slot: requestedSlot,
        })
      : { ok: false as const, reason: "n/a" };
  // Live wrong-direction assets may predate detected_orientation in notes —
  // still offer the action; server re-checks exact opposite from attempt rows.
  const canOfferMirrorSalvage =
    isGenerated &&
    !isMaster &&
    !identityLocked &&
    !isDerivedMirror &&
    pkgMeta?.angle_direction === "incorrect" &&
    (pkgMeta?.identity_decision === "identity_match" ||
      pkgMeta?.identity_decision === "identity_warning") &&
    (mirrorGate.ok || pkgMeta?.detected_orientation == null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function confirmIdentityOverride() {
    if (!canOfferIdentityOverride || !masterComparedInSession) return;
    setOverrideBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_identity_override",
          assetId: asset.id,
          masterCompared: true,
          overrideConfirmed: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        providerCalled?: boolean;
        newImageGenerated?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Menschliche Identitätsfreigabe fehlgeschlagen");
      }
      if (data.providerCalled || data.newImageGenerated) {
        throw new Error(
          "FAIL CLOSED: identity override must not call a provider or generate images",
        );
      }
      setOverrideConfirmOpen(false);
      onReassigned();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Menschliche Identitätsfreigabe fehlgeschlagen");
    } finally {
      setOverrideBusy(false);
    }
  }

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
          data.error ?? "Der Zielplatz besitzt bereits eine freigegebene Referenz.",
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

  async function approveAndReplace() {
    if (!isReplacementCandidate) return;
    setReplacementBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_replacement",
          assetId: asset.id,
          replaceConfirmed: true,
        }),
      });
      const data = (await res.json()) as { error?: string; providerCalled?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Approve and replace failed");
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: approve and replace must not call a provider");
      }
      onReassigned();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Approve and replace failed");
    } finally {
      setReplacementBusy(false);
    }
  }

  async function rejectReplacement() {
    if (!isReplacementCandidate) return;
    setReplacementBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_replacement",
          assetId: asset.id,
        }),
      });
      const data = (await res.json()) as { error?: string; providerCalled?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Der Ersatz konnte nicht abgelehnt werden");
      if (data.providerCalled) {
        throw new Error("FAIL CLOSED: reject replacement must not call a provider");
      }
      onReassigned();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Der Ersatz konnte nicht abgelehnt werden");
    } finally {
      setReplacementBusy(false);
    }
  }

  async function keepCurrentReplacement() {
    await rejectReplacement();
  }

  async function createMirroredVersion() {
    if (!canOfferMirrorSalvage) return;
    setMirrorBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/persona/${personaId}/reference-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_mirrored_version",
          assetId: asset.id,
          confirmed: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        providerCalled?: boolean;
        openaiCalled?: boolean;
        fluxCalled?: boolean;
        assetId?: string;
        providerCost?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Create mirrored version failed");
      }
      if (data.providerCalled || data.openaiCalled || data.fluxCalled) {
        throw new Error(
          "FAIL CLOSED: mirrored version must not call OpenAI or FLUX",
        );
      }
      if (data.providerCost !== 0) {
        throw new Error("FAIL CLOSED: mirrored version must cost €0.00");
      }
      if (!data.assetId) {
        throw new Error("Mirrored asset id fehlt from response");
      }
      onMirroredCreated?.(data.assetId);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Create mirrored version failed",
      );
    } finally {
      setMirrorBusy(false);
    }
  }

  const showCompare =
    compare && isGenerated && master?.signed_url && asset.signed_url;

  return (
    <div
      className="ps-ref-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Große Referenzvorschau"
      data-testid="reference-preview-lightbox"
    >
      <button
        type="button"
        className="ps-ref-lightbox-backdrop"
        aria-label="Vorschau schließen"
        onClick={onClose}
      />
      <div className="ps-ref-lightbox-panel">
        <header className="ps-ref-lightbox-header">
          <div>
            <strong>{slotLabel}</strong>
            {isReassigned ? (
              <span className="ps-ref-reassigned-badge" data-testid="reassigned-badge">
                NEU ZUGEORDNET
              </span>
            ) : null}
            {alreadyOverridden ? (
              <span
                className="ps-ref-override-badge"
                data-testid="human-identity-override-badge"
              >
                MENSCHLICHE IDENTITÄTSFREIGABE
              </span>
            ) : null}
            {isDerivedMirror ? (
              <span
                className="ps-ref-derived-badge"
                data-testid="derived-mirror-badge"
              >
                ABGELEITETE SPIEGELUNG
              </span>
            ) : null}
            {isReplacementCandidate ? (
              <span
                className="ps-ref-replacement-badge"
                data-testid="replacement-candidate-badge"
              >
                ERSATZKANDIDAT
              </span>
            ) : null}
            <p className="ps-muted" style={{ margin: "0.25rem 0 0" }}>
              {isMaster
                ? "Master"
                : isReplacementCandidate
                  ? "Ersatzkandidat"
                  : isDerivedMirror
                    ? "Abgeleitete Spiegelung"
                    : isGenerated
                      ? "Erstellte Referenz"
                      : "Referenz"}{" "}
              · Status: {referencePreviewStatusLabel(asset)}
              {pkgMeta?.identity_decision
                ? ` · maschinelle Identitätsprüfung: ${
                    pkgMeta.identity_decision === "identity_mismatch"
                      ? "Abweichung"
                      : pkgMeta.identity_decision === "identity_match"
                        ? "Übereinstimmung"
                        : pkgMeta.identity_decision === "identity_warning"
                          ? "Warnung"
                          : pkgMeta.identity_decision
                  }`
                : ""}
              {pkgMeta?.angle_direction
                ? ` · Kamera: ${pkgMeta.angle_direction}`
                : ""}
              {isDerivedMirror ? " · Kosten: €0,00" : ""}
            </p>
            {isGenerated && requestedSlot && effectiveSlot ? (
              <dl className="ps-ref-angle-meta">
                <div>
                  <dt>Angeforderter Winkel</dt>
                  <dd>
                    {REFERENCE_PACKAGE_SLOT_LABELS[requestedSlot] ?? requestedSlot}
                  </dd>
                </div>
                <div>
                  <dt>Wirksamer Winkel</dt>
                  <dd>
                    {REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot}
                  </dd>
                </div>
              </dl>
            ) : null}
            {isGenerated && requestedSlot ? (
              <ul className="ps-ref-angle-history" aria-label="Winkelverlauf">
                <li>
                  Erstellt für{" "}
                  {REFERENCE_PACKAGE_SLOT_LABELS[requestedSlot] ?? requestedSlot}
                </li>
                {pkgMeta?.identity_decision ? (
                  <li>
                    Maschinelle Identitätsprüfung:{" "}
                    {pkgMeta.identity_decision === "identity_warning"
                      ? "Warnung"
                      : pkgMeta.identity_decision === "identity_match"
                        ? "Übereinstimmung"
                        : pkgMeta.identity_decision === "identity_mismatch"
                          ? "Abweichung"
                          : pkgMeta.identity_decision}
                  </li>
                ) : null}
                {pkgMeta?.angle_direction ? (
                  <li>Kamerarichtung: {pkgMeta.angle_direction}</li>
                ) : null}
                {pkgMeta?.human_identity_review === "approved_override" ? (
                  <li data-testid="human-override-review-line">
                    Menschliche Prüfung: ausdrücklich freigegeben
                  </li>
                ) : null}
                {pkgMeta?.identity_source_confidence ? (
                  <li>
                    Konfidenz der Identitätsquelle:{" "}
                    {pkgMeta.identity_source_confidence.replace(/_/g, " ")}
                  </li>
                ) : null}
                {pkgMeta?.angle_direction === "incorrect" ? (
                  <li className="ps-inline-error">
                    Falsche Kamerarichtung – gespiegelte Version erstellen, Winkel neu zuordnen oder ablehnen
                  </li>
                ) : null}
                {isDerivedMirror ? (
                  <li data-testid="derived-mirror-source-line">
                    Quelle: ursprünglich erstellte{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[
                      pkgMeta?.original_requested_slot ??
                        pkgMeta?.requested_slot ??
                        requestedSlot!
                    ] ?? "reference"}
                    {pkgMeta?.derived_from_asset_id
                      ? ` (${pkgMeta.derived_from_asset_id.slice(0, 8)}…)`
                      : ""}
                  </li>
                ) : null}
                {isReplacementCandidate && incumbentAsset ? (
                  <li data-testid="replacement-incumbent-line">
                    Aktuell freigegebene Referenz:{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[
                      parseReferencePackageAssetNotes(incumbentAsset.notes)
                        ?.slot ?? "front"
                    ] ?? "reference"}{" "}
                    ({incumbentAsset.id.slice(0, 8)}…)
                  </li>
                ) : null}
                {isReplacementCandidate ? (
                  <li>Neuer Kandidat: {slotLabel}</li>
                ) : null}
                {isReassigned && effectiveSlot ? (
                  <li>
                    Neu zugeordnet →{" "}
                    {REFERENCE_PACKAGE_SLOT_LABELS[effectiveSlot] ?? effectiveSlot}
                  </li>
                ) : null}
                {asset.status === "approved" ? (
                  <li>Menschliche Prüfung: freigegeben</li>
                ) : asset.status === "rejected" ? (
                  <li>Menschliche Prüfung: abgelehnt</li>
                ) : null}
              </ul>
            ) : null}
          </div>
          <div className="ps-ref-lightbox-actions">
            {isGenerated && master?.signed_url ? (
              <button
                type="button"
                className="ps-btn"
                onClick={() => {
                  setCompare((v) => {
                    const next = !v;
                    if (next) setMasterComparedInSession(true);
                    return next;
                  });
                }}
              >
                {compare ? "Master-Vergleich ausblenden" : "Mit Master vergleichen"}
              </button>
            ) : null}
            {canOfferMirrorSalvage ? (
              <button
                type="button"
                className="ps-btn ps-btn-primary"
                disabled={busy || mirrorBusy}
                data-testid="create-mirrored-version"
                onClick={() => void createMirroredVersion()}
              >
                {mirrorBusy ? "Spiegelung wird erstellt…" : "Gespiegelte Version erstellen"}
              </button>
            ) : null}
            {isReplacementCandidate ? (
              <>
                <button
                  type="button"
                  className="ps-btn ps-btn-primary"
                  disabled={
                    busy ||
                    replacementBusy ||
                    mismatchBlocksApprove ||
                    pkgMeta?.angle_direction === "incorrect"
                  }
                  data-testid="approve-and-replace"
                  onClick={() => void approveAndReplace()}
                >
                  Freigeben und ersetzen
                </button>
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy || replacementBusy}
                  data-testid="keep-current-replacement"
                  onClick={() => void keepCurrentReplacement()}
                >
                  Aktuelle Referenz behalten
                </button>
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy || replacementBusy}
                  data-testid="reject-replacement"
                  onClick={() => void rejectReplacement()}
                >
                  Ersatz ablehnen
                </button>
              </>
            ) : !isMaster ? (
              <>
                {canOfferIdentityOverride ? (
                  <button
                    type="button"
                    className="ps-btn ps-btn-primary"
                    disabled={busy || overrideBusy || !masterComparedInSession}
                    data-testid="approve-identity-override"
                    title={
                      masterComparedInSession
                        ? undefined
                        : "Zuerst mit dem Master vergleichen"
                    }
                    onClick={() => setOverrideConfirmOpen(true)}
                  >
                    Mit Identitätsfreigabe bestätigen
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ps-btn ps-btn-primary"
                    disabled={
                      busy ||
                      mismatchBlocksApprove ||
                      pkgMeta?.angle_direction === "incorrect"
                    }
                    onClick={onApprove}
                    title={
                      mismatchBlocksApprove
                        ? "Eine abweichende Identität kann ohne menschliche Freigabe nicht akzeptiert werden"
                        : pkgMeta?.angle_direction === "incorrect"
                          ? "Die falsche Kamerarichtung kann nicht freigegeben werden – erst eine gespiegelte Version erstellen"
                          : undefined
                    }
                  >
                    Freigeben
                  </button>
                )}
                <button
                  type="button"
                  className="ps-btn"
                  disabled={busy}
                  onClick={onReject}
                >
                  Ablehnen
                </button>
                {canReassign ? (
                  <button
                    type="button"
                    className="ps-btn"
                    disabled={busy || reassignBusy}
                    onClick={() => setReassignOpen((v) => !v)}
                  >
                    Winkel neu zuordnen
                  </button>
                ) : null}
              </>
            ) : (
              <span className="ps-muted" style={{ fontSize: "0.8rem" }}>
                Unveränderlicher Master – kann weder als Ersatz freigegeben noch gelöscht werden
              </span>
            )}
            <button type="button" className="ps-btn" onClick={onClose}>
              Schließen
            </button>
          </div>
        </header>

        {overrideConfirmOpen && canOfferIdentityOverride ? (
          <div
            className="ps-ref-override-confirm"
            data-testid="identity-override-confirm"
          >
            <p>
              Maschinelle Identitätsprüfung: <strong>ABWEICHUNG</strong>
            </p>
            <p>
              Kamerarichtung: <strong>KORREKT</strong>
            </p>
            <p className="ps-inline-error">
              Warnung: Die automatische Identitätsprüfung vermutet eine andere Person. Fahre nur fort, wenn du das Bild manuell mit der Master-Identitätsreferenz verglichen und bewusst als dieselbe Markenidentität bestätigt hast.
            </p>
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              disabled={overrideBusy || !masterComparedInSession}
              onClick={() => void confirmIdentityOverride()}
            >
              Menschliche Identitätsfreigabe bestätigen
            </button>
            <button
              type="button"
              className="ps-btn"
              disabled={overrideBusy}
              onClick={() => setOverrideConfirmOpen(false)}
            >
              Abbrechen
            </button>
          </div>
        ) : null}

        {reassignOpen && canReassign ? (
          <div className="ps-ref-reassign" data-testid="reassign-angle-panel">
            <p className="ps-muted">
              Ordne diese bezahlte Generierung dem korrekten Platz der Subjektperspektive zu. Es wird kein neues Bild erstellt.
            </p>
            <label>
              Zielplatz
              <select
                value={targetSlot}
                onChange={(e) =>
                  setTargetSlot(e.target.value as ReferencePackageSlot | "")
                }
                aria-label="Zielplatz für den Winkel"
              >
                <option value="">Platz auswählen…</option>
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
              Neuzuordnung bestätigen
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
                alt="MASTER-IDENTITÄTSREFERENZ"
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
          <p className="ps-muted">Für diese Referenz ist kein privater Zugriff verfügbar.</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PersonaStatus }) {
  return (
    <PersonaStatusChip label={ownerStatusLabel(status)} tone={personaStatusTone(status)} />
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
