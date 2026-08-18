"use client";

import { useMemo, useRef, useState } from "react";
import {
  getIdentityDnaForArchetype,
  getProductAffinityForArchetype,
  loadBrandArchetypeCatalog,
  type BrandArchetype,
} from "@/lib/brand-archetypes";
import {
  buildArchetypeCastingCardModel,
  buildDiscoveryBrief,
  createBrandFaceSelectionProject,
  DiscoveryStartLock,
  listSelectionProjectsForArchetype,
  prepareDiscoveryReady,
  beginDiscoveryGenerating,
  saveSelectionProject,
  creationProjectInputFromArchetype,
  resolveDiscoverySessionProjectId,
  summarizeIdentityDna,
  type BrandFaceDiscoveryBrief,
} from "@/lib/brand-face-selection";
import { logCastingFlowTrace } from "@/lib/persona/creation/casting-data-integrity";
import {
  logDiscoveryCheckpoint,
} from "@/lib/persona/creation/discovery-lifecycle";
import { DEBUG_MODE } from "@/components/persona/persona-studio-project-sync";
import { loadProductCatalog } from "@/lib/product-intelligence";
import type { PersonaStudioController } from "@/components/persona/use-persona-studio";
import { OfficialBrandFaceMilestonePanel } from "@/components/persona/official-brand-face-milestone-panel";
import { canStartPaidCandidateGeneration } from "@/components/persona/persona-creator-ux";

type CastingPhase = "home" | "confirm_a1";

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

