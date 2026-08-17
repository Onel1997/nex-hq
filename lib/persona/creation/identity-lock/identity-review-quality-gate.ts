import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewCheckKey,
  type PersonaIdentityReview,
} from "@/lib/persona/domain/creation-types";

/** Video suitability is an independent capability and is not required to lock
 * an otherwise image-valid identity. */
export const IDENTITY_LOCK_REVIEW_CHECK_KEYS = IDENTITY_REVIEW_CHECK_KEYS.filter(
  (key): key is IdentityReviewCheckKey =>
    key !== "suitable_for_video_generation",
);

export type IdentityReviewQualityGate = {
  review: PersonaIdentityReview | null;
  identityLockPassed: boolean;
  imageIdentityReady: boolean;
  videoIdentityReady: boolean;
  blockingReasons: string[];
};

function reviewTime(review: PersonaIdentityReview): number {
  const value = review.reviewed_at ?? review.created_at;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Latest persisted review is authoritative; an older pass cannot override a
 * newer failed review. */
export function selectLatestIdentityReview(
  reviews: readonly PersonaIdentityReview[],
  notAfter?: string,
): PersonaIdentityReview | null {
  const cutoff = notAfter ? Date.parse(notAfter) : Number.POSITIVE_INFINITY;
  return (
    [...reviews]
      .filter((review) => reviewTime(review) <= cutoff)
      .sort((a, b) => reviewTime(b) - reviewTime(a))[0] ?? null
  );
}

export function evaluateIdentityReviewQualityGate(
  review: PersonaIdentityReview | null,
): IdentityReviewQualityGate {
  const blockingReasons: string[] = [];

  if (!review) {
    blockingReasons.push("Persisted identity review is required");
  } else {
    if (!review.reviewed_at) {
      blockingReasons.push("Identity review has no review timestamp");
    }
    for (const key of IDENTITY_LOCK_REVIEW_CHECK_KEYS) {
      if (review.checklist[key] !== true) {
        blockingReasons.push(`Identity review check not passed: ${key}`);
      }
    }
  }

  const identityLockPassed = blockingReasons.length === 0;
  return {
    review,
    identityLockPassed,
    imageIdentityReady:
      identityLockPassed && review?.checklist.suitable_for_image_generation === true,
    videoIdentityReady:
      identityLockPassed && review?.checklist.suitable_for_video_generation === true,
    blockingReasons,
  };
}
