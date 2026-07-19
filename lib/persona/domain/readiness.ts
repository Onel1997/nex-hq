import type {
  Framing,
  Persona,
  PersonaReadinessReport,
  PersonaReadinessState,
  PersonaReferenceAsset,
  ReferenceCompleteness,
  ViewAngle,
} from "./types";

const REQUIRED_PROFILE_FIELDS: Array<keyof Persona> = [
  "name",
  "role",
  "gender",
  "age_range",
  "height",
  "body_type",
  "skin_tone",
  "hair",
  "eye_color",
  "expression",
  "personality",
  "style",
  "visual_identity_notes",
  "prohibited_changes",
  "default_hair_style",
  "default_expression",
  "default_body_proportions",
  "default_styling_notes",
];

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function isProfileComplete(persona: Persona): boolean {
  return REQUIRED_PROFILE_FIELDS.every((field) => {
    const value = persona[field];
    if (typeof value === "string") return nonEmpty(value);
    return value !== null && value !== undefined;
  });
}

function isActiveApproved(asset: PersonaReferenceAsset): boolean {
  return asset.status === "approved" && asset.rights_confirmed;
}

function isPortraitLike(asset: PersonaReferenceAsset): boolean {
  return (
    asset.asset_type === "portrait" ||
    asset.framing === "face" ||
    asset.framing === "head_shoulders"
  );
}

function isBodyLike(asset: PersonaReferenceAsset): boolean {
  return (
    asset.asset_type === "full_body" ||
    asset.asset_type === "three_quarter" ||
    asset.framing === "half_body" ||
    asset.framing === "full_body"
  );
}

export function computeReferenceCompleteness(
  assets: PersonaReferenceAsset[],
): ReferenceCompleteness {
  const approved = assets.filter(isActiveApproved);

  const front_portrait = approved.some(
    (a) =>
      isPortraitLike(a) &&
      (a.view_angle === "front" || a.view_angle === "unknown"),
  );
  const left_profile = approved.some((a) => a.view_angle === "left_profile");
  const right_profile = approved.some((a) => a.view_angle === "right_profile");
  const full_body_front = approved.some(
    (a) => isBodyLike(a) && a.view_angle === "front",
  );
  const full_body_side_or_three_quarter = approved.some(
    (a) =>
      isBodyLike(a) &&
      (a.view_angle === "left_profile" ||
        a.view_angle === "right_profile" ||
        a.view_angle === "three_quarter_left" ||
        a.view_angle === "three_quarter_right"),
  );
  const neutral_expression = approved.some((a) =>
    /neutral|ruhig|calm|composed/i.test(a.expression || ""),
  );
  const optional_video_reference = approved.some(
    (a) => a.asset_type === "video_reference",
  );

  const visually_complete =
    front_portrait &&
    left_profile &&
    right_profile &&
    full_body_front &&
    full_body_side_or_three_quarter &&
    neutral_expression;

  return {
    front_portrait,
    left_profile,
    right_profile,
    full_body_front,
    full_body_side_or_three_quarter,
    neutral_expression,
    optional_video_reference,
    visually_complete,
  };
}

export function findPrimaryApprovedPortrait(
  persona: Persona,
  assets: PersonaReferenceAsset[],
): PersonaReferenceAsset | null {
  if (!persona.primary_reference_asset_id) return null;
  const primary = assets.find((a) => a.id === persona.primary_reference_asset_id);
  if (!primary) return null;
  if (primary.status === "rejected" || primary.status === "archived") return null;
  if (primary.status !== "approved" || !primary.rights_confirmed) return null;
  if (!isPortraitLike(primary)) return null;
  return primary;
}

export function findApprovedBodyReference(
  assets: PersonaReferenceAsset[],
): PersonaReferenceAsset | null {
  return assets.find((a) => isActiveApproved(a) && isBodyLike(a)) ?? null;
}

