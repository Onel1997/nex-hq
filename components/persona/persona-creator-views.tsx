"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PersonaStudioController } from "@/components/persona/use-persona-studio";
import {
  NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
  NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
  formatNoveltyReplacementTimeoutMessage,
  REPLACEMENT_JOB_STALE_MESSAGE,
  computeReplacementElapsed,
  outcomeMessage,
  stageLabelForCheckpoint,
  type ActiveNoveltyReplacementDto,
} from "@/lib/persona/creation/novelty-replacement-result";
import { createNoveltyReplacementPollController } from "@/lib/persona/creation/novelty-replacement-execution";
import type {
  BrandRole,
  IntendedUsage,
  ProviderMode,
} from "@/lib/persona/domain/creation-types";
import {
  CAST_MILESTONES,
  CREATOR_STEPS,
  GENERATION_INCLUDES,
  STYLE_STARTERS,
  VISUAL_FLOW,
  PRESET_CARD_META,
  VISIBLE_PROVIDER_MODES,
  brandRoleDisplayLabel,
  computeCastProgressView,
  computeCreatorCostPreview,
  computeLiveCastScores,
  creatorPrimaryActionLabel,
  fashionDirectionLabel,
  isPaidProviderMode,
  isPersonaDefined,
  primaryFaceLabel,
  usageDisplayLabel,
  canStartPaidCandidateGeneration,
  countUnattestedPaidJobs,
  isDebugRunCandidate,
  isUnattestedPaidGenerationJob,
  type CreatorFormState,
  type CreatorCostPreview,
  type PresetCardMeta,
} from "@/components/persona/persona-creator-ux";
import { PersonaGenerationExperience } from "@/components/persona/persona-generation-experience";
import { BrandArchetypeCastPanel } from "@/components/persona/brand-archetype-cast-panel";
import { OfficialBrandFaceMilestonePanel } from "@/components/persona/official-brand-face-milestone-panel";
import { OfficialBrandFaceCastingView } from "@/components/persona/official-brand-face-casting-view";
import { FaceNoveltyLiveCheckPanel } from "@/components/persona/face-novelty-live-check-panel";
import { ReferenceBoardsPanel } from "@/components/persona/reference-boards-panel";
import { PersonaStatusChip } from "@/components/persona/persona-status-chip";
import {
  CandidateBoardCard,
  NoveltyFailureSlotCard,
  rankCandidatesForBoard,
  CandidateComparePanel,
  CandidateDetailGallery,
  CandidateLightbox,
  CandidateNotesPanel,
  CandidateQualityPanel,
  getCandidateDiversityWarning,
  getCandidateVariationLabel,
} from "@/components/persona/candidate-board";
import { CandidateStatusBadge } from "@/components/persona/candidate-status-badge";
import {
  canPrepareManualSlots,
  evaluatePreparePaidConfirmationGate,
} from "@/lib/persona/creation/creation-workflow";
import {
  assertProjectSelectionSync,
  canRenderProjectCandidates,
  DEBUG_MODE,
  discoverySlotLabel,
  isProjectDetailReady,
  projectIdPrefix,
  projectScopedCandidatesCacheKey,
  resolvePreviewUrlForCandidate,
} from "@/components/persona/persona-studio-project-sync";
import { redactAssetPathForDebug, assertNoSignedUrlLeakage } from "@/lib/persona/face-novelty-memory/safe-debug-redact";
import {
  logCandidateRenderForensics,
  resolveGenerationSource,
  validateProjectCandidateBoardState,
} from "@/lib/persona/creation/casting-data-integrity";
import {
  Check,
  Circle,
  Diamond,
  Frame,
  Landmark,
  Loader2,
  Lock,
  Package,
  Sparkles,
  Store,
  UserRound,
  Users,
  Wind,
} from "lucide-react";

const BRAND_ROLE_LABELS: Record<BrandRole, string> = {
  primary_male: "Primary Male",
  secondary_male: "Secondary Male",
  primary_female: "Primary Female",
  secondary_female: "Secondary Female",
  unisex_editorial: "Unisex Editorial",
  campaign_specialist: "Campaign Specialist",
};

const PRESET_ICONS = {
  diamond: Diamond,
  frame: Frame,
  urban: Wind,
  campaign: Sparkles,
  nordic: Landmark,
  commercial: Store,
} as const;

const MILESTONE_ICONS = [UserRound, Users, Check, Circle, Package, Lock, Sparkles] as const;

function ScoreMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="ps-score-meter">
      <div className="ps-score-meter-head">
        <span>{label}</span>
        <strong className="ps-score-counter">{value}</strong>
      </div>
      <div className="ps-score-track" aria-hidden>
        <span className="ps-score-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PresetIcon({ icon }: { icon: PresetCardMeta["icon"] }) {
  const Icon = PRESET_ICONS[icon];
  return <Icon className="size-5" strokeWidth={1.4} aria-hidden />;
}

