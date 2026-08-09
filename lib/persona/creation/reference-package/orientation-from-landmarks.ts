/**
 * Phase 2.3D.6 — Head orientation from 68 facial landmarks (pure geometry).
 * Image coordinates: x increases to the RIGHT. Nose left of eye-midline → image-left.
 */

export const DETECTED_ORIENTATIONS = [
  "image_left",
  "image_right",
  "frontal",
  "profile_left",
  "profile_right",
  "uncertain",
] as const;

export type DetectedOrientation = (typeof DETECTED_ORIENTATIONS)[number];

export type LandmarkPoint = { x: number; y: number };

export type OrientationEstimate = {
  detected_orientation: DetectedOrientation;
  /** Approximate yaw in degrees. Positive = nose toward image-right. Null if unreliable. */
  detected_yaw_degrees: number | null;
  noseSide: "left" | "right" | "center" | "uncertain";
  bothEyesVisible: boolean;
  /** Signed nose offset normalized by half face-width (−1…+1). */
  noseOffsetNorm: number | null;
  reason: string;
};

function avg(points: LandmarkPoint[]): LandmarkPoint {
  const n = points.length || 1;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function dist(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Estimate head yaw / facing from face-api 68-point landmarks.
 * Indices follow the standard 68-point model:
 *  jaw 0–16, nose bridge 27–30 (tip=30), left eye 36–41, right eye 42–47.
 */
export function estimateOrientationFromLandmarks(input: {
  points: readonly LandmarkPoint[];
  detectionConfidence?: number;
}): OrientationEstimate {
  const points = input.points;
  const confidence = input.detectionConfidence ?? 0;

  if (!points || points.length < 68) {
    return {
      detected_orientation: "uncertain",
      detected_yaw_degrees: null,
      noseSide: "uncertain",
      bothEyesVisible: false,
      noseOffsetNorm: null,
      reason: "Fewer than 68 facial landmarks — cannot estimate orientation.",
    };
  }

  if (confidence > 0 && confidence < 0.35) {
    return {
      detected_orientation: "uncertain",
      detected_yaw_degrees: null,
      noseSide: "uncertain",
      bothEyesVisible: false,
      noseOffsetNorm: null,
      reason: "Face detection confidence too low for orientation.",
    };
  }

  const leftEye = avg(points.slice(36, 42));
  const rightEye = avg(points.slice(42, 48));
  const noseTip = points[30]!;
  const jawLeft = points[0]!;
  const jawRight = points[16]!;
  const eyeMid = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  const faceWidth = dist(jawLeft, jawRight);
  const interOcular = dist(leftEye, rightEye);
  if (!(faceWidth > 1) || !(interOcular > 0.5)) {
    return {
      detected_orientation: "uncertain",
      detected_yaw_degrees: null,
      noseSide: "uncertain",
      bothEyesVisible: false,
      noseOffsetNorm: null,
      reason: "Degenerate face geometry — orientation uncertain.",
    };
  }

  // Positive → nose toward image-right; negative → image-left.
  const noseOffsetNorm = (noseTip.x - eyeMid.x) / (faceWidth / 2);
  const yawDeg = Math.max(-90, Math.min(90, noseOffsetNorm * 90));

  const leftEyeWidth = dist(points[36]!, points[39]!);
  const rightEyeWidth = dist(points[42]!, points[45]!);
  const eyeRatio =
    Math.min(leftEyeWidth, rightEyeWidth) /
    Math.max(leftEyeWidth, rightEyeWidth, 1e-6);
  const bothEyesVisible = eyeRatio >= 0.35 && interOcular / faceWidth >= 0.18;

  // Strong profile: large yaw OR collapsed far-side eye.
  const strongProfile = Math.abs(yawDeg) >= 55 || eyeRatio < 0.28;
  const frontal = Math.abs(yawDeg) <= 12 && bothEyesVisible;

  let noseSide: OrientationEstimate["noseSide"] = "center";
  if (noseOffsetNorm <= -0.06) noseSide = "left";
  else if (noseOffsetNorm >= 0.06) noseSide = "right";

  let detected_orientation: DetectedOrientation;
  if (frontal) {
    detected_orientation = "frontal";
  } else if (strongProfile && noseSide === "left") {
    detected_orientation = "profile_left";
  } else if (strongProfile && noseSide === "right") {
    detected_orientation = "profile_right";
  } else if (noseSide === "left") {
    detected_orientation = "image_left";
  } else if (noseSide === "right") {
    detected_orientation = "image_right";
  } else {
    detected_orientation = "uncertain";
  }

  return {
    detected_orientation,
    detected_yaw_degrees: Number.isFinite(yawDeg) ? Math.round(yawDeg * 10) / 10 : null,
    noseSide,
    bothEyesVisible,
    noseOffsetNorm: Number.isFinite(noseOffsetNorm)
      ? Math.round(noseOffsetNorm * 1000) / 1000
      : null,
    reason: `yaw≈${yawDeg.toFixed(1)}° nose=${noseSide} eyesVisible=${bothEyesVisible}`,
  };
}

/** Build synthetic 68 landmarks for tests (approximate). */
export function buildSyntheticLandmarks68(input: {
  yawToward: "left" | "right" | "center";
  strength: "frontal" | "three_quarter" | "profile";
  faceCenterX?: number;
  faceCenterY?: number;
  faceWidth?: number;
}): LandmarkPoint[] {
  const cx = input.faceCenterX ?? 100;
  const cy = input.faceCenterY ?? 120;
  const w = input.faceWidth ?? 80;
  const yaw =
    input.strength === "frontal"
      ? 0
      : input.strength === "three_quarter"
        ? 0.35
        : 0.75;
  const sign =
    input.yawToward === "center" ? 0 : input.yawToward === "right" ? 1 : -1;
  const noseShift = sign * yaw * (w / 2);

  const points: LandmarkPoint[] = [];
  for (let i = 0; i < 68; i++) points.push({ x: cx, y: cy });

  // Jaw 0–16
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    points[i] = {
      x: cx - w / 2 + t * w + noseShift * 0.15,
      y: cy + 30 + Math.sin(t * Math.PI) * 10,
    };
  }
  // Nose bridge / tip 27–30
  points[27] = { x: cx + noseShift * 0.4, y: cy - 10 };
  points[28] = { x: cx + noseShift * 0.55, y: cy };
  points[29] = { x: cx + noseShift * 0.7, y: cy + 8 };
  points[30] = { x: cx + noseShift, y: cy + 16 }; // tip

  // Eyes — collapse far-side eye for profile
  const leftCollapse =
    input.strength === "profile" && input.yawToward === "right" ? 0.25 : 1;
  const rightCollapse =
    input.strength === "profile" && input.yawToward === "left" ? 0.25 : 1;
  const eyeSpread =
    input.strength === "profile" ? w * 0.12 : w * 0.22;

  for (let i = 36; i <= 41; i++) {
    const t = (i - 36) / 5;
    points[i] = {
      x: cx - eyeSpread + t * 10 * leftCollapse + noseShift * 0.2,
      y: cy - 8 + (i % 2) * 2,
    };
  }
  for (let i = 42; i <= 47; i++) {
    const t = (i - 42) / 5;
    points[i] = {
      x: cx + eyeSpread - 10 + t * 10 * rightCollapse + noseShift * 0.2,
      y: cy - 8 + (i % 2) * 2,
    };
  }

  return points;
}