export function listApprovalPrerequisiteGaps(
  persona: Persona,
  assets: PersonaReferenceAsset[],
): string[] {
  const missing: string[] = [];

  if (!isProfileComplete(persona)) {
    missing.push("profile_incomplete");
  }
  if (!nonEmpty(persona.visual_identity_notes)) {
    missing.push("visual_identity_notes");
  }
  if (!nonEmpty(persona.prohibited_changes)) {
    missing.push("prohibited_changes");
  }
  if (!persona.image_use_approved) {
    missing.push("image_use_approved");
  }

  const primary = findPrimaryApprovedPortrait(persona, assets);
  if (!primary) {
    missing.push("approved_primary_portrait");
  }

  const body = findApprovedBodyReference(assets);
  if (!body) {
    missing.push("approved_body_reference");
  }

  const activeApproved = assets.filter(
    (a) => a.status === "approved" || a.status === "review" || a.status === "uploaded",
  );
  for (const asset of activeApproved) {
    if (asset.status === "approved" && !asset.rights_confirmed) {
      missing.push(`rights_confirmed:${asset.id}`);
    }
  }

  const rejectedPrimary = assets.find(
    (a) => a.id === persona.primary_reference_asset_id && a.status === "rejected",
  );
  if (rejectedPrimary) {
    missing.push("rejected_primary_reference");
  }

  return missing;
}

export function canApprovePersona(
  persona: Persona,
  assets: PersonaReferenceAsset[],
): boolean {
  return listApprovalPrerequisiteGaps(persona, assets).length === 0;
}

export function computePersonaReadiness(
  persona: Persona,
  assets: PersonaReferenceAsset[],
): PersonaReadinessReport {
  if (persona.status === "Archived") {
    return {
      state: "archived",
      states: ["archived"],
      profile_complete: isProfileComplete(persona),
      references_complete: false,
      image_ready: false,
      video_ready: false,
      production_ready: false,
      missing: ["archived"],
      completeness: computeReferenceCompleteness(assets),
    };
  }

  const missing = listApprovalPrerequisiteGaps(persona, assets);
  const profile_complete = isProfileComplete(persona);
  const references_complete =
    !missing.includes("approved_primary_portrait") &&
    !missing.includes("approved_body_reference") &&
    !missing.some((m) => m.startsWith("rights_confirmed:")) &&
    !missing.includes("rejected_primary_reference");

  const baseApproved =
    persona.status === "Approved" &&
    persona.approved &&
    profile_complete &&
    references_complete &&
    Boolean(findPrimaryApprovedPortrait(persona, assets));

  const image_ready = baseApproved && persona.image_use_approved;
  const video_ready =
    baseApproved &&
    persona.video_use_approved &&
    persona.image_use_approved; // video requires image baseline + explicit video flag
  const production_ready = image_ready && video_ready;

  const states: PersonaReadinessState[] = [];
  if (!profile_complete) states.push("profile_incomplete");
  if (!references_complete) states.push("references_incomplete");
  if (image_ready) states.push("image_ready");
  if (video_ready) states.push("video_ready");
  if (production_ready) states.push("production_ready");

  let state: PersonaReadinessState = "profile_incomplete";
  if (production_ready) state = "production_ready";
  else if (video_ready) state = "video_ready";
  else if (image_ready) state = "image_ready";
  else if (!references_complete) state = "references_incomplete";
  else if (!profile_complete) state = "profile_incomplete";

  return {
    state,
    states: states.length > 0 ? states : ["profile_incomplete"],
    profile_complete,
    references_complete,
    image_ready,
    video_ready,
    production_ready,
    missing,
    completeness: computeReferenceCompleteness(assets),
  };
}

export function isValidViewAngle(value: string): value is ViewAngle {
  return (
    value === "front" ||
    value === "left_profile" ||
    value === "right_profile" ||
    value === "back" ||
    value === "three_quarter_left" ||
    value === "three_quarter_right" ||
    value === "unknown"
  );
}

export function isValidFraming(value: string): value is Framing {
  return (
    value === "face" ||
    value === "head_shoulders" ||
    value === "half_body" ||
    value === "full_body" ||
    value === "unknown"
  );
}