function ArchetypeCastCard({
  archetype,
  studio,
  creatingArchetypeId,
  providerGateFailed,
  providerGateMessage,
  onStartDiscovery,
  onViewPreviousRuns,
}: {
  archetype: BrandArchetype;
  studio: PersonaStudioController;
  creatingArchetypeId: string | null;
  providerGateFailed: boolean;
  providerGateMessage: string | null;
  onStartDiscovery: (archetype: BrandArchetype) => void;
  onViewPreviousRuns: () => void;
}) {
  const catalog = useMemo(() => loadProductCatalog(), []);
  const archetypeCatalog = useMemo(() => loadBrandArchetypeCatalog(), []);
  const dna = useMemo(
    () => getIdentityDnaForArchetype(archetypeCatalog, archetype),
    [archetype, archetypeCatalog],
  );
  const dnaSummary = useMemo(() => summarizeIdentityDna(dna), [dna]);
  const affinity = useMemo(
    () => getProductAffinityForArchetype(archetype, catalog).slice(0, 3),
    [archetype, catalog],
  );

  const isCreating = creatingArchetypeId === archetype.id;
  const cardModel = useMemo(
    () =>
      buildArchetypeCastingCardModel({
        workspaceId: archetype.workspaceId,
        archetypeId: archetype.id,
        archetypeActive: archetype.status === "active",
        creationProjects: studio.creationProjects.map((p) => ({
          id: p.id,
          description: p.description,
          status: p.status,
          created_at: p.created_at,
        })),
        isCreating,
        providerGateFailed,
        providerGateMessage,
        selectionProjects: listSelectionProjectsForArchetype(
          archetype.workspaceId,
          archetype.id,
        ),
      }),
    [
      archetype,
      studio.creationProjects,
      isCreating,
      providerGateFailed,
      providerGateMessage,
    ],
  );

  const startDisabled = Boolean(cardModel.startDiscoveryDisabledReason);

  return (
    <article
      className={`ps-obf-cast-card is-${cardModel.officialStatus.tone}`}
    >
      <header className="ps-obf-cast-card-head">
        <div>
          <strong>{archetype.name}</strong>
          <em>{archetype.commercialRole}</em>
        </div>
        <span
          className={`ps-obf-cast-status is-${cardModel.officialStatus.tone}`}
        >
          {cardModel.officialStatus.label}
        </span>
      </header>

      <p className="ps-muted">{archetype.purpose.join(" · ")}</p>

      <dl className="ps-obf-cast-facts">
        <div>
          <dt>Rolle</dt>
          <dd>{archetype.campaignRole}</dd>
        </div>
        <div>
          <dt>Beste Plattformen</dt>
          <dd>{archetype.bestPlatforms.join(", ")}</dd>
        </div>
        <div>
          <dt>Identitäts-DNA</dt>
          <dd>
            {dnaSummary.skinToneFamily.split(",")[0]} ·{" "}
            {dnaSummary.hairFamily.split(",")[0]}
          </dd>
        </div>
        <div>
          <dt>A1-Entdeckung</dt>
          <dd>4 Kandidaten × 1 Portrait</dd>
        </div>
      </dl>

      <ul className="ps-obf-cast-products">
        {affinity.map((a) => (
          <li key={`${a.productType}-${a.rating}`}>
            <span aria-hidden>{stars(a.rating)}</span> {a.productType}
          </li>
        ))}
      </ul>

      <p className="ps-obf-cast-lock">
        Gesicht, Körper, Haare und Stil kommen aus Markengedächtnis, Archetyp-, Produkt- und Referenzintelligenz — nicht aus einem manuellen Assistenten.
      </p>

      <div className="ps-obf-cast-actions">
        {cardModel.primaryAction === "view_brand_cast" ? (
          <button
            type="button"
            className="ps-btn-secondary ps-obf-start-discovery-btn"
            onClick={() => studio.setSection("brand_cast")}
          >
            Brand Cast öffnen
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ps-obf-start-discovery-btn"
              disabled={startDisabled}
              aria-busy={isCreating}
              onClick={() => onStartDiscovery(archetype)}
            >
              <span>
                {isCreating ? "Entdeckung wird vorbereitet…" : "Neue Entdeckung starten"}
              </span>
              {!isCreating ? (
                <span className="ps-obf-start-discovery-arrow" aria-hidden>
                  →
                </span>
              ) : null}
            </button>
            {cardModel.startDiscoveryDisabledReason ? (
              <p className="ps-obf-start-disabled-reason">
                {cardModel.startDiscoveryDisabledReason}
              </p>
            ) : null}
          </>
        )}

        {cardModel.previousRunCount > 0 ? (
          <p className="ps-obf-previous-runs">
            Frühere Entdeckungen: {cardModel.previousRunCount} —{" "}
            <button
              type="button"
              className="ps-link-btn"
              onClick={onViewPreviousRuns}
            >
              in Entdeckungsprojekten ansehen
            </button>
          </p>
        ) : null}

        {cardModel.unfinishedRunCount > 0 ? (
          <p className="ps-obf-unfinished-runs">
            {cardModel.unfinishedRunCount} unvollständige
            {cardModel.unfinishedRunCount === 1 ? " Entdeckung" : " Entdeckungen"} in den Entdeckungsprojekten
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Official Brand Face Casting — default Persona Creator workflow for Milaene.
 * Replaces the manual Brand Role → Body → Face → Presence wizard.
 */
export function OfficialBrandFaceCastingView({
  studio,
  onOpenDebugWizard,
}: {
  studio: PersonaStudioController;
  onOpenDebugWizard?: () => void;
}) {
  const catalog = useMemo(() => loadBrandArchetypeCatalog(), []);
  const archetypes = catalog.archetypes.filter((a) => a.status === "active");

  const discoveryStartLock = useRef(new DiscoveryStartLock());

  const [phase, setPhase] = useState<CastingPhase>("home");
  const [creatingArchetypeId, setCreatingArchetypeId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmCost, setConfirmCost] = useState(false);
  const [activeArchetypeId, setActiveArchetypeId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [brief, setBrief] = useState<BrandFaceDiscoveryBrief | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const paidGenerationEnabled =
    studio.health?.paidGenerationSafety.paidGenerationEnabled === true;
  const openaiConfigured =
    studio.health?.paidGenerationSafety.openaiApiKeyConfigured === true;
  const providerGateFailed = !paidGenerationEnabled || !openaiConfigured;
  const providerGateMessage =
    !paidGenerationEnabled && !openaiConfigured
      ? "Bezahlte Generierung und OpenAI sind in dieser Umgebung nicht konfiguriert."
      : !paidGenerationEnabled
        ? "Bezahlte Generierung ist in dieser Umgebung nicht aktiviert."
        : !openaiConfigured
          ? "Der OpenAI-API-Schlüssel ist nicht konfiguriert."
          : null;

  const busy = creatingArchetypeId !== null;

  const canGenerate = useMemo(() => {
    if (!activeProjectId) return false;
    if (studio.activeConfirmationStatus !== "ready") return false;
    return canStartPaidCandidateGeneration({
      busy,
      costConfirmed: confirmCost,
      providerMode: "image_provider",
      costEstimate: studio.costEstimate,
      confirmationToken: studio.paidConfirmationToken,
      confirmationProjectId: studio.paidConfirmationProjectId,
      projectId: activeProjectId,
    });
  }, [
    activeProjectId,
    busy,
    confirmCost,
    studio.costEstimate,
    studio.paidConfirmationProjectId,
    studio.paidConfirmationToken,
    studio.activeConfirmationStatus,
  ]);

  const startDiscovery = async (archetype: BrandArchetype) => {
    if (!discoveryStartLock.current.tryAcquire(archetype.id)) {
      return;
    }
    setCreatingArchetypeId(archetype.id);
    setError(null);
    setConfirmCost(false);
    try {
      logDiscoveryCheckpoint("new_discovery_clicked", {
        archetypeId: archetype.id,
        workspaceId: archetype.workspaceId,
      });
      const dna = getIdentityDnaForArchetype(catalog, archetype);
      let selection = createBrandFaceSelectionProject({
        workspaceId: archetype.workspaceId,
        archetypeId: archetype.id,
      });
      selection = prepareDiscoveryReady(selection);
      saveSelectionProject(selection);

      const body = creationProjectInputFromArchetype({
        archetype,
        dna,
        workspaceId: archetype.workspaceId,
        providerMode: "image_provider",
        qualityMode: "premium_editorial",
      });

      const project = await studio.createProject(
        { ...body, status: "draft" },
        { navigate: false },
      );
      if (!project) throw new Error("Das Entdeckungsprojekt konnte nicht angelegt werden.");

      const sessionProjectId = resolveDiscoverySessionProjectId(project.id);
      logDiscoveryCheckpoint("project_created", {
        creationProjectId: sessionProjectId,
        archetypeId: archetype.id,
      });

      if (DEBUG_MODE) {
        logCastingFlowTrace("discovery.project_created", {
          selectionProjectId: selection.id,
          creationProjectId: sessionProjectId,
          archetypeId: archetype.id,
          workspaceId: archetype.workspaceId,
          source: "live_openai",
        });
      }

      selection = {
        ...selection,
        creationProjectId: sessionProjectId,
      };
      saveSelectionProject(selection);

      const prepared = await studio.preparePaidConfirmation(sessionProjectId);
      const estimate = prepared.estimate;
      const discoveryBrief = buildDiscoveryBrief(
        selection,
        estimate
          ? {
              min: estimate.estimatedMin,
              max: estimate.estimatedMax,
            }
          : null,
      );

      setActiveArchetypeId(archetype.id);
      setActiveProjectId(sessionProjectId);
      setSelectionId(selection.id);
      setBrief(discoveryBrief);
      setPhase("confirm_a1");
      studio.bindDiscoveryProject(sessionProjectId);
      // Keep confirmation panel visible — do not jump to Candidate Board.
      studio.setSection("creator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Entdeckung konnte nicht gestartet werden.");
    } finally {
      discoveryStartLock.current.release();
      setCreatingArchetypeId(null);
    }
  };

  const confirmAndGenerate = async () => {
    if (!activeProjectId || !selectionId) return;
    if (!confirmCost) {
      setError("Bitte Kosten explizit bestätigen.");
      return;
    }
    const token = studio.paidConfirmationToken;
    if (!token || studio.paidConfirmationProjectId !== activeProjectId) {
      setError("Bitte zuerst Kostenschätzung vorbereiten.");
      return;
    }

    setCreatingArchetypeId(activeArchetypeId);
    setError(null);
    try {
      const existing = listSelectionProjectsForArchetype(
        catalog.workspaceId,
        activeArchetypeId ?? "",
      ).find((p) => p.id === selectionId);
      if (existing) {
        const next = beginDiscoveryGenerating(existing, token);
        saveSelectionProject(next);
      }

      const result = await studio.generateCandidates(activeProjectId, {
        costConfirmed: true,
        confirmationToken: token,
        userConfirmedAt: new Date().toISOString(),
      });

      if (DEBUG_MODE) {
        logCastingFlowTrace("discovery.generation_confirmed", {
          selectionProjectId: selectionId,
          creationProjectId: activeProjectId,
          archetypeId: activeArchetypeId,
          workspaceId: catalog.workspaceId,
          source: "live_openai",
        });
      }

      const projectFailed =
        result.project?.status === "failed" ||
        result.durableJobStatus === "failed";

      if (projectFailed) {
        setError(
          "Die Entdeckung ist fehlgeschlagen. Öffne die Entdeckungsprojekte, prüfe die Kosten erneut und versuche es im selben Projekt noch einmal.",
        );
        studio.setSection("creation_projects");
        await studio.loadProject(activeProjectId);
        return;
      }

      if (result.generationRunId || (result.candidates?.length ?? 0) > 0) {
        await studio.openCandidatesForProject(activeProjectId);
      } else {
        studio.setSection("creation_projects");
        await studio.loadProject(activeProjectId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setCreatingArchetypeId(null);
    }
  };

  if (phase === "confirm_a1" && brief) {
    return (
      <section className="ps-panel ps-creator ps-obf-casting">
        <header className="ps-panel-header">
          <div>
            <p className="ps-eyebrow">A1 Discovery</p>
            <h1>{brief.archetypeName}</h1>
            <p className="ps-muted">
              Confirm paid discovery casting — 4 portraits, one per candidate. A2 does not
              start automatically.
            </p>
          </div>
          <button
            type="button"
            className="ps-btn-secondary"
            disabled={busy}
            onClick={() => {
              setPhase("home");
              setBrief(null);
              setConfirmCost(false);
              setActiveProjectId(null);
              setSelectionId(null);
            }}
          >
            Zurück
          </button>
        </header>

        {error ? <div className="ps-callout ps-callout-warn">{error}</div> : null}
        {studio.providerSetupMessage ? (
          <div className="ps-callout ps-callout-warn">{studio.providerSetupMessage}</div>
        ) : null}
        {providerGateFailed ? (
          <div className="ps-callout ps-callout-warn">
            Bezahlte Generierung ist in dieser Umgebung nicht aktiviert. Die Entdeckung bleibt an den bestehenden Bestätigungsfluss gebunden — keine stillen Anbieter-Aufrufe.
          </div>
        ) : null}

        <div className="ps-obf-a1-brief">
          <dl>
            <div>
              <dt>Archetyp</dt>
              <dd>{brief.archetypeName}</dd>
            </div>
            <div>
              <dt>Rolle</dt>
              <dd>{brief.commercialRole}</dd>
            </div>
            <div>
              <dt>Kandidaten</dt>
              <dd>
                {brief.candidateCount} × {brief.portraitsPerCandidate} Portrait
              </dd>
            </div>
            <div>
              <dt>Bilder gesamt</dt>
              <dd>{brief.totalImages}</dd>
            </div>
            <div>
              <dt>Beste Plattformen</dt>
              <dd>{brief.bestPlatforms.join(", ")}</dd>
            </div>
            <div>
              <dt>Identitäts-DNA</dt>
              <dd>{brief.identityDnaSummary.presence}</dd>
            </div>
            <div>
              <dt>Anbieter</dt>
              <dd>OpenAI</dd>
            </div>
            <div>
              <dt>Erwartete Kosten</dt>
              <dd>
                {brief.expectedCostEur
                  ? `€${brief.expectedCostEur.min.toFixed(2)} – €${brief.expectedCostEur.max.toFixed(2)}`
                  : studio.costEstimate
                    ? `€${studio.costEstimate.estimatedMin.toFixed(2)} – €${studio.costEstimate.estimatedMax.toFixed(2)}`
                    : "Bereite die Bestätigung vor, um die Kostenschätzung zu laden"}
              </dd>
            </div>
          </dl>

          <ul className="ps-obf-cast-products">
            {brief.productAffinities.slice(0, 4).map((a) => (
              <li key={`${a.productType}-${a.rating}`}>
                <span aria-hidden>{stars(a.rating)}</span> {a.productType}
              </li>
            ))}
          </ul>

          {studio.costEstimate &&
          studio.paidConfirmationToken &&
          studio.activeConfirmationStatus === "ready" ? (
            <label className="ps-obf-cost-confirm">
              <input
                type="checkbox"
                checked={confirmCost}
                onChange={(e) => setConfirmCost(e.target.checked)}
              />
              <span>
                4 Entdeckungsgesichter mit OpenAI erstellen. Von der biologischen Gesichtsprüfung abgelehnte Kandidaten werden automatisch ersetzt (bis zu 3 Versuche pro Platz). Ich bestätige das maximale Anbieter-Kostenlimit und starte die A1-Entdeckung für {brief.archetypeName}.
              </span>
            </label>
          ) : (
            <>
              {studio.costEstimate ? (
                <p className="ps-muted">
                  Kostenschätzung vorhanden — neue Bestätigung erforderlich.
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy || !activeProjectId}
                onClick={() =>
                  activeProjectId
                    ? void studio.preparePaidConfirmation(activeProjectId)
                    : undefined
                }
              >
                Bestätigung vorbereiten
              </button>
            </>
          )}

          <div className="ps-obf-cast-actions">
            <button
              type="button"
              disabled={busy || !canGenerate}
              onClick={() => void confirmAndGenerate()}
            >
              {busy ? "Wird gestartet…" : "Entdeckungsportraits erstellen"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ps-panel ps-creator ps-obf-casting">
      <header className="ps-panel-header">
        <div>
          <p className="ps-eyebrow">Offizielle Markengesichter</p>
          <h1>Markenmodel-Casting</h1>
          <p className="ps-muted">
            Wähle und bestätige die drei dauerhaften Milaene-Markengesichter. Erscheinung und Stil
            kommen aus den Intelligenzschichten — nicht aus einem manuellen Assistenten.
          </p>
        </div>
      </header>

      {error ? <div className="ps-callout ps-callout-warn">{error}</div> : null}

      <OfficialBrandFaceMilestonePanel
        progress={studio.brandCastProgress}
      />

      <div className="ps-obf-cast-grid">
        {archetypes.map((archetype) => (
          <ArchetypeCastCard
            key={archetype.id}
            archetype={archetype}
            studio={studio}
            creatingArchetypeId={creatingArchetypeId}
            providerGateFailed={providerGateFailed}
            providerGateMessage={providerGateMessage}
            onStartDiscovery={(a) => void startDiscovery(a)}
            onViewPreviousRuns={() => studio.setSection("creation_projects")}
          />
        ))}
      </div>

      {onOpenDebugWizard ? (
        <p className="ps-obf-debug-link">
          <button type="button" className="ps-link-btn" onClick={onOpenDebugWizard}>
            Open legacy custom / debug wizard
          </button>
          <span className="ps-muted">
            {" "}
            — not used for official Milaene Brand Faces
          </span>
        </p>
      ) : null}
    </section>
  );
}