function GenerationEconomicsCheckout({
  cost,
  providerMode,
}: {
  cost: CreatorCostPreview;
  providerMode: ProviderMode;
}) {
  const paid = isPaidProviderMode(providerMode);

  return (
    <div className="ps-cost-checkout">
      <div className="ps-cost-checkout-head">
        <span className="ps-cost-checkout-label">Generation Economics</span>
        {paid ? (
          <span className="ps-provider-badge">{cost.provider}</span>
        ) : (
          <span className="ps-provider-badge ps-provider-badge--muted">{cost.provider}</span>
        )}
      </div>

      {paid ? (
        <>
          <div className="ps-cost-checkout-hero">
            <em>Estimated Generation Cost</em>
            <strong className="ps-cost-checkout-price">
              {cost.estimatedMin.toFixed(2)}–{cost.estimatedMax.toFixed(2)} {cost.currency}
            </strong>
            <div className="ps-cost-checkout-meta">
              <span>per generation</span>
              <span>OpenAI GPT Image</span>
              <span>Premium Quality</span>
            </div>
          </div>
          <div className="ps-cost-checkout-secondary">
            <div>
              <em>Expected time</em>
              <strong>
                {cost.expectedMinutesMin}–{cost.expectedMinutesMax} min
              </strong>
            </div>
            <div className="ps-cost-checkout-budget">
              <em>Daily budget</em>
              <strong>
                {cost.dailyBudget} {cost.currency}
              </strong>
            </div>
          </div>
        </>
      ) : (
        <div className="ps-cost-checkout-hero">
          <em>Estimated Generation Cost</em>
          <strong className="ps-cost-checkout-price ps-cost-checkout-price--free">0.00 {cost.currency}</strong>
          <div className="ps-cost-checkout-meta">
            <span>per generation</span>
            <span>Manual Upload</span>
            <span>No provider cost</span>
          </div>
          <div className="ps-cost-checkout-budget ps-cost-checkout-budget--solo">
            <em>Daily budget</em>
            <strong>
              {cost.dailyBudget} {cost.currency}
            </strong>
          </div>
        </div>
      )}

      {paid ? (
        <div className="ps-generation-includes">
          <p>Generation includes:</p>
          <ul>
            {GENERATION_INCLUDES.map((item) => (
              <li key={item}>
                <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="ps-muted ps-cost-checkout-note">{cost.note}</p>
    </div>
  );
}

function ProviderModePicker({
  value,
  onChange,
}: {
  value: ProviderMode;
  onChange: (mode: ProviderMode) => void;
}) {
  const hidden =
    !VISIBLE_PROVIDER_MODES.some((m) => m.value === value) ? value : null;

  return (
    <div className="ps-provider-picker">
      <span className="ps-provider-picker-label">Generation Provider</span>
      <div className="ps-provider-options" role="radiogroup" aria-label="Generation Provider">
        {VISIBLE_PROVIDER_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={value === mode.value}
            className={`ps-provider-option${value === mode.value ? " is-active" : ""}`}
            onClick={() => onChange(mode.value)}
          >
            <span className="ps-provider-option-head">
              <strong>{mode.label}</strong>
              {mode.value === "image_provider" ? (
                <span className="ps-provider-badge">OpenAI</span>
              ) : null}
            </span>
            <p>{mode.description}</p>
          </button>
        ))}
        {hidden ? (
          <p className="ps-muted ps-provider-hidden-note">
            Current mode ({hidden}) is hidden until Image Studio ships.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ps-empty-state ps-empty-state--luxury">
      <div className="ps-empty-state-art" aria-hidden>
        <UserRound className="size-12" strokeWidth={1.1} />
      </div>
      <p className="ps-eyebrow">Milaene Casting</p>
      <strong>{title}</strong>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button type="button" className="ps-empty-state-cta" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function BrandCastView({ studio }: { studio: PersonaStudioController }) {
  const p = studio.brandCastProgress;
  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <p className="ps-eyebrow">Official Faces</p>
          <h1>Brand Cast</h1>
          <p className="ps-muted">
            The approved faces of Milaene — Image and Video Studio stay dark until the cast
            is complete.
          </p>
        </div>
      </header>

      {!p ? (
        <EmptyState
          title="Preparing Brand Cast progress"
          body="Your casting milestone will appear here in a moment."
        />
      ) : (
        <div className="ps-brand-cast">
          <OfficialBrandFaceMilestonePanel />
          <div className={`ps-milestone${p.milestone_reached ? " is-done" : ""}`}>
            <span className="ps-milestone-label">{p.milestone_label}</span>
            <strong>{p.milestone_reached ? "Reached" : "In progress"}</strong>
          </div>
          {!p.milestone_reached && p.male_approved === 0 && p.female_approved === 0 ? (
            <EmptyState
              title="No Brand Cast has been approved yet."
              body="Cast your first official faces in Brand Face Casting — then lock identity and approve."
            />
          ) : null}
          <div className="ps-stat-grid">
            <div className="ps-stat">
              <em>Male faces</em>
              <strong>
                {p.male_approved}/{p.male_required}
              </strong>
            </div>
            <div className="ps-stat">
              <em>Female faces</em>
              <strong>
                {p.female_approved}/{p.female_required}
              </strong>
            </div>
            <div className="ps-stat">
              <em>Image ready</em>
              <strong>{p.image_ready_count}</strong>
            </div>
            <div className="ps-stat">
              <em>Video ready</em>
              <strong>{p.video_ready_count}</strong>
            </div>
          </div>
          {p.missing_reference_requirements.length > 0 ? (
            <div className="ps-callout">
              <p>Still needed for a complete cast</p>
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

const DEFAULT_CREATOR_FORM: CreatorFormState = {
  name: "",
  brand_role: "primary_male",
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
  intended_usage: "image_and_video",
  candidate_count: 4,
  provider_mode: "manual_upload",
  quality_mode: "premium_editorial",
  additional_description: "",
  description: "",
};

export function PersonaCreatorView({
  studio,
}: {
  studio: PersonaStudioController;
}) {
  const [mode, setMode] = useState<"official" | "legacy_debug">("official");

  if (mode === "official") {
    return (
      <OfficialBrandFaceCastingView
        studio={studio}
        onOpenDebugWizard={() => setMode("legacy_debug")}
      />
    );
  }

  return (
    <LegacyPersonaCreatorWizard
      studio={studio}
      onBackToOfficial={() => setMode("official")}
    />
  );
}

/**
 * Legacy manual wizard — debug / custom personas only.
 * Not the default Milaene Official Brand Face workflow.
 */
function LegacyPersonaCreatorWizard({
  studio,
  onBackToOfficial,
}: {
  studio: PersonaStudioController;
  onBackToOfficial: () => void;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCast, setConfirmCast] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatorFormState>(DEFAULT_CREATOR_FORM);
  const [stepKey, setStepKey] = useState(0);
  const [previewGen, setPreviewGen] = useState(false);

  const scores = useMemo(() => computeLiveCastScores(form), [form]);
  const cost = useMemo(() => computeCreatorCostPreview(form), [form]);
  const progress = useMemo(() => computeCastProgressView(form), [form]);
  const defined = isPersonaDefined(form);
  const fashionLabel = fashionDirectionLabel(form);

  useEffect(() => {
    setStepKey((k) => k + 1);
  }, [step]);

  const applyPreset = (presetId: string) => {
    const preset = studio.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
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

  const applyStarter = (starterId: string) => {
    const starter = STYLE_STARTERS.find((s) => s.id === starterId);
    if (!starter) return;
    setActivePresetId(starterId);
    setForm((prev) => ({ ...prev, ...starter.patch }));
  };

  const set = (key: keyof CreatorFormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const goTo = (next: number) => {
    setStep(Math.max(0, Math.min(CREATOR_STEPS.length - 1, next)));
    if (next < CREATOR_STEPS.length - 1) setConfirmCast(false);
  };

  const submit = async () => {
    if (!confirmCast) {
      setError("Please confirm the Brand Cast summary before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await studio.createProject({
        ...form,
        status: "draft",
      });
      studio.setSection("creation_projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Primary Brand Face", value: primaryFaceLabel(form) },
    { label: "Role", value: brandRoleDisplayLabel(form.brand_role) },
    { label: "Age Range", value: form.age_range || "—" },
    { label: "Height", value: form.height_range || "—" },
    { label: "Body Type", value: form.body_type || "—" },
    { label: "Hair", value: form.hair_direction || "—" },
    { label: "Facial Hair", value: form.facial_hair_direction || "—" },
    { label: "Eye Color", value: form.eye_direction || "—" },
    { label: "Skin Tone", value: form.skin_tone_direction || "—" },
    { label: "Fashion Direction", value: form.fashion_style || "—" },
    { label: "Campaign Usage", value: usageDisplayLabel(form.intended_usage) },
    { label: "Target Audience", value: form.preferred_brand_looks || "—" },
  ];

  return (
    <section className="ps-panel ps-creator">
      <header className="ps-panel-header">
        <div>
          <p className="ps-eyebrow">Debug / Custom</p>
          <h1>Legacy Persona Wizard</h1>
          <p className="ps-muted">
            Manual Brand Role → Body → Face wizard for debug or future custom personas.
            Official Milaene Brand Faces use Brand Face Casting instead.
          </p>
        </div>
        <button type="button" className="ps-btn-secondary" onClick={onBackToOfficial}>
          Back to Brand Face Casting
        </button>
      </header>

      <div className="ps-callout ps-callout-warn">
        This wizard is not the default Milaene workflow. Face, body, hair and fashion for
        Official Brand Faces must come from Brand Memory, Archetype, Product and Reference
        Intelligence.
      </div>

      <nav className="ps-visual-flow" aria-label="Brand Cast journey">
        {VISUAL_FLOW.map((node, i) => {
          const current = node.id === "creator";
          const done = i < 1;
          return (
            <div key={node.id} className="ps-visual-flow-item">
              {i > 0 ? <span className="ps-visual-flow-arrow" aria-hidden>↓</span> : null}
              <span
                className={`ps-visual-flow-node${current ? " is-current" : ""}${done ? " is-done" : ""}`}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </nav>

      {studio.providerSetupMessage ? (
        <div className="ps-callout ps-callout-warn">{studio.providerSetupMessage}</div>
      ) : null}

      <div className="ps-preset-gallery">
        <div className="ps-section-label">
          <span>Casting Directions</span>
          <em>Starting points only — never auto-submit</em>
        </div>
        <div className="ps-preset-cards">
          {studio.presets.map((p) => {
            const meta = PRESET_CARD_META[p.id] ?? {
              title: p.label,
              description: p.fashion_style,
              usage: usageDisplayLabel(p.intended_usage),
              icon: "diamond" as const,
              bestFor: ["Campaigns", "Editorial"] as const,
            };
            return (
              <button
                key={p.id}
                type="button"
                className={`ps-preset-card${activePresetId === p.id ? " is-active" : ""}`}
                onClick={() => applyPreset(p.id)}
              >
                <span className="ps-preset-card-icon">
                  <PresetIcon icon={meta.icon} />
                </span>
                <strong>{meta.title}</strong>
                <p>{meta.description}</p>
                <div className="ps-preset-card-footer">
                  <span>Best for</span>
                  <em>{meta.bestFor.join(" · ")}</em>
                </div>
              </button>
            );
          })}
          {STYLE_STARTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ps-preset-card${activePresetId === s.id ? " is-active" : ""}`}
              onClick={() => applyStarter(s.id)}
            >
              <span className="ps-preset-card-icon">
                <PresetIcon icon={s.meta.icon} />
              </span>
              <strong>{s.meta.title}</strong>
              <p>{s.meta.description}</p>
              <div className="ps-preset-card-footer">
                <span>Best for</span>
                <em>{s.meta.bestFor.join(" · ")}</em>
              </div>
            </button>
          ))}
        </div>
      </div>

      <ol className="ps-step-nav" aria-label="Creator steps">
        {CREATOR_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "upcoming";
          return (
            <li key={s.id} className={`ps-step-nav-item is-${state}`}>
              <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                <span className="ps-step-marker" aria-hidden>
                  {state === "done" ? <Check className="size-3" strokeWidth={2.5} /> : null}
                  {state === "current" ? <span className="ps-step-dot" /> : null}
                  {state === "upcoming" ? <span className="ps-step-ring" /> : null}
                </span>
                <span className="ps-step-label">{s.short}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="ps-creator-layout">
        <div className="ps-creator-main">
          <div key={stepKey} className="ps-step-pane">
            <h2 className="ps-step-title">{CREATOR_STEPS[step]?.label}</h2>
            <div className="ps-form-grid">
              {step === 0 ? (
                <>
                  <label>
                    Name
                    <input value={form.name} onChange={(e) => set("name", e.target.value)} />
                  </label>
                  <label>
                    Brand Role
                    <select
                      value={form.brand_role}
                      onChange={(e) => set("brand_role", e.target.value as BrandRole)}
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
                    Gender Presentation
                    <input
                      value={form.gender_presentation}
                      onChange={(e) => set("gender_presentation", e.target.value)}
                    />
                  </label>
                  <label>
                    Age Range
                    <input value={form.age_range} onChange={(e) => set("age_range", e.target.value)} />
                  </label>
                  <label>
                    Height
                    <input
                      value={form.height_range}
                      onChange={(e) => set("height_range", e.target.value)}
                    />
                  </label>
                  <label>
                    Body Type
                    <input value={form.body_type} onChange={(e) => set("body_type", e.target.value)} />
                  </label>
                  <label>
                    Skin Tone
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
                    Face Shape
                    <input
                      value={form.face_shape_direction}
                      onChange={(e) => set("face_shape_direction", e.target.value)}
                    />
                  </label>
                  <label>
                    Hair
                    <input
                      value={form.hair_direction}
                      onChange={(e) => set("hair_direction", e.target.value)}
                    />
                  </label>
                  <label>
                    Facial Hair
                    <input
                      value={form.facial_hair_direction}
                      onChange={(e) => set("facial_hair_direction", e.target.value)}
                    />
                  </label>
                  <label>
                    Eyes
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
                    Expression
                    <input
                      value={form.expression_direction}
                      onChange={(e) => set("expression_direction", e.target.value)}
                    />
                  </label>
                  <label>
                    Personality
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
                    Preferred Brand Looks
                    <input
                      value={form.preferred_brand_looks}
                      onChange={(e) => set("preferred_brand_looks", e.target.value)}
                    />
                  </label>
                  <label>
                    Preferred Outfits
                    <input
                      value={form.preferred_outfits}
                      onChange={(e) => set("preferred_outfits", e.target.value)}
                    />
                  </label>
                  <label>
                    Visual Keywords
                    <input
                      value={form.visual_keywords}
                      onChange={(e) => set("visual_keywords", e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {step === 6 ? (
                <label>
                  Excluded Features
                  <textarea
                    value={form.excluded_features}
                    onChange={(e) => set("excluded_features", e.target.value)}
                    rows={3}
                  />
                </label>
              ) : null}
              {step === 7 ? (
                <label>
                  Intended Usage
                  <select
                    value={form.intended_usage}
                    onChange={(e) => set("intended_usage", e.target.value as IntendedUsage)}
                  >
                    <option value="image">Image only</option>
                    <option value="video">Video only</option>
                    <option value="image_and_video">Image and Video</option>
                  </select>
                </label>
              ) : null}
              {step === 8 ? (
                <>
                  <label>
                    Candidate Count (max 8)
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={form.candidate_count}
                      onChange={(e) => set("candidate_count", Number(e.target.value))}
                    />
                  </label>
                  <ProviderModePicker
                    value={form.provider_mode}
                    onChange={(mode) => set("provider_mode", mode)}
                  />
                  <label>
                    Additional Notes
                    <textarea
                      value={form.additional_description}
                      onChange={(e) => set("additional_description", e.target.value)}
                      rows={3}
                      placeholder="Optional — no complex prompt needed"
                    />
                  </label>
                  <GenerationEconomicsCheckout cost={cost} providerMode={form.provider_mode} />
                </>
              ) : null}
              {step === 9 ? (
                <div className="ps-confirm-screen">
                  <div className="ps-section-label">
                    <span>Brand Cast Summary</span>
                    <em>Review before saving this casting brief</em>
                  </div>
                  <dl className="ps-confirm-summary">
                    {summaryRows.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <GenerationEconomicsCheckout cost={cost} providerMode={form.provider_mode} />
                  <div className="ps-confirm-metrics">
                    <div>
                      <em>Candidate Count</em>
                      <strong className="ps-score-counter">{form.candidate_count}</strong>
                    </div>
                    <div>
                      <em>Provider</em>
                      <strong>{cost.generationMode}</strong>
                    </div>
                  </div>
                  <label className="ps-payment-confirm">
                    <input
                      type="checkbox"
                      checked={confirmCast}
                      onChange={(e) => setConfirmCast(e.target.checked)}
                    />
                    <div className="ps-payment-confirm-copy">
                      <strong>
                        I understand that generation will use paid OpenAI credits and the estimated
                        costs shown above.
                      </strong>
                      <span>No generation starts until I confirm.</span>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          {error ? <p className="ps-error-inline">{error}</p> : null}

          <div className="ps-actions">
            <button type="button" disabled={step === 0} onClick={() => goTo(step - 1)}>
              Back
            </button>
            {step < CREATOR_STEPS.length - 1 ? (
              <button type="button" className="ps-btn-primary" onClick={() => goTo(step + 1)}>
                {creatorPrimaryActionLabel(step, form.provider_mode)}
              </button>
            ) : (
              <button
                type="button"
                className="ps-btn-primary"
                disabled={busy || !confirmCast}
                onClick={() => void submit()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirm Brand Cast
              </button>
            )}
          </div>
        </div>

        <aside className="ps-creator-aside" aria-label="Live Brand Cast summary">
          <OfficialBrandFaceMilestonePanel />
          <BrandArchetypeCastPanel />
          <div className="ps-live-summary">
            <div className="ps-live-summary-head">
              <span className="ps-eyebrow">Live Preview</span>
              <h3>Brand Cast Summary</h3>
            </div>

            <div className="ps-live-portrait-wrap">
              <div className="ps-live-portrait" aria-hidden>
                <span className="ps-live-portrait-frame">
                  <UserRound className="size-10" strokeWidth={1.15} />
                </span>
              </div>
            </div>

            <div className="ps-live-hero">
              <span className="ps-live-role">{brandRoleDisplayLabel(form.brand_role)}</span>
              <strong>{fashionLabel}</strong>
              <p>Official Milaene Brand Face</p>
              <div className="ps-chip-row-premium">
                <PersonaStatusChip label="Brand Face" tone="brand" />
                <PersonaStatusChip label="Premium" tone="premium" />
                <PersonaStatusChip
                  label="Image Ready"
                  tone={scores.imageReadiness >= 60 ? "image" : "muted"}
                />
                <PersonaStatusChip
                  label="Video Ready"
                  tone={scores.videoReadiness >= 60 ? "video" : "muted"}
                />
              </div>
            </div>

            <dl className="ps-live-facts">
              {summaryRows.slice(2).map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="ps-live-scores">
              <ScoreMeter label="Brand Fit" value={scores.brandFit} />
              <ScoreMeter label="Luxury Score" value={scores.luxury} />
              <ScoreMeter label="Commercial Score" value={scores.commercial} />
              <ScoreMeter label="Video Readiness" value={scores.videoReadiness} />
              <ScoreMeter label="Image Readiness" value={scores.imageReadiness} />
              <ScoreMeter label="Consistency Score" value={scores.consistency} />
            </div>
          </div>

          <div className="ps-candidate-showcase">
            <div className="ps-section-label">
              <span>Candidate Preview</span>
              <button
                type="button"
                className="ps-link-quiet"
                onClick={() => {
                  setPreviewGen((v) => !v);
                }}
              >
                {previewGen ? "Hide experience" : "Preview experience"}
              </button>
            </div>

            <PersonaGenerationExperience
              active={previewGen}
              candidateCount={form.candidate_count || 4}
            />

            {!previewGen ? (
              <div className="ps-candidate-showcase-body">
                <div className="ps-candidate-empty">
                  <div className="ps-candidate-empty-icon" aria-hidden>
                    <UserRound className="size-10" strokeWidth={1.15} />
                  </div>
                  <p className="ps-eyebrow">Awaiting generation</p>
                  <h4>Waiting for Generation</h4>
                  <p>No candidates generated yet.</p>
                  <p className="ps-candidate-empty-hint">
                    After generation you can compare, rate, shortlist, and approve your official
                    brand faces.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <ReferenceBoardsPanel />

          <div className="ps-cast-progress">
            <div className="ps-section-label">
              <span>Brand Cast Progress</span>
            </div>
            <div className="ps-cast-progress-role">{brandRoleDisplayLabel(form.brand_role)}</div>
            <div
              className="ps-cast-progress-bar ps-cast-progress-bar--lg"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${Math.max(progress.percent, 6)}%` }} />
            </div>
            <div className="ps-cast-progress-meta">
              <div>
                <em>Current milestone</em>
                <strong>{progress.currentMilestone}</strong>
              </div>
              <div>
                <em>Next milestone</em>
                <strong>{progress.nextMilestone}</strong>
              </div>
              <div>
                <em>Estimated completion</em>
                <strong>{progress.estimatedCompletion}</strong>
              </div>
            </div>
            <ul className="ps-cast-milestones ps-cast-milestones--icons">
              {CAST_MILESTONES.map((m, i) => {
                const done = i < progress.completedCount;
                const current = i === progress.completedCount;
                const Icon = MILESTONE_ICONS[i] ?? Circle;
                return (
                  <li
                    key={m.id}
                    className={`${done ? "is-done" : ""}${current ? " is-current" : ""}`}
                  >
                    <span className="ps-milestone-icon" aria-hidden>
                      <Icon className="size-3.5" strokeWidth={1.6} />
                    </span>
                    {m.label}
                  </li>
                );
              })}
            </ul>
            {defined ? null : (
              <p className="ps-muted ps-cast-hint">
                Complete the casting brief to mark the first milestone.
              </p>
            )}
          </div>
        </aside>
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCost, setConfirmCost] = useState(false);

  const detailReady = isProjectDetailReady({
    selectedProjectId: studio.selectedProjectId,
    loadedProjectId: studio.loadedProjectId,
    loadedProject: studio.loadedProject,
  });
  const selected = detailReady ? studio.loadedProject : null;
  const detailLoading =
    studio.selectedProjectId != null &&
    studio.loadedProjectId !== studio.selectedProjectId;

  useEffect(() => {
    assertProjectSelectionSync({
      clickedProjectId: studio.selectedProjectId,
      loadedProjectId: studio.loadedProjectId,
      renderedProjectId: selected?.id ?? null,
    });
  }, [studio.selectedProjectId, studio.loadedProjectId, selected?.id]);

  useEffect(() => {
    setConfirmCost(false);
    setError(null);
  }, [studio.selectedProjectId]);

  const paidGenerationEnabled =
    studio.health?.paidGenerationSafety?.paidGenerationEnabled ?? false;
  const openaiApiKeyConfigured =
    studio.health?.paidGenerationSafety?.openaiApiKeyConfigured ?? false;

  const prepareConfirmationGate = useMemo(
    () =>
      evaluatePreparePaidConfirmationGate({
        project: selected,
        projectLoaded: detailReady,
        busy,
        paidGenerationSafety: studio.health?.paidGenerationSafety ?? null,
      }),
    [selected, detailReady, busy, studio.health?.paidGenerationSafety],
  );

  const canPrepareConfirmation = prepareConfirmationGate.allowed;

  useEffect(() => {
    if (!DEBUG_MODE || !selected) return;

    console.log("[persona] prepare confirmation gate", {
      selectedProjectId: studio.selectedProjectId,
      loadedProjectId: studio.loadedProjectId,
      projectStatus: selected.status,
      providerMode: selected.provider_mode,
      generationStage: selected.generation_stage,
      paidGenerationEnabled,
      openaiApiKeyConfigured,
      healthStatus: studio.health?.status ?? null,
      busy,
      canPrepareConfirmation,
      disabledReasons: prepareConfirmationGate.disabledReasons,
    });
  }, [
    selected,
    studio.selectedProjectId,
    studio.loadedProjectId,
    studio.health?.status,
    paidGenerationEnabled,
    openaiApiKeyConfigured,
    busy,
    canPrepareConfirmation,
    prepareConfirmationGate.disabledReasons,
  ]);

  const canStartGeneration = useMemo(() => {
    if (!selected) return false;
    if (!paidGenerationEnabled) return false;
    return canStartPaidCandidateGeneration({
      busy,
      costConfirmed: confirmCost,
      providerMode: selected.provider_mode,
      costEstimate: studio.costEstimate,
      confirmationToken: studio.paidConfirmationToken,
      confirmationProjectId: studio.paidConfirmationProjectId,
      projectId: selected.id,
    });
  }, [
    busy,
    confirmCost,
    selected,
    studio.costEstimate,
    studio.paidConfirmationProjectId,
    studio.paidConfirmationToken,
    paidGenerationEnabled,
  ]);

  const runEstimate = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await studio.preparePaidConfirmation(id);
      setConfirmCost(false);
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
    const confirmationToken = studio.paidConfirmationToken;
    if (!confirmationToken || studio.paidConfirmationProjectId !== id) {
      setError("Bitte zuerst Kostenschätzung & Bestätigungstoken vorbereiten.");
      return;
    }
    setBusy(true);
    setGenerating(true);
    setError(null);
    try {
      await studio.generateCandidates(id, {
        costConfirmed: true,
        confirmationToken,
        userConfirmedAt: new Date().toISOString(),
        retryConfirmed: Boolean(selected && selected.actual_cost > 0),
      });
      setConfirmCost(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setBusy(false);
      setGenerating(false);
    }
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <p className="ps-eyebrow">Sessions</p>
          <h1>Creation Projects</h1>
          <p className="ps-muted">
            Casting sessions with cost control — generation never starts without confirmation.
          </p>
        </div>
        <button type="button" onClick={() => studio.startNewCastingSession()}>
          New casting session
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void studio
              .createSafeTestRun()
              .catch((e: Error) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Neuen sicheren Testlauf anlegen
        </button>
      </header>

      {!paidGenerationEnabled ? (
        <div className="ps-callout ps-callout-warn">
          <p>Kostenpflichtige Generierung ist derzeit gesperrt.</p>
        </div>
      ) : null}

      <div className="ps-list">
        {studio.creationProjects.length === 0 ? (
          <EmptyState
            title="No casting sessions yet."
            body="Open Brand Face Casting to start A1 Discovery for an official archetype."
            actionLabel="Start casting"
            onAction={() => studio.startNewCastingSession()}
          />
        ) : (
          studio.creationProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ps-list-item${studio.selectedProjectId === p.id ? " is-active" : ""}`}
              aria-current={studio.selectedProjectId === p.id ? "true" : undefined}
              onClick={() => void studio.loadProject(p.id)}
            >
              <strong>{p.name || "Untitled cast"}</strong>
              <span>
                {BRAND_ROLE_LABELS[p.brand_role]} · {p.status} · {p.provider_mode}
                {typeof p.candidate_count === "number" ? ` · ${p.candidate_count} Kandidaten` : ""}
              </span>
              {DEBUG_MODE ? (
                <span className="ps-project-id-debug">{projectIdPrefix(p.id)}</span>
              ) : null}
            </button>
          ))
        )}
      </div>

      {detailLoading ? (
        <div className="ps-detail ps-detail-loading">
          <p className="ps-muted">Projekt wird geladen…</p>
          {DEBUG_MODE && studio.selectedProjectId ? (
            <p className="ps-project-id-debug">{projectIdPrefix(studio.selectedProjectId)}</p>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="ps-detail">
          {generating ? (
            <PersonaGenerationExperience
              active
              candidateCount={selected.candidate_count || 4}
              estimatedSeconds={Math.max(
                90,
                Math.ceil(((selected.candidate_count || 4) * 90) / 2),
              )}
            />
          ) : null}
          {!generating ? (
            <>
          <h2>{selected.name}</h2>
          {DEBUG_MODE ? (
            <p className="ps-project-id-debug">ID {projectIdPrefix(selected.id)}</p>
          ) : null}
          <p className="ps-muted">
            {studio.candidates.length} Kandidaten · Stage {selected.generation_stage} · Status{" "}
            {selected.status} · Provider {selected.provider_mode} · Ist-Kosten{" "}
            {selected.actual_cost.toFixed(2)} €
          </p>
          {countUnattestedPaidJobs(studio.generationJobs) > 0 ? (
            <div className="ps-callout ps-callout-warn">
              <p>
                <strong>Debug-Lauf erkannt:</strong>{" "}
                {countUnattestedPaidJobs(studio.generationJobs)} Provider-Lauf/Läufe ohne
                UI-Bestätigung ({countUnattestedPaidJobs(studio.generationJobs)} × geschätzte
                Kosten). Tatsächlicher OpenAI-Aufruf erfolgte — nicht über normale
                Persona-Studio-Bestätigung freigegeben. Kandidaten aus diesen Läufen sind nicht
                für Brand-Cast-Shortlist oder -Konvertierung vorgesehen.
              </p>
            </div>
          ) : selected.actual_cost > 0 ? (
            <div className="ps-callout ps-callout-warn">
              <p>
                <strong>Hinweis:</strong> Dieses Projekt enthält Provider-Läufe mit geschätzten
                Kosten ({selected.actual_cost.toFixed(2)} €). Prüfen Sie, ob alle Läufe über die
                UI bestätigt wurden.
              </p>
            </div>
          ) : null}
          {studio.incidentSummary ? (
            <div className="ps-callout ps-callout-warn">
              <p>
                <strong>Vorfall-Details (Debug-Lauf · nicht über die normale UI bestätigt)</strong>
              </p>
              <ul>
                <li>
                  Provider-Läufe (NexHQ): {studio.incidentSummary.completedProviderRuns}
                </li>
                <li>Bereite Assets: {studio.incidentSummary.readyAssetCount}</li>
                <li>
                  NexHQ geschätzte Kosten: {studio.incidentSummary.estimatedCostEur.toFixed(2)} €
                  (Schätzung — keine bestätigte OpenAI-Abrechnung)
                </li>
                <li>Tatsächliche OpenAI-Abrechnung: unbekannt</li>
                {studio.incidentSummary.firstRunAt ? (
                  <li>Erster Lauf: {studio.incidentSummary.firstRunAt}</li>
                ) : null}
                {studio.incidentSummary.lastRunAt ? (
                  <li>Letzter Lauf: {studio.incidentSummary.lastRunAt}</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <div className="ps-actions">
            <button
              type="button"
              disabled={!canPrepareConfirmation}
              onClick={() => void runEstimate(selected.id)}
            >
              Schätzung & Bestätigung vorbereiten
            </button>
            {DEBUG_MODE && !canPrepareConfirmation ? (
              <div className="ps-callout ps-callout-warn">
                <p>
                  <strong>Warum deaktiviert?</strong>
                </p>
                <ul>
                  <li>
                    Projekt geladen:{" "}
                    {prepareConfirmationGate.reasons.projectLoaded ? "true" : "false"}
                  </li>
                  <li>
                    Status erlaubt:{" "}
                    {prepareConfirmationGate.reasons.statusAllowed ? "true" : "false"}
                  </li>
                  <li>
                    Provider erlaubt:{" "}
                    {prepareConfirmationGate.reasons.providerAllowed ? "true" : "false"}
                  </li>
                  <li>
                    Bezahlte Generierung aktiv:{" "}
                    {prepareConfirmationGate.reasons.paidGenerationEnabled ? "true" : "false"}
                  </li>
                  <li>
                    OpenAI konfiguriert:{" "}
                    {prepareConfirmationGate.reasons.openaiConfigured ? "true" : "false"}
                  </li>
                  <li>
                    Health geladen:{" "}
                    {prepareConfirmationGate.reasons.healthLoaded ? "true" : "false"}
                  </li>
                  <li>Busy: {prepareConfirmationGate.reasons.busy ? "true" : "false"}</li>
                  <li>
                    Workflow erlaubt:{" "}
                    {prepareConfirmationGate.reasons.workflowAllowed ? "true" : "false"}
                  </li>
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              disabled={busy || !canPrepareManualSlots(selected)}
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
                {studio.costEstimate.totalImages} · Mode {selected.quality_mode}
              </p>
              <p>
                Min {studio.costEstimate.estimatedMin.toFixed(2)} € · Max{" "}
                {studio.costEstimate.estimatedMax.toFixed(2)} € · Ø{" "}
                {studio.costEstimate.estimatedTotal.toFixed(2)} €
              </p>
              <p className="ps-muted">
                {studio.costEstimate.note} — Werte sind Schätzungen, keine finalen Kosten.
              </p>
              {studio.paidConfirmationToken &&
              studio.paidConfirmationProjectId === selected.id ? (
                <p className="ps-muted">Bestätigungstoken bereit · explizite Bestätigung erforderlich</p>
              ) : null}
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
                disabled={!canStartGeneration}
                onClick={() => void runGenerate(selected.id)}
              >
                Generierung starten
              </button>
              {!paidGenerationEnabled ? (
                <p className="ps-muted">
                  Kostenpflichtige Generierung ist derzeit gesperrt.
                </p>
              ) : null}
            </div>
          ) : null}
          {process.env.NODE_ENV !== "production" ? (
            <FaceNoveltyLiveCheckPanel
              projectId={selected.id}
              archetypeId={selected.brand_role || undefined}
              candidates={
                studio.projectCandidateState?.projectId === selected.id
                  ? studio.projectCandidateState.candidates
                  : []
              }
            />
          ) : null}
          {error ? <p className="ps-error-inline">{error}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function CandidatesView({ studio }: { studio: PersonaStudioController }) {
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [noveltyConfirmCost, setNoveltyConfirmCost] = useState(false);
  const [noveltyPrepare, setNoveltyPrepare] = useState<{
    candidateId: string;
    slot: string;
    previousAttemptNumber: number;
    nextAttemptNumber: number;
    maxAttempts: number;
    reason: string;
    jobId?: string | null;
  } | null>(null);
  const [replacementFlow, setReplacementFlow] = useState<{
    candidateId: string;
    slot: string;
    phase: "idle" | "confirming" | "generating" | "polling";
    attemptNumber: number;
    maxAttempts: number;
    /** Epoch ms of local monotonic start — never project/job created_at alone. */
    providerStartedAtMs: number | null;
    jobId?: string | null;
    newCandidateId?: string | null;
    stageLabel?: string;
    providerMayHaveCompleted?: boolean;
    safeError?: string | null;
  } | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState("Waiting to start");
  const [staleRecoveryMessage, setStaleRecoveryMessage] = useState<string | null>(
    null,
  );
  const [debugReplacement, setDebugReplacement] = useState<Record<
    string,
    string | number | boolean | null
  > | null>(null);
  const confirmInFlightRef = useRef(false);
  const pollControllerRef = useRef<ReturnType<
    typeof createNoveltyReplacementPollController
  > | null>(null);

  const serverActiveReplacements = useMemo(
    () => studio.projectCandidateState?.activeNoveltyReplacements ?? [],
    [studio.projectCandidateState?.activeNoveltyReplacements],
  );

  useEffect(() => {
    if (!replacementFlow) {
      setElapsedDisplay("Waiting to start");
      return;
    }
    if (
      replacementFlow.phase !== "generating" &&
      replacementFlow.phase !== "polling" &&
      replacementFlow.phase !== "confirming"
    ) {
      return;
    }
    const tick = () => {
      const computed = computeReplacementElapsed({
        providerStartedAt:
          replacementFlow.providerStartedAtMs != null
            ? new Date(replacementFlow.providerStartedAtMs).toISOString()
            : null,
      });
      setElapsedDisplay(computed.display);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [replacementFlow]);

  useEffect(() => {
    return () => {
      pollControllerRef.current?.stop();
      pollControllerRef.current = null;
    };
  }, []);

  // Server is source of truth — never restore generating from stale local/job status alone.
  useEffect(() => {
    const active: ActiveNoveltyReplacementDto | null =
      serverActiveReplacements[0] ?? null;

    if (!active) {
      setReplacementFlow((prev) => {
        if (
          prev &&
          !confirmInFlightRef.current &&
          (prev.phase === "polling" || prev.phase === "generating")
        ) {
          return null;
        }
        return prev;
      });
      const staleJob = (studio.generationJobs ?? []).find((j) => {
        const payload = j.confirmation_payload ?? {};
        return (
          (payload.noveltyReplacement === true ||
            payload.intent === "novelty_replacement") &&
          (j.status === "failed" || payload.recoveredFromStaleState === true) &&
          (payload.safeErrorCode === "replacement_job_stale" ||
            j.error_code === "replacement_job_stale")
        );
      });
      if (staleJob && !confirmInFlightRef.current) {
        setStaleRecoveryMessage(REPLACEMENT_JOB_STALE_MESSAGE);
      }
      return;
    }

    if (confirmInFlightRef.current) return;

    const startedMs = active.providerStartedAt
      ? Date.parse(active.providerStartedAt)
      : NaN;
    setReplacementFlow({
      candidateId: active.candidateId,
      slot: active.slot,
      phase: "polling",
      attemptNumber: active.attemptNumber,
      maxAttempts: active.maxAttempts,
      providerStartedAtMs: Number.isFinite(startedMs) ? startedMs : null,
      jobId: active.jobId,
      newCandidateId: active.newCandidateId,
    });
    setElapsedDisplay(active.elapsedDisplay);
    setStaleRecoveryMessage(null);
  }, [serverActiveReplacements, studio.generationJobs]);

  const projectOwnedOk = canRenderProjectCandidates({
    activeCreationProjectId: studio.selectedProjectId,
    projectCandidateState: studio.projectCandidateState,
  });
  const candidatesInSync =
    projectOwnedOk &&
    studio.selectedProjectId != null &&
    studio.loadedProjectId === studio.selectedProjectId;
  const visibleCandidates = useMemo(() => {
    if (!candidatesInSync || !studio.projectCandidateState) return [];
    const runId = studio.activeGenerationRunId;
    return studio.projectCandidateState.candidates.filter((c) => {
      if (c.creation_project_id !== studio.selectedProjectId) return false;
      // Fail-closed: board only renders the current completed generation run.
      if (!runId) return false;
      return c.provider_job_id === runId;
    });
  }, [
    candidatesInSync,
    studio.projectCandidateState,
    studio.selectedProjectId,
    studio.activeGenerationRunId,
  ]);

  const boardIntegrity = useMemo(
    () =>
      validateProjectCandidateBoardState({
        activeCreationProjectId: studio.selectedProjectId,
        stateProjectId: studio.projectCandidateState?.projectId ?? null,
        candidates: visibleCandidates,
        generationRunProjectId:
          studio.generationJobs.find((j) => j.id === studio.activeGenerationRunId)
            ?.creation_project_id ??
          studio.generationJobs.find(
            (j) => j.status === "completed" || j.status === "partially_completed",
          )?.creation_project_id ??
          null,
      }),
    [
      studio.selectedProjectId,
      studio.projectCandidateState?.projectId,
      visibleCandidates,
      studio.generationJobs,
      studio.activeGenerationRunId,
    ],
  );

  const integrityMismatch = !boardIntegrity.ok && visibleCandidates.length > 0;
  const generationSource = useMemo(() => {
    const job =
      studio.generationJobs.find((j) => j.id === studio.activeGenerationRunId) ??
      studio.generationJobs.find(
        (j) => j.status === "completed" || j.status === "partially_completed",
      );
    if (!job) return "none";
    const payload = job.confirmation_payload as
      | { generationSource?: string }
      | undefined;
    if (payload?.generationSource) return payload.generationSource;
    return resolveGenerationSource(job.provider);
  }, [studio.generationJobs, studio.activeGenerationRunId]);
  const rankedBoard = useMemo(
    () => (integrityMismatch ? [] : rankCandidatesForBoard(visibleCandidates)),
    [visibleCandidates, integrityMismatch],
  );
  const selected = useMemo(
    () => visibleCandidates.find((c) => c.id === studio.selectedCandidateId) ?? null,
    [visibleCandidates, studio.selectedCandidateId],
  );
  const selectedIsDebugRun = useMemo(
    () => (selected ? isDebugRunCandidate(selected, studio.generationJobs) : false),
    [selected, studio.generationJobs],
  );
  const diversityWarning = useMemo(
    () => getCandidateDiversityWarning(visibleCandidates),
    [visibleCandidates],
  );
  const selectedIsRecommended = useMemo(
    () =>
      Boolean(
        selected &&
          rankedBoard.find((row) => row.candidate.id === selected.id)
            ?.isRecommendedBrandFace,
      ),
    [selected, rankedBoard],
  );

  useEffect(() => {
    setNotes(selected?.user_notes ?? "");
    setLightboxIndex(null);
  }, [selected?.id, selected?.user_notes]);

  useEffect(() => {
    if (!DEBUG_MODE || !studio.selectedProjectId) return;
    logCandidateRenderForensics(
      "CandidateBoard.render",
      visibleCandidates.map((c) => ({
        activeCreationProjectId: studio.selectedProjectId,
        candidateId: c.id,
        candidateCreationProjectId: c.creation_project_id,
        candidateNumber: c.candidate_number,
        assetId: c.primary_preview_asset_id,
        assetCreationProjectId: studio.projectCandidateState?.projectId ?? null,
        assetStoragePath: null,
        assetPublicUrl: resolvePreviewUrlForCandidate({
          projectId: studio.selectedProjectId!,
          candidate: c,
          previews: studio.candidatePreviews,
        }),
        createdAt: c.created_at,
        generationJobId: studio.activeGenerationRunId ?? c.provider_job_id,
        generationSource,
      })),
    );
  }, [
    visibleCandidates,
    studio.selectedProjectId,
    studio.projectCandidateState?.projectId,
    studio.candidatePreviews,
    studio.activeGenerationRunId,
    generationSource,
  ]);

  const failureSlots = useMemo(
    () => studio.projectCandidateState?.noveltyFailureSlots ?? [],
    [studio.projectCandidateState?.noveltyFailureSlots],
  );

  const debugPayload = useMemo(
    () => {
      const activeJob =
        studio.generationJobs.find((j) => j.id === studio.activeGenerationRunId) ??
        null;
      const payload = {
        ACTIVE_PROJECT: studio.selectedProjectId,
        LOADED_STATE_PROJECT: studio.projectCandidateState?.projectId ?? null,
        CANDIDATE_COUNT: visibleCandidates.length,
        CANDIDATE_IDS: visibleCandidates.map((c) => c.id),
        ASSET_IDS: visibleCandidates.map((c) => c.primary_preview_asset_id),
        // Never include signed storage URLs in copied debug.
        ASSET_PATHS: visibleCandidates.map((c) =>
          redactAssetPathForDebug(
            // Prefer asset id + redacted key hint — never preview signed URL.
            c.primary_preview_asset_id
              ? `asset:${c.primary_preview_asset_id}`
              : null,
          ),
        ),
        FAILURE_SLOTS: failureSlots.map((s) => ({
          slot: s.slot,
          candidateId: s.candidateId,
          status: s.status,
          reason: s.reason,
        })),
        GENERATION_RUN_ID: studio.activeGenerationRunId,
        GENERATION_SOURCE: generationSource,
        GENERATION_STARTED_AT: activeJob?.started_at ?? null,
        CANDIDATES_CREATED_AT: visibleCandidates.map((c) => c.created_at),
        PROVIDER_JOB_IDS: visibleCandidates.map((c) => c.provider_job_id),
      };
      assertNoSignedUrlLeakage(JSON.stringify(payload));
      return payload;
    },
    [
      studio.selectedProjectId,
      studio.projectCandidateState?.projectId,
      visibleCandidates,
      failureSlots,
      studio.generationJobs,
      studio.activeGenerationRunId,
      generationSource,
    ],
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

  const copyDebug = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
    } catch {
      setError("Could not copy debug data");
    }
  };

  return (
    <section className="ps-panel">
      <header className="ps-panel-header">
        <div>
          <p className="ps-eyebrow">Casting</p>
          <h1>Brand Face Casting</h1>
          <p className="ps-muted">
            Commercial casting analysis — ranked by Brand Face potential, not beauty alone.
            Selection creates a draft persona only, never production approval.
          </p>
        </div>
      </header>

      {process.env.NODE_ENV !== "production" || DEBUG_MODE ? (
        <div className="ps-callout ps-ci-integrity-debug" style={{ marginBottom: "1rem" }}>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", margin: 0 }}>
            {`ACTIVE PROJECT: ${debugPayload.ACTIVE_PROJECT ?? "—"}\n`}
            {`LOADED STATE PROJECT: ${debugPayload.LOADED_STATE_PROJECT ?? "—"}\n`}
            {`CANDIDATE COUNT: ${debugPayload.CANDIDATE_COUNT}\n`}
            {`CANDIDATE IDs: ${(debugPayload.CANDIDATE_IDS as string[]).join(", ") || "—"}\n`}
            {`ASSET IDs: ${(debugPayload.ASSET_IDS as (string | null)[]).join(", ") || "—"}\n`}
            {`ASSET PATHS: ${(debugPayload.ASSET_PATHS as (string | null)[]).join(" | ") || "—"}\n`}
            {`GENERATION RUN ID: ${debugPayload.GENERATION_RUN_ID ?? "—"}\n`}
            {`GENERATION SOURCE: ${debugPayload.GENERATION_SOURCE}\n`}
            {`GENERATION STARTED AT: ${debugPayload.GENERATION_STARTED_AT ?? "—"}\n`}
            {`CANDIDATES CREATED AT: ${(debugPayload.CANDIDATES_CREATED_AT as string[]).join(", ") || "—"}`}
          </pre>
          <button type="button" className="ps-btn-secondary" onClick={() => void copyDebug()}>
            Copy debug data
          </button>
        </div>
      ) : null}

      {studio.projectDetailLoading ? (
        <div className="ps-empty">
          <Loader2 className="size-6 animate-spin" />
          <p>Loading candidates for this project…</p>
        </div>
      ) : null}

      {integrityMismatch ? (
        <div
          className="ps-callout ps-callout-warn"
          style={{ borderColor: "#c0392b", color: "#c0392b" }}
          role="alert"
        >
          <p>
            <strong>Data integrity error</strong> — candidate board blocked. State does not
            match the active creation project.
          </p>
          <pre style={{ fontSize: "12px" }}>{boardIntegrity.reasons.join("\n")}</pre>
        </div>
      ) : null}

      {DEBUG_MODE ? (
        <details className="ps-tech ps-ci-debug-panel">
          <summary>Casting debug (development only)</summary>
          <dl>
            <div>
              <dt>Active creation project</dt>
              <dd>{studio.selectedProjectId ?? "—"}</dd>
            </div>
            <div>
              <dt>Loaded project</dt>
              <dd>{studio.loadedProjectId ?? "—"}</dd>
            </div>
            <div>
              <dt>Cache key</dt>
              <dd>
                {studio.selectedProjectId && studio.health?.workspaceId
                  ? projectScopedCandidatesCacheKey(
                      studio.health.workspaceId,
                      studio.selectedProjectId,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Generation source</dt>
              <dd>{generationSource}</dd>
            </div>
            <div>
              <dt>Candidate IDs</dt>
              <dd>{visibleCandidates.map((c) => c.id).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Provider run</dt>
              <dd>{studio.activeGenerationRunId ?? "—"}</dd>
            </div>
            <div>
              <dt>Created at</dt>
              <dd>
                {visibleCandidates.map((c) => c.created_at).join(", ") || "—"}
              </dd>
            </div>
          </dl>
        </details>
      ) : null}

      {diversityWarning && !integrityMismatch ? (
        <div className="ps-callout ps-callout-warn">
          <p>
            <strong>{diversityWarning}</strong> Consider regenerating with stronger variation
            slots.
          </p>
        </div>
      ) : null}

      {!studio.projectDetailLoading && !integrityMismatch && visibleCandidates.length === 0 && failureSlots.length === 0 ? (
        <EmptyState
          title={
            studio.selectedProjectId
              ? "No candidates exist for this project."
              : "No active casting session."
          }
          body={
            !studio.selectedProjectId
              ? "Click New casting session, then Start New Discovery and confirm paid generation — the board only shows faces from the current generation run."
              : candidatesInSync
                ? "This creation project has no candidates for the current completed generation run. Start a new discovery — never reuse another project's board."
                : "Select a creation project and wait for it to finish loading before viewing candidates."
          }
          actionLabel={
            !studio.selectedProjectId
              ? "Start casting"
              : candidatesInSync
                ? "Open Creation Projects"
                : undefined
          }
          onAction={
            !studio.selectedProjectId
              ? () => studio.startNewCastingSession()
              : candidatesInSync
                ? () => studio.setSection("creation_projects")
                : undefined
          }
        />
      ) : null}

      {error ? (
        <div className="ps-callout ps-callout-warn" role="alert" style={{ marginBottom: "1rem" }}>
          <p>
            <strong>Generate New Face error</strong>
          </p>
          <p>{error}</p>
        </div>
      ) : null}
      {staleRecoveryMessage ? (
        <div className="ps-callout ps-callout-warn" role="status" style={{ marginBottom: "1rem" }}>
          <p>
            <strong>Previous generation stopped unexpectedly.</strong>
          </p>
          <p>{staleRecoveryMessage}</p>
          <p className="ps-muted" style={{ fontSize: "12px" }}>
            Code: replacement_job_stale — prepare a fresh Generate New Face confirmation to retry.
          </p>
        </div>
      ) : null}
      {resultMessage ? (
        <div className="ps-callout" role="status" style={{ marginBottom: "1rem" }}>
          <p>{resultMessage}</p>
        </div>
      ) : null}

      {replacementFlow &&
      (studio.projectDetailLoading ||
        !failureSlots.some(
          (s) =>
            s.candidateId === replacementFlow.candidateId ||
            (["A", "B", "C", "D"][s.slot - 1] ?? "") === replacementFlow.slot,
        )) ? (
        <div className="ps-ci-grid" style={{ marginBottom: "1rem" }}>
          <NoveltyFailureSlotCard
            slot={{
              slot:
                replacementFlow.slot === "A"
                  ? 1
                  : replacementFlow.slot === "B"
                    ? 2
                    : replacementFlow.slot === "C"
                      ? 3
                      : 4,
              candidateId: replacementFlow.candidateId,
              status: "novelty_blocked",
              reason: "Generating new face…",
              requiresReplacementConfirmation: false,
              attemptNumber: replacementFlow.attemptNumber,
              maxAttempts: replacementFlow.maxAttempts,
            }}
            replacementUi={{
              phase: replacementFlow.phase,
              attemptNumber: replacementFlow.attemptNumber,
              maxAttempts: replacementFlow.maxAttempts,
              elapsedDisplay,
              stageLabel:
                replacementFlow.stageLabel ??
                stageLabelForCheckpoint("provider_request_started"),
              providerMayHaveCompleted:
                replacementFlow.providerMayHaveCompleted,
              safeError: replacementFlow.safeError ?? null,
            }}
          />
        </div>
      ) : null}

      {!studio.projectDetailLoading && !integrityMismatch && failureSlots.length > 0 ? (
        <div className="ps-ci-grid" style={{ marginBottom: "1rem" }}>
          {failureSlots.map((slot) => {
            const slotLabel =
              ["A", "B", "C", "D"][slot.slot - 1] ?? String(slot.slot);
            const flowForSlot =
              replacementFlow &&
              (replacementFlow.candidateId === slot.candidateId ||
                replacementFlow.slot === slotLabel)
                ? replacementFlow
                : null;
            return (
            <NoveltyFailureSlotCard
              key={slot.candidateId}
              slot={slot}
              replacementUi={
                flowForSlot
                  ? {
                      phase: flowForSlot.phase,
                      attemptNumber: flowForSlot.attemptNumber,
                      maxAttempts: flowForSlot.maxAttempts,
                      elapsedDisplay,
                      stageLabel:
                        flowForSlot.stageLabel ??
                        stageLabelForCheckpoint("provider_request_started"),
                      providerMayHaveCompleted:
                        flowForSlot.providerMayHaveCompleted,
                      safeError: flowForSlot.safeError ?? null,
                    }
                  : null
              }
              onGenerateNewFace={
                slot.requiresReplacementConfirmation && studio.selectedProjectId
                  ? async () => {
                      setError(null);
                      setResultMessage(null);
                      setNoveltyConfirmCost(false);
                      try {
                        const prepared = await studio.prepareNoveltyReplacement(
                          studio.selectedProjectId!,
                          slot.candidateId,
                        );
                        setNoveltyPrepare({
                          candidateId: slot.candidateId,
                          slot: prepared.slot ?? slotLabel,
                          previousAttemptNumber:
                            prepared.previousAttemptNumber ??
                            slot.attemptNumber ??
                            1,
                          nextAttemptNumber:
                            prepared.nextAttemptNumber ??
                            slot.nextAttemptNumber ??
                            2,
                          maxAttempts: prepared.maxAttempts ?? 4,
                          reason:
                            prepared.reason ?? "face_similarity_duplicate",
                          jobId:
                            (prepared as { job?: { id?: string } }).job?.id ??
                            null,
                        });
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Generate New Face prepare failed",
                        );
                        setNoveltyPrepare(null);
                      }
                    }
                  : undefined
              }
              onRetryEvaluation={
                slot.status === "novelty_failed" &&
                process.env.NODE_ENV !== "production"
                  ? async () => {
                      setError(null);
                      try {
                        const res = await fetch(
                          `/api/persona/creation-projects/${studio.selectedProjectId}/novelty-debug`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "retry_evaluation",
                              candidateId: slot.candidateId,
                            }),
                          },
                        );
                        const data = (await res.json()) as { error?: string };
                        if (!res.ok)
                          throw new Error(data.error ?? "Retry evaluation failed");
                        if (studio.selectedProjectId) {
                          await studio.loadProject(studio.selectedProjectId, {
                            openCandidates: true,
                          });
                        }
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Retry failed");
                      }
                    }
                  : undefined
              }
            />
            );
          })}
        </div>
      ) : null}

      {noveltyPrepare && studio.costEstimate && !replacementFlow ? (
        <div className="ps-callout" style={{ marginBottom: "1rem" }}>
          <p>
            <strong>Generate New Face — Slot {noveltyPrepare.slot}</strong>
          </p>
          <p className="ps-muted" style={{ fontSize: "13px" }}>
            Current attempt {noveltyPrepare.previousAttemptNumber} → next attempt{" "}
            {noveltyPrepare.nextAttemptNumber} of {noveltyPrepare.maxAttempts}
          </p>
          <p className="ps-muted" style={{ fontSize: "13px" }}>
            Reason: {noveltyPrepare.reason}
          </p>
          <p className="ps-muted" style={{ fontSize: "13px" }}>
            Estimated single-image cost: €
            {studio.costEstimate.estimatedMin.toFixed(2)}–€
            {studio.costEstimate.estimatedMax.toFixed(2)}
          </p>
          <label
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginTop: "0.75rem",
            }}
          >
            <input
              type="checkbox"
              checked={noveltyConfirmCost}
              disabled={confirmInFlightRef.current}
              onChange={(e) => setNoveltyConfirmCost(e.target.checked)}
            />
            I confirm paid generation for this single blocked slot only.
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="ps-btn"
              disabled={
                !noveltyConfirmCost ||
                confirmInFlightRef.current ||
                !studio.paidConfirmationToken ||
                studio.paidConfirmationProjectId !== studio.selectedProjectId
              }
              onClick={() => {
                if (!studio.selectedProjectId || !studio.paidConfirmationToken) {
                  setError("Confirmation token missing — prepare again.");
                  return;
                }
                if (!noveltyConfirmCost) {
                  setError("Please confirm the cost checkbox.");
                  return;
                }
                if (confirmInFlightRef.current) return;
                if (pollControllerRef.current?.isRunning()) return;
                confirmInFlightRef.current = true;
                const prepareSnapshot = noveltyPrepare;
                if (!prepareSnapshot) {
                  confirmInFlightRef.current = false;
                  setError("Prepare Generate New Face again.");
                  return;
                }
                const token = studio.paidConfirmationToken;
                const projectId = studio.selectedProjectId;
                const flowStartedAtMs = Date.now();
                type ConfirmResult = {
                  status?: string;
                  newCandidateId?: string;
                  replacementJobId?: string;
                  attemptNumber?: number;
                  maxAttempts?: number;
                  noveltyDecision?: string | null;
                  providerStarted?: boolean;
                  providerCompleted?: boolean;
                  durationMs?: number;
                  slot?: string;
                  safeErrorMessage?: string;
                };
                let jobId = prepareSnapshot.jobId ?? null;
                let confirmResult: ConfirmResult | null = null;
                let confirmFailedMessage: string | null = null;

                setError(null);
                setResultMessage(null);
                setReplacementFlow({
                  candidateId: prepareSnapshot.candidateId,
                  slot: prepareSnapshot.slot,
                  phase: "generating",
                  attemptNumber: prepareSnapshot.nextAttemptNumber,
                  maxAttempts: prepareSnapshot.maxAttempts,
                  providerStartedAtMs: flowStartedAtMs,
                  jobId,
                  stageLabel: stageLabelForCheckpoint("provider_request_started"),
                });
                setNoveltyPrepare(null);
                setNoveltyConfirmCost(false);

                const readStatus = async () => {
                  const q = jobId
                    ? `?novelty_replacement_status=1&jobId=${encodeURIComponent(jobId)}`
                    : `?novelty_replacement_status=1`;
                  const res = await fetch(
                    `/api/persona/creation-projects/${projectId}${q}`,
                    { cache: "no-store" },
                  );
                  const data = (await res.json()) as {
                    status?: string | null;
                    currentStage?: string | null;
                    stageLabel?: string | null;
                    candidateId?: string | null;
                    noveltyDecision?: string | null;
                    finalCandidateStatus?: string | null;
                    safeErrorCode?: string | null;
                    safeErrorMessage?: string | null;
                    providerCompletedAt?: string | null;
                    providerMayHaveCompleted?: boolean;
                    jobId?: string | null;
                  };
                  if (data.jobId) jobId = data.jobId;
                  const terminalStatuses = new Set([
                    "completed",
                    "failed",
                    "cancelled",
                    "partially_completed",
                  ]);
                  const terminal =
                    Boolean(confirmResult?.status) ||
                    Boolean(confirmFailedMessage) ||
                    (typeof data.status === "string" &&
                      terminalStatuses.has(data.status)) ||
                    Boolean(data.finalCandidateStatus) ||
                    Boolean(data.safeErrorCode);
                  if (
                    data.safeErrorCode === "provider_generation_timeout" ||
                    data.safeErrorMessage?.includes("did not finish within")
                  ) {
                    setError("Image generation timed out.");
                    setReplacementFlow((prev) =>
                      prev
                        ? {
                            ...prev,
                            phase: "idle",
                            stageLabel: "Image generation timed out",
                            safeError: "provider_generation_timeout",
                            providerMayHaveCompleted:
                              data.providerMayHaveCompleted === true,
                          }
                        : prev,
                    );
                    return {
                      terminal: true,
                      serverState: "provider_generation_timeout",
                    };
                  }
                  setReplacementFlow((prev) =>
                    prev
                      ? {
                          ...prev,
                          phase: "polling",
                          jobId: jobId ?? prev.jobId,
                          newCandidateId:
                            data.candidateId ?? prev.newCandidateId,
                          stageLabel:
                            data.stageLabel ??
                            stageLabelForCheckpoint(data.currentStage) ??
                            prev.stageLabel,
                          providerMayHaveCompleted:
                            data.providerMayHaveCompleted === true ||
                            Boolean(data.providerCompletedAt),
                        }
                      : prev,
                  );
                  return {
                    terminal,
                    serverState:
                      data.status ??
                      data.currentStage ??
                      data.finalCandidateStatus ??
                      "generating",
                  };
                };

                const controller = createNoveltyReplacementPollController({
                  intervalMs: NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
                  timeoutMs: NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
                  now: () => Date.now(),
                  poll: readStatus,
                  reconcile: async () => {
                    const res = await fetch(
                      `/api/persona/creation-projects/${projectId}`,
                      {
                        method: "PATCH",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "reconcile_novelty_replacement",
                          jobId,
                        }),
                      },
                    );
                    const data = (await res.json()) as {
                      job?: { status?: string | null };
                      status?: { status?: string | null };
                    };
                    await studio.loadProject(projectId, {
                      openCandidates: true,
                    });
                    return {
                      serverState:
                        data.status?.status ??
                        data.job?.status ??
                        "generating",
                    };
                  },
                  onTimeoutMessage: (serverState) => {
                    setError(
                      formatNoveltyReplacementTimeoutMessage(serverState),
                    );
                  },
                });
                pollControllerRef.current = controller;

                void (async () => {
                  try {
                    const confirmPromise = studio
                      .confirmNoveltyReplacement(projectId, {
                        candidateId: prepareSnapshot.candidateId,
                        costConfirmed: true,
                        confirmationToken: token,
                        userConfirmedAt: new Date().toISOString(),
                      })
                      .then((result) => {
                        confirmResult = result;
                        if (result.replacementJobId) {
                          jobId = result.replacementJobId;
                        }
                        setDebugReplacement({
                          replacementJobId: result.replacementJobId ?? null,
                          slot: result.slot ?? prepareSnapshot.slot,
                          attempt:
                            result.attemptNumber ??
                            prepareSnapshot.nextAttemptNumber,
                          state: result.status ?? null,
                          providerStarted: result.providerStarted ?? null,
                          providerCompleted: result.providerCompleted ?? null,
                          candidateId: result.newCandidateId ?? null,
                          noveltyDecision: result.noveltyDecision ?? null,
                          durationMs:
                            result.durationMs ?? Date.now() - flowStartedAtMs,
                          safeError: null,
                        });
                        controller.stop();
                        return result;
                      })
                      .catch((e: unknown) => {
                        confirmFailedMessage =
                          e instanceof Error
                            ? e.message
                            : "Generate New Face failed";
                        setDebugReplacement((prev) => ({
                          ...(prev ?? {}),
                          state: "failed",
                          safeError: confirmFailedMessage,
                          durationMs: Date.now() - flowStartedAtMs,
                        }));
                        controller.stop();
                        throw e;
                      });

                    const pollOutcome = await controller.start();
                    // Prefer confirm outcome when it already finished.
                    let resolvedConfirm: ConfirmResult | null = confirmResult;
                    try {
                      resolvedConfirm = (await confirmPromise) as ConfirmResult;
                      confirmResult = resolvedConfirm;
                    } catch {
                      // confirmFailedMessage already set
                    }

                    if (confirmFailedMessage) {
                      const timedOut =
                        /did not finish within the allowed time|provider_generation_timeout/i.test(
                          confirmFailedMessage,
                        );
                      setError(
                        timedOut
                          ? "Image generation timed out."
                          : confirmFailedMessage,
                      );
                      if (resolvedConfirm?.providerCompleted) {
                        setError(
                          `${confirmFailedMessage} Provider may already have completed — do not retry without a fresh confirmation.`,
                        );
                      }
                    } else if (resolvedConfirm?.status === "allowed") {
                      setResultMessage(outcomeMessage("allowed"));
                      await studio.loadProject(projectId, {
                        openCandidates: true,
                      });
                    } else if (resolvedConfirm?.status === "blocked") {
                      setResultMessage(
                        `${outcomeMessage("blocked")} Attempt ${resolvedConfirm.attemptNumber} of ${resolvedConfirm.maxAttempts ?? 4}.`,
                      );
                      await studio.loadProject(projectId, {
                        openCandidates: true,
                      });
                    } else if (resolvedConfirm?.status === "exhausted") {
                      setResultMessage(outcomeMessage("exhausted"));
                      await studio.loadProject(projectId, {
                        openCandidates: true,
                      });
                    } else if (pollOutcome === "timeout") {
                      // error already set by onTimeoutMessage
                    } else {
                      await studio.loadProject(projectId, {
                        openCandidates: true,
                      });
                    }
                  } catch (e) {
                    const message =
                      e instanceof Error
                        ? e.message
                        : "Generate New Face failed";
                    setError(message);
                    try {
                      await studio.loadProject(projectId, {
                        openCandidates: true,
                      });
                    } catch {
                      // keep error from confirm
                    }
                  } finally {
                    controller.stop();
                    if (pollControllerRef.current === controller) {
                      pollControllerRef.current = null;
                    }
                    confirmInFlightRef.current = false;
                    setReplacementFlow(null);
                  }
                })();
              }}
            >
              Confirm Generate New Face
            </button>
            <button
              type="button"
              className="ps-btn"
              disabled={confirmInFlightRef.current}
              onClick={() => {
                setNoveltyPrepare(null);
                setNoveltyConfirmCost(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {DEBUG_MODE && (debugReplacement || replacementFlow) ? (
        <details className="ps-tech" style={{ marginBottom: "1rem" }}>
          <summary>Novelty replacement debug</summary>
          <pre style={{ fontSize: "12px" }}>
            {JSON.stringify(
              {
                ...debugReplacement,
                phase: replacementFlow?.phase ?? null,
                elapsedDisplay,
                pollIntervalMs: NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
                pollTimeoutMs: NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
              },
              null,
              2,
            )}
          </pre>
        </details>
      ) : null}

      {!studio.projectDetailLoading && !integrityMismatch && rankedBoard.length > 0 ? (
        <div className="ps-ci-grid">
          {rankedBoard.map(({ candidate: c, isRecommendedBrandFace }) => (
            <CandidateBoardCard
              key={c.id}
              candidate={c}
              previewUrl={
                studio.selectedProjectId
                  ? resolvePreviewUrlForCandidate({
                      projectId: studio.selectedProjectId,
                      candidate: c,
                      previews: studio.candidatePreviews,
                    })
                  : null
              }
              active={studio.selectedCandidateId === c.id}
              isRecommendedBrandFace={isRecommendedBrandFace}
              primaryLabel={discoverySlotLabel(c.candidate_number)}
              secondaryLabel={getCandidateVariationLabel(c)}
              onSelect={() => void studio.loadCandidate(c.id)}
            />
          ))}
        </div>
      ) : null}

      {selected && !integrityMismatch ? (
        <div className="ps-detail ps-ci-detail">
          <div className="ps-ci-detail-header">
            <div>
              <h2>
                {discoverySlotLabel(selected.candidate_number)}
              </h2>
              <p className="ps-muted">
                {getCandidateVariationLabel(selected)} · {selected.identity_summary}
              </p>
              {selectedIsRecommended ? (
                <p className="ps-ci-detail-recommended">★ Recommended Brand Face</p>
              ) : null}
            </div>
            <CandidateStatusBadge candidate={selected} />
          </div>
          {selectedIsDebugRun ? (
            <div className="ps-callout ps-callout-warn">
              <p>
                Tatsächlicher Provider-Aufruf (OpenAI) — Kosten geschätzt, nicht über normale
                UI-Bestätigung freigegeben. Shortlist, Auswahl und Konvertierung sind für diesen
                Kandidaten gesperrt.
              </p>
            </div>
          ) : null}
          <p className="ps-muted">{selected.distinguishing_features}</p>

          <CandidateDetailGallery
            assets={studio.candidateAssets}
            onOpen={(index) => setLightboxIndex(index)}
          />

          <CandidateQualityPanel candidate={selected} />

          <CandidateComparePanel candidate={selected} peers={visibleCandidates} />

          <details className="ps-tech">
            <summary>Technische Details</summary>
            <pre>{JSON.stringify({
              provider: selected.provider,
              job: selected.provider_job_id,
              seed: selected.generation_seed,
              variation: selected.generation_settings?.variation ?? null,
              cost: selected.actual_generation_cost,
              created: selected.created_at,
            }, null, 2)}</pre>
          </details>

          <CandidateNotesPanel
            candidate={selected}
            notes={notes}
            onNotesChange={setNotes}
            onSave={() => void act({ user_notes: notes })}
          />

          <div className="ps-actions">
            <button
              type="button"
              disabled={selectedIsDebugRun}
              title={
                selectedIsDebugRun
                  ? "Debug-Lauf ohne UI-Bestätigung — nicht für Brand Cast"
                  : undefined
              }
              onClick={() => void act({ status: "shortlisted" })}
            >
              Shortlist
            </button>
            <button
              type="button"
              onClick={() =>
                void studio.patchCandidate(selected.id, { action: "stage_b_package" }).catch((e: Error) =>
                  setError(e.message),
                )
              }
            >
              Stage B / Referenzpaket
            </button>
            <button
              type="button"
              onClick={() =>
                void act({ status: "rejected", rejection_reason: notes || "Ungeeignet" })
              }
            >
              Ablehnen
            </button>
            <button
              type="button"
              disabled={selectedIsDebugRun}
              title={
                selectedIsDebugRun
                  ? "Debug-Lauf ohne UI-Bestätigung — nicht für Brand Cast"
                  : undefined
              }
              onClick={() => void act({ status: "selected" })}
            >
              Auswählen
            </button>
            <button
              type="button"
              disabled={selectedIsDebugRun}
              title={
                selectedIsDebugRun
                  ? "Debug-Lauf ohne UI-Bestätigung — nicht für Brand Cast"
                  : undefined
              }
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

      {lightboxIndex != null ? (
        <CandidateLightbox
          assets={studio.candidateAssets}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}
