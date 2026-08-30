"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Layers3, Plus, X } from "lucide-react";

import {
  CREATIVE_LABELS,
  creativeCameraAngleSchema,
  creativeCameraFramingSchema,
  creativeCompositionSchema,
  creativeLightingSchema,
  creativeLocationTypeSchema,
  creativeMoodSchema,
  creativePresetsForShot,
  creativeSceneTypeSchema,
  createCreativeDirection,
  createSocialVariationPlan,
  suggestControlledVariations,
  updateCreativeDirection,
  type ImageContentMode,
  type SocialCreativeDirectionV1,
} from "@/lib/image/social-creative-direction";
import { contentShotById } from "@/lib/image/content-packs";

const CAMERA_ANGLE_LABELS = {
  EYE_LEVEL: "Augenhöhe",
  LOW_ANGLE: "Untersicht",
  HIGH_ANGLE: "Aufsicht",
  OVERHEAD: "Draufsicht",
  THREE_QUARTER: "Dreiviertel-Winkel",
} as const;

function SelectField(props: {
  label: string;
  value: string;
  options: readonly string[];
  labels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="is-creative-field">
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.labels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SocialCreativeDirectionSelector(props: {
  shotId: string | null;
  contentMode: ImageContentMode;
  direction: SocialCreativeDirectionV1 | null;
  onDirectionChange: (direction: SocialCreativeDirectionV1) => void;
}) {
  const { shotId, contentMode, direction, onDirectionChange } = props;
  const [planned, setPlanned] = useState<SocialCreativeDirectionV1[]>([]);
  const shot = shotId ? contentShotById(shotId) : null;
  const compatiblePresets = useMemo(
    () =>
      shotId
        ? creativePresetsForShot(shotId, contentMode)
        : [],
    [contentMode, shotId],
  );

  useEffect(() => {
    setPlanned([]);
  }, [contentMode, shotId]);

  const plan = shotId
    ? createSocialVariationPlan(shotId, planned)
    : null;
  const suggestions = shotId
    ? suggestControlledVariations({
        shotId: shotId,
        recent: planned,
        limit: 5,
      })
    : [];

  if (!shotId || !shot || !direction) {
    return (
      <section className="nx-card is-creative-direction">
        <p className="nx-notice nx-notice--info">
          Wähle zuerst eine Aufnahme. Danach kannst du Szene, Licht, Kamera und
          Stimmung festlegen.
        </p>
      </section>
    );
  }

  const update = (patch: Parameters<typeof updateCreativeDirection>[1]) =>
    onDirectionChange(updateCreativeDirection(direction, patch));

  return (
    <section
      className="nx-card is-creative-direction"
      aria-labelledby="creative-direction-heading"
    >
      <div className="is-v2-section-head">
        <div>
          <p className="nx-page-header__eyebrow">
            {contentMode === "SOCIAL_CONTENT"
              ? "Social Content"
              : "Shopify Mockup"}
          </p>
          <h3 id="creative-direction-heading">Stil wählen</h3>
          <p>
            {contentMode === "SOCIAL_CONTENT"
              ? "Ein Preset setzt Szene, Licht, Kamera und Stimmung passend für dich."
              : "Shopify Standard hält deine Produktbilder bewusst sauber und konsistent."}
          </p>
        </div>
      </div>

      <div className="is-creative-preset-grid" role="radiogroup" aria-label="Kreativ-Preset">
        {compatiblePresets.map((preset) => {
          const selected = direction.presetId === preset.id;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              key={preset.id}
              className={selected ? "is-selected" : ""}
              onClick={() =>
                onDirectionChange(
                  createCreativeDirection({
                    shotId: shotId!,
                    contentMode: contentMode,
                    presetId: preset.id,
                    source: "OWNER_SELECTED",
                  }),
                )
              }
            >
              {selected ? <CheckCircle2 className="size-4" /> : null}
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
              {selected ? <em>Ausgewählt</em> : null}
            </button>
          );
        })}
      </div>

      <details className="nx-technical is-creative-adjustments">
        <summary>Stil anpassen</summary>
        <div className="nx-technical__body is-creative-field-grid">
          <SelectField
            label="Szene"
            value={direction.sceneType}
            options={creativeSceneTypeSchema.options}
            labels={CREATIVE_LABELS.scene}
            onChange={(value) => update({ sceneType: value as SocialCreativeDirectionV1["sceneType"] })}
          />
          <SelectField
            label="Ort"
            value={direction.locationType}
            options={creativeLocationTypeSchema.options}
            labels={CREATIVE_LABELS.location}
            onChange={(value) => update({ locationType: value as SocialCreativeDirectionV1["locationType"] })}
          />
          <SelectField
            label="Licht"
            value={direction.lighting}
            options={creativeLightingSchema.options}
            labels={CREATIVE_LABELS.lighting}
            onChange={(value) => update({ lighting: value as SocialCreativeDirectionV1["lighting"] })}
          />
          <SelectField
            label="Kamera"
            value={direction.camera.framing}
            options={creativeCameraFramingSchema.options}
            labels={CREATIVE_LABELS.cameraFraming}
            onChange={(value) =>
              update({
                camera: {
                  ...direction.camera,
                  framing: value as SocialCreativeDirectionV1["camera"]["framing"],
                },
              })
            }
          />
          <SelectField
            label="Kamerawinkel"
            value={direction.camera.angle}
            options={creativeCameraAngleSchema.options}
            labels={CAMERA_ANGLE_LABELS}
            onChange={(value) =>
              update({
                camera: {
                  ...direction.camera,
                  angle: value as SocialCreativeDirectionV1["camera"]["angle"],
                },
              })
            }
          />
          <SelectField
            label="Komposition"
            value={direction.composition}
            options={creativeCompositionSchema.options}
            labels={CREATIVE_LABELS.composition}
            onChange={(value) => update({ composition: value as SocialCreativeDirectionV1["composition"] })}
          />
          <SelectField
            label="Stimmung"
            value={direction.mood}
            options={creativeMoodSchema.options}
            labels={CREATIVE_LABELS.mood}
            onChange={(value) => update({ mood: value as SocialCreativeDirectionV1["mood"] })}
          />
          <label className="is-creative-field is-creative-field--wide">
            <span>Eigene Ergänzung</span>
            <textarea
              value={direction.customDirection ?? ""}
              maxLength={600}
              rows={2}
              placeholder="Optional – keine Änderung an Produkt oder Artwork"
              onChange={(event) =>
                update({ customDirection: event.target.value.trim() || null })
              }
            />
          </label>
        </div>
      </details>

      {contentMode === "SOCIAL_CONTENT" ? (
        <details className="nx-technical is-variation-plan">
          <summary>
            <Layers3 className="size-4" /> Social Vielfalt planen
          </summary>
          <div className="nx-technical__body">
            <p>
              Varianten sind nur eine Merkliste. Es werden keine Aufträge
              vorbereitet oder automatisch gestartet.
            </p>
            <button
              type="button"
              className="nx-button"
              onClick={() =>
                setPlanned((current) =>
                  current.some(
                    (item) =>
                      item.presetId === direction.presetId &&
                      item.sceneType === direction.sceneType &&
                      item.lighting === direction.lighting &&
                      item.camera.framing === direction.camera.framing,
                  )
                    ? current
                    : [...current, direction],
                )
              }
            >
              <Plus className="size-4" /> Aktuelle Variante merken
            </button>
            {plan?.entries.length ? (
              <ul className="is-variation-list">
                {plan.entries.map((item, index) => (
                  <li key={`${item.presetId}-${index}`}>
                    <span>
                      {CREATIVE_LABELS.scene[item.sceneType]} ·{" "}
                      {CREATIVE_LABELS.lighting[item.lighting]} ·{" "}
                      {CREATIVE_LABELS.cameraFraming[item.camera.framing]}
                    </span>
                    <button
                      type="button"
                      aria-label="Geplante Variante entfernen"
                      onClick={() =>
                        setPlanned((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="is-variation-suggestions">
              Vorschläge gegen Wiederholung:{" "}
              {suggestions.map((item) => item.label).join(" · ")}
            </p>
            <strong>0 automatische Aufträge</strong>
          </div>
        </details>
      ) : null}
    </section>
  );
}
