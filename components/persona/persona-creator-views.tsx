"use client";

import { useMemo, useState } from "react";
import type { PersonaStudioController } from "@/components/persona/use-persona-studio";
import type {
  BrandRole,
  IntendedUsage,
  ProviderMode,
} from "@/lib/persona/domain/creation-types";
import { Loader2 } from "lucide-react";

const BRAND_ROLE_LABELS: Record<BrandRole, string> = {
  primary_male: "Primary Male",
  secondary_male: "Secondary Male",
  primary_female: "Primary Female",
  secondary_female: "Secondary Female",
  unisex_editorial: "Unisex Editorial",
  campaign_specialist: "Campaign Specialist",
};

const STEPS = [
  "Brand-Rolle",
  "Körperliche Richtung",
  "Gesicht & Haar",
  "Persönlichkeit",
  "Fashion Style",
  "Looks & Outfits",
  "Ausschlüsse",
  "Nutzung",
  "Kandidatenanzahl",
  "Kosten & Bestätigung",
] as const;

export function BrandCastView({ studio }: { studio: PersonaStudioController }) {
  const p = studio.brandCastProgress;
  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>Brand Cast</h1>
          <p className="ps-muted">
            Meilenstein für genehmigte Milaene-Personas. Image/Video Studio bleiben
            deaktiviert, bis der Cast freigegeben ist.
          </p>
        </div>
      </header>

      {!p ? (
        <p className="ps-muted">Brand-Cast-Fortschritt wird geladen…</p>
      ) : (
        <div className="ps-brand-cast">
          <div className={`ps-milestone${p.milestone_reached ? " is-done" : ""}`}>
            <span className="ps-milestone-label">{p.milestone_label}</span>
            <strong>{p.milestone_reached ? "Erreicht" : "Offen"}</strong>
          </div>
          <div className="ps-stat-grid">
            <div className="ps-stat">
              <em>Männliche Personas</em>
              <strong>
                {p.male_approved}/{p.male_required}
              </strong>
            </div>
            <div className="ps-stat">
              <em>Weibliche Personas</em>
              <strong>
                {p.female_approved}/{p.female_required}
              </strong>
            </div>
            <div className="ps-stat">
              <em>Image-ready</em>
              <strong>{p.image_ready_count}</strong>
            </div>
            <div className="ps-stat">
              <em>Video-ready</em>
              <strong>{p.video_ready_count}</strong>
            </div>
          </div>
          {p.missing_reference_requirements.length > 0 ? (
            <div className="ps-callout">
              <p>Fehlende Referenzanforderungen</p>
              <ul>
                {p.missing_reference_requirements.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function PersonaCreatorView({
  studio,
}: {
  studio: PersonaStudioController;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    brand_role: "primary_male" as BrandRole,
    gender_presentation: "Male",
    age_range: "28-35",
    height_range: "180-188 cm",
    body_type: "Athletic lean",
    skin_tone_direction: "Light to medium olive",
    face_shape_direction: "Defined jaw, calm features",
    hair_direction: "Dark brown, short neat",
    facial_hair_direction: "Clean shaven or light stubble",
    eye_direction: "Brown or hazel",
    expression_direction: "Quiet confidence, neutral calm",
    personality: "Reserved warmth",
    fashion_style: "Quiet luxury streetwear",
    preferred_brand_looks: "Quiet Luxury",
    preferred_outfits: "Black wide pants, premium basics",
    excluded_features: "extreme makeup, flashy jewelry",
    visual_keywords: "editorial, restrained, premium casual",
    intended_usage: "image_and_video" as IntendedUsage,
    candidate_count: 4,
    provider_mode: "manual_upload" as ProviderMode,
    additional_description: "",
    description: "",
  });

  const applyPreset = (presetId: string) => {
    const preset = studio.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      name: preset.label,
      brand_role: preset.brand_role,
      gender_presentation: preset.gender_presentation,
      age_range: preset.age_range,
      height_range: preset.height_range,
      body_type: preset.body_type,
      skin_tone_direction: preset.skin_tone_direction,
      face_shape_direction: preset.face_shape_direction,
      hair_direction: preset.hair_direction,
      facial_hair_direction: preset.facial_hair_direction,
      eye_direction: preset.eye_direction,
      expression_direction: preset.expression_direction,
      personality: preset.personality,
      fashion_style: preset.fashion_style,
      preferred_brand_looks: preset.preferred_brand_looks,
      preferred_outfits: preset.preferred_outfits,
      excluded_features: preset.excluded_features,
      visual_keywords: preset.visual_keywords,
      intended_usage: preset.intended_usage,
      candidate_count: preset.candidate_count,
    }));
  };

  const set = (key: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await studio.createProject({
        ...form,
        status: "ready",
      });
      studio.setSection("creation_projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>Persona Creator</h1>
          <p className="ps-muted">
            Strukturierte Erstellung von Brand-Cast-Kandidaten. Keine Image-Studio-
            Produktgenerierung.
          </p>
        </div>
      </header>

      {studio.providerSetupMessage ? (
        <div className="ps-callout ps-callout-warn">{studio.providerSetupMessage}</div>
      ) : null}

      <div className="ps-preset-row">
        <span className="ps-muted">Vorlagen (nur Startwerte):</span>
        {studio.presets.map((p) => (
          <button key={p.id} type="button" className="ps-chip" onClick={() => applyPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <ol className="ps-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "is-active" : i < step ? "is-done" : ""}>
            <button type="button" onClick={() => setStep(i)}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="ps-form-grid">
        {step === 0 ? (
          <>
            <label>
              Name
              <input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label>
              Brand-Rolle
              <select
                value={form.brand_role}
                onChange={(e) => set("brand_role", e.target.value)}
              >
                {Object.entries(BRAND_ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <label>
              Geschlechtspräsentation
              <input
                value={form.gender_presentation}
                onChange={(e) => set("gender_presentation", e.target.value)}
              />
            </label>
            <label>
              Altersrange
              <input value={form.age_range} onChange={(e) => set("age_range", e.target.value)} />
            </label>
            <label>
              Körpergröße
              <input
                value={form.height_range}
                onChange={(e) => set("height_range", e.target.value)}
              />
            </label>
            <label>
              Körpertyp
              <input value={form.body_type} onChange={(e) => set("body_type", e.target.value)} />
            </label>
            <label>
              Hautton-Richtung
              <input
                value={form.skin_tone_direction}
                onChange={(e) => set("skin_tone_direction", e.target.value)}
              />
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <label>
              Gesichtsform
              <input
                value={form.face_shape_direction}
                onChange={(e) => set("face_shape_direction", e.target.value)}
              />
            </label>
            <label>
              Haar
              <input
                value={form.hair_direction}
                onChange={(e) => set("hair_direction", e.target.value)}
              />
            </label>
            <label>
              Gesichtshaar
              <input
                value={form.facial_hair_direction}
                onChange={(e) => set("facial_hair_direction", e.target.value)}
              />
            </label>
            <label>
              Augen
              <input
                value={form.eye_direction}
                onChange={(e) => set("eye_direction", e.target.value)}
              />
            </label>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <label>
              Ausdruck
              <input
                value={form.expression_direction}
                onChange={(e) => set("expression_direction", e.target.value)}
              />
            </label>
            <label>
              Persönlichkeit
              <input
                value={form.personality}
                onChange={(e) => set("personality", e.target.value)}
              />
            </label>
          </>
        ) : null}
        {step === 4 ? (
          <label>
            Fashion Style
            <input
              value={form.fashion_style}
              onChange={(e) => set("fashion_style", e.target.value)}
            />
          </label>
        ) : null}
        {step === 5 ? (
          <>
            <label>
              Bevorzugte Brand Looks
              <input
                value={form.preferred_brand_looks}
                onChange={(e) => set("preferred_brand_looks", e.target.value)}
              />
            </label>
            <label>
              Bevorzugte Outfits
              <input
                value={form.preferred_outfits}
                onChange={(e) => set("preferred_outfits", e.target.value)}
              />
            </label>
            <label>
              Visuelle Keywords
              <input
                value={form.visual_keywords}
                onChange={(e) => set("visual_keywords", e.target.value)}
              />
            </label>
          </>
        ) : null}
        {step === 6 ? (
          <label>
            Ausgeschlossene Merkmale
            <textarea
              value={form.excluded_features}
              onChange={(e) => set("excluded_features", e.target.value)}
              rows={3}
            />
          </label>
        ) : null}
        {step === 7 ? (
          <label>
            Geplante Nutzung
            <select
              value={form.intended_usage}
              onChange={(e) => set("intended_usage", e.target.value)}
            >
              <option value="image">Nur Bild</option>
              <option value="video">Nur Video</option>
              <option value="image_and_video">Bild und Video</option>
            </select>
          </label>
        ) : null}
        {step === 8 ? (
          <>
            <label>
              Kandidatenanzahl (max. 8)
              <input
                type="number"
                min={1}
                max={8}
                value={form.candidate_count}
                onChange={(e) => set("candidate_count", Number(e.target.value))}
              />
            </label>
            <label>
              Provider-Modus
              <select
                value={form.provider_mode}
                onChange={(e) => set("provider_mode", e.target.value)}
              >
                <option value="manual_upload">Manueller Upload</option>
                <option value="image_provider">Image Provider (OpenAI)</option>
                <option value="hybrid">Hybrid</option>
                <option value="disabled">Deaktiviert</option>
              </select>
            </label>
            <label>
              Zusätzliche Beschreibung
              <textarea
                value={form.additional_description}
                onChange={(e) => set("additional_description", e.target.value)}
                rows={3}
                placeholder="Optional — kein komplexer Prompt nötig"
              />
            </label>
          </>
        ) : null}
        {step === 9 ? (
          <div className="ps-callout">
            <p>
              Projekt wird als Entwurf gespeichert. Bezahlte Generierung startet erst nach
              expliziter Kostenbestätigung im Creation-Projekt.
            </p>
            <p className="ps-muted">
              {form.candidate_count} Kandidaten · Stage A: 3 Vorschaubilder je Kandidat ·
              Modus: {form.provider_mode}
            </p>
          </div>
        ) : null}
      </div>

      {error ? <p className="ps-error-inline">{error}</p> : null}

      <div className="ps-actions">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Zurück
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)}>
            Weiter
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Projekt speichern
          </button>
        )}
      </div>
    </section>
  );
}

export function CreationProjectsView({
  studio,
}: {
  studio: PersonaStudioController;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCost, setConfirmCost] = useState(false);
  const selected = studio.creationProjects.find(
    (p) => p.id === studio.selectedProjectId,
  );

  const runEstimate = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await studio.estimateProjectCost(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schätzung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async (id: string) => {
    if (!confirmCost) {
      setError("Bitte Kosten explizit bestätigen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await studio.generateCandidates(id, {
        costConfirmed: true,
        retryConfirmed: Boolean(selected && selected.actual_cost > 0),
      });
      setConfirmCost(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>Creation Projects</h1>
          <p className="ps-muted">Modell-Erstellungssessions und Kostkontrolle.</p>
        </div>
        <button type="button" onClick={() => studio.setSection("creator")}>
          Neues Projekt
        </button>
      </header>

      <div className="ps-list">
        {studio.creationProjects.length === 0 ? (
          <p className="ps-muted">Noch keine Creation-Projekte.</p>
        ) : (
          studio.creationProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ps-list-item${studio.selectedProjectId === p.id ? " is-active" : ""}`}
              onClick={() => void studio.loadProject(p.id)}
            >
              <strong>{p.name || "Unbenannt"}</strong>
              <span>
                {BRAND_ROLE_LABELS[p.brand_role]} · {p.status} · {p.provider_mode}
              </span>
            </button>
          ))
        )}
      </div>

      {selected ? (
        <div className="ps-detail">
          <h2>{selected.name}</h2>
          <p className="ps-muted">
            {selected.candidate_count} Kandidaten · Stage {selected.generation_stage} ·
            Ist-Kosten {selected.actual_cost.toFixed(2)} €
          </p>
          <div className="ps-actions">
            <button type="button" disabled={busy} onClick={() => void runEstimate(selected.id)}>
              Kosten schätzen
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void studio.prepareManualCandidates(selected.id)}
            >
              Manuelle Slots vorbereiten
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void studio.loadProject(selected.id, { openCandidates: true })}
            >
              Kandidaten öffnen
            </button>
          </div>
          {studio.costEstimate ? (
            <div className="ps-callout">
              <p>
                Schätzung: {studio.costEstimate.candidateCount} ×{" "}
                {studio.costEstimate.imagesPerCandidate} Bilder ={" "}
                {studio.costEstimate.totalImages} · Provider {studio.costEstimate.provider}
              </p>
              <p>
                Min {studio.costEstimate.estimatedMin.toFixed(2)} € · Max{" "}
                {studio.costEstimate.estimatedMax.toFixed(2)} € · Ø{" "}
                {studio.costEstimate.estimatedTotal.toFixed(2)} €
              </p>
              <p className="ps-muted">{studio.costEstimate.note}</p>
              <label className="ps-check">
                <input
                  type="checkbox"
                  checked={confirmCost}
                  onChange={(e) => setConfirmCost(e.target.checked)}
                />
                Ich bestätige die geschätzten Kosten und starte die Generierung bewusst.
              </label>
              <button
                type="button"
                disabled={busy || !confirmCost || !studio.costEstimate.available}
                onClick={() => void runGenerate(selected.id)}
              >
                Generierung starten
              </button>
            </div>
          ) : null}
          {error ? <p className="ps-error-inline">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function CandidatesView({ studio }: { studio: PersonaStudioController }) {
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const selected = useMemo(
    () => studio.candidates.find((c) => c.id === studio.selectedCandidateId) ?? null,
    [studio.candidates, studio.selectedCandidateId],
  );

  const act = async (body: Record<string, unknown>) => {
    if (!selected) return;
    setError(null);
    try {
      await studio.patchCandidate(selected.id, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <h1>Kandidaten</h1>
          <p className="ps-muted">
            Vergleichen, shortlisten, ablehnen, auswählen — Auswahl erzeugt nur einen
            Draft-Persona, keine Produktionsfreigabe.
          </p>
        </div>
      </header>

      {studio.candidates.length === 0 ? (
        <p className="ps-muted">
          Keine Kandidaten. Opening Creation Projects → manuelle Slots oder Generierung.
        </p>
      ) : (
        <div className="ps-candidate-grid">
          {studio.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ps-candidate-card${studio.selectedCandidateId === c.id ? " is-active" : ""}`}
              onClick={() => void studio.loadCandidate(c.id)}
            >
              <strong>
                #{c.candidate_number} {c.candidate_name}
              </strong>
              <span>{c.status}</span>
              <em>
                Fit {c.brand_fit_score ?? "—"} · Video {c.video_suitability_score ?? "—"}
              </em>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="ps-detail">
          <h2>
            {selected.candidate_name}{" "}
            <span className="ps-muted">({selected.status})</span>
          </h2>
          <p>{selected.identity_summary || "Keine Identitätszusammenfassung"}</p>
          <p className="ps-muted">{selected.distinguishing_features}</p>

          <div className="ps-ref-grid">
            {studio.candidateAssets.map((a) => (
              <figure key={a.id} className="ps-ref-thumb">
                {a.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.signed_url} alt={a.asset_type} />
                ) : (
                  <div className="ps-muted">URL fehlgeschlagen</div>
                )}
                <figcaption>
                  {a.asset_type}
                  {a.is_primary ? " · Primär" : ""}
                </figcaption>
              </figure>
            ))}
          </div>

          <details className="ps-tech">
            <summary>Technische Details</summary>
            <pre>{JSON.stringify({
              provider: selected.provider,
              job: selected.provider_job_id,
              seed: selected.generation_seed,
            }, null, 2)}</pre>
          </details>

          <label>
            Notizen
            <textarea
              value={notes || selected.user_notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </label>
          <div className="ps-actions">
            <button type="button" onClick={() => void act({ user_rating: 5, user_notes: notes })}>
              Note speichern / 5★
            </button>
            <button type="button" onClick={() => void act({ status: "shortlisted" })}>
              Shortlist
            </button>
            <button
              type="button"
              onClick={() =>
                void act({ status: "rejected", rejection_reason: notes || "Ungeeignet" })
              }
            >
              Ablehnen
            </button>
            <button type="button" onClick={() => void act({ status: "selected" })}>
              Auswählen
            </button>
            <button
              type="button"
              onClick={() => void studio.convertCandidate(selected.id).catch((e: Error) => setError(e.message))}
            >
              In Draft-Persona überführen
            </button>
            <label className="ps-upload">
              Ersatz-Referenz hochladen
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.set("file", file);
                  form.set("asset_type", "portrait_front");
                  form.set("is_primary", "true");
                  void studio.uploadCandidateAsset(selected.id, form).catch((err: Error) =>
                    setError(err.message),
                  );
                }}
              />
            </label>
          </div>
          {error ? <p className="ps-error-inline">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
