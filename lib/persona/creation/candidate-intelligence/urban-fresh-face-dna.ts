/**
 * Phase 2.5B.6 — Urban fresh-face DNA across discovery runs.
 *
 * Prompt-bias only: cluster recent unprotected Urban discovery embeddings and
 * bias the next run away from dominant face-space. Does not hard-block normal
 * resemblance. Does not change hair rotation / novelty thresholds.
 * No provider calls.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import { euclideanDistance } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import {
  isHistoricalBlockingProtectionStatus,
  normalizeHistoricalProtectionStatus,
  type HistoricalFaceProtectionStatus,
} from "@/lib/persona/face-novelty-memory/historical-protection";

export const URBAN_FRESH_FACE_DNA_VERSION = "2.5B.6" as const;

/** Last N Urban discovery projects considered for anti-repeat bias. */
export const URBAN_RECENT_PROJECTS_FOR_FACE_BIAS = 5;

/**
 * Soft cluster distance (Euclidean). Near identity-lock warning band —
 * groups similar discovery faces without treating them as hard duplicates.
 */
export const URBAN_FACE_CLUSTER_DISTANCE = 0.5;

/** Slot facial emphasis pool — light cues only, not permanent anatomy recipes. */
export const URBAN_FACIAL_EMPHASIS_POOL = [
  "broader face",
  "narrower face",
  "longer face",
  "shorter face",
  "higher cheekbones",
  "softer cheekbones",
  "wider-set eyes",
  "closer-set eyes",
  "broader nose",
  "narrower nose",
  "fuller lips",
  "thinner lips",
  "softer jaw",
  "stronger jaw",
] as const;

export type UrbanFacialEmphasis = (typeof URBAN_FACIAL_EMPHASIS_POOL)[number];

export type UrbanFaceEmbeddingSample = {
  creationProjectId: string;
  candidateId: string;
  embedding: number[];
  historicalProtectionStatus?: HistoricalFaceProtectionStatus | null;
  /** ISO timestamp when available — newer projects preferred. */
  createdAt?: string | null;
};

export type UrbanFaceCluster = {
  id: string;
  memberCandidateIds: string[];
  memberProjectIds: string[];
  size: number;
  centroid: number[];
};

export type UrbanFreshFaceClusterAnalysis = {
  recentProjectIds: string[];
  recentClustersConsidered: number;
  dominantClusterId: string | null;
  dominantClusterSize: number;
  dominantClusterAvoided: string | null;
  avoidanceWeight: number;
  sampleCount: number;
};

export type UrbanFreshFaceDna = {
  version: typeof URBAN_FRESH_FACE_DNA_VERSION;
  freshFaceDirection: string;
  facialEmphasis: Record<DiscoverySlot, UrbanFacialEmphasis>;
  recentClustersConsidered: number;
  dominantClusterAvoided: string | null;
  avoidanceWeight: number;
  recentProjectIds: string[];
};

function hashStringToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function centroidOf(embeddings: number[][]): number[] {
  const dim = embeddings[0]?.length ?? 0;
  const out = new Array(dim).fill(0);
  if (embeddings.length === 0 || dim === 0) return out;
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i += 1) out[i] += emb[i] ?? 0;
  }
  for (let i = 0; i < dim; i += 1) out[i] /= embeddings.length;
  return out;
}

/**
 * Greedy single-pass clustering by Euclidean distance to running centroid.
 */
export function clusterUrbanFaceEmbeddings(
  samples: readonly UrbanFaceEmbeddingSample[],
  distanceThreshold: number = URBAN_FACE_CLUSTER_DISTANCE,
): UrbanFaceCluster[] {
  const clusters: Array<{
    members: UrbanFaceEmbeddingSample[];
    centroid: number[];
  }> = [];

  for (const sample of samples) {
    if (!Array.isArray(sample.embedding) || sample.embedding.length === 0) {
      continue;
    }
    let bestIdx = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i += 1) {
      const dist = euclideanDistance(sample.embedding, clusters[i]!.centroid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestDist <= distanceThreshold) {
      const cluster = clusters[bestIdx]!;
      cluster.members.push(sample);
      cluster.centroid = centroidOf(cluster.members.map((m) => m.embedding));
    } else {
      clusters.push({
        members: [sample],
        centroid: [...sample.embedding],
      });
    }
  }

  return clusters.map((c, idx) => {
    const memberCandidateIds = c.members.map((m) => m.candidateId);
    const memberProjectIds = [
      ...new Set(c.members.map((m) => m.creationProjectId)),
    ];
    const id = `cluster-${idx + 1}-n${c.members.length}`;
    return {
      id,
      memberCandidateIds,
      memberProjectIds,
      size: c.members.length,
      centroid: c.centroid,
    };
  });
}

/**
 * Filter to unprotected discovery samples only (exclude locked Brand Models).
 */
export function filterDiscoveryOnlyFaceSamples(
  samples: readonly UrbanFaceEmbeddingSample[],
  currentCreationProjectId?: string,
): UrbanFaceEmbeddingSample[] {
  const current = currentCreationProjectId?.trim() ?? "";
  return samples.filter((s) => {
    if (!s.creationProjectId?.trim()) return false;
    if (current && s.creationProjectId === current) return false;
    const status = normalizeHistoricalProtectionStatus(
      s.historicalProtectionStatus,
    );
    // Selected / locked / approved stay on the hard novelty path — not this bias bucket.
    if (isHistoricalBlockingProtectionStatus(status)) return false;
    return Array.isArray(s.embedding) && s.embedding.length > 0;
  });
}

function orderRecentProjectIds(
  samples: readonly UrbanFaceEmbeddingSample[],
  limit: number,
): string[] {
  const latestByProject = new Map<string, number>();
  for (const s of samples) {
    const ts = s.createdAt ? Date.parse(s.createdAt) : 0;
    const prev = latestByProject.get(s.creationProjectId) ?? -1;
    if (Number.isFinite(ts) && ts > prev) {
      latestByProject.set(s.creationProjectId, ts);
    } else if (!latestByProject.has(s.creationProjectId)) {
      latestByProject.set(s.creationProjectId, prev < 0 ? 0 : prev);
    }
  }
  return [...latestByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * Analyze recent Urban discovery face-space for prompt bias.
 */
export function analyzeRecentUrbanFaceClusters(
  samples: readonly UrbanFaceEmbeddingSample[],
  options?: {
    currentCreationProjectId?: string;
    recentProjectLimit?: number;
    clusterDistance?: number;
  },
): UrbanFreshFaceClusterAnalysis {
  const discoveryOnly = filterDiscoveryOnlyFaceSamples(
    samples,
    options?.currentCreationProjectId,
  );
  const limit =
    options?.recentProjectLimit ?? URBAN_RECENT_PROJECTS_FOR_FACE_BIAS;
  const recentProjectIds = orderRecentProjectIds(discoveryOnly, limit);
  const recentSet = new Set(recentProjectIds);
  const recentSamples = discoveryOnly.filter((s) =>
    recentSet.has(s.creationProjectId),
  );
  const clusters = clusterUrbanFaceEmbeddings(
    recentSamples,
    options?.clusterDistance ?? URBAN_FACE_CLUSTER_DISTANCE,
  );
  clusters.sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  const dominant = clusters[0] ?? null;
  // Weight rises when a cluster repeats across projects / many members.
  let avoidanceWeight = 0;
  if (dominant && dominant.size >= 2) {
    avoidanceWeight = 1;
    if (dominant.size >= 4 || dominant.memberProjectIds.length >= 2) {
      avoidanceWeight = 2;
    }
    if (dominant.size >= 6 || dominant.memberProjectIds.length >= 3) {
      avoidanceWeight = 3;
    }
  }

  return {
    recentProjectIds,
    recentClustersConsidered: clusters.length,
    dominantClusterId: dominant?.id ?? null,
    dominantClusterSize: dominant?.size ?? 0,
    dominantClusterAvoided: dominant
      ? `dominant recent cluster ${dominant.id} (n=${dominant.size})`
      : null,
    avoidanceWeight,
    sampleCount: recentSamples.length,
  };
}

/** Pick 4 distinct facial emphases for A/B/C/D — separate seed from hair RNG. */
export function pickUrbanSlotFacialEmphases(
  creationProjectId: string,
): Record<DiscoverySlot, UrbanFacialEmphasis> {
  const rng = mulberry32(
    hashStringToUint32(`urban-fresh-face-dna-v1:${creationProjectId.trim()}`),
  );
  const bag = [...URBAN_FACIAL_EMPHASIS_POOL];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return {
    A: bag[0]!,
    B: bag[1]!,
    C: bag[2]!,
    D: bag[3]!,
  };
}

export function buildUrbanFreshFaceDirection(input: {
  analysis: UrbanFreshFaceClusterAnalysis;
  facialEmphasis: Record<DiscoverySlot, UrbanFacialEmphasis>;
}): string {
  const lines = [
    "Create a genuinely new person whose overall facial identity is clearly different from previous Urban discovery faces.",
    "Avoid repeating the dominant facial proportions seen in earlier runs.",
  ];
  if (input.analysis.avoidanceWeight >= 1) {
    lines.push(
      "Vary face width, lower-face length, cheekbone prominence, eye spacing, nose width/profile, lip fullness, and brow structure.",
    );
  }
  if (input.analysis.avoidanceWeight >= 2) {
    lines.push(
      "Stronger freshness required — a similar face cluster appeared often in recent Urban discoveries.",
    );
  }
  if (input.analysis.avoidanceWeight >= 3) {
    lines.push(
      "Do not recreate the recent dominant Urban face-space — push clearly into a different facial proportion family.",
    );
  }
  // Compact slot cues (not an anatomy essay).
  lines.push(
    `Slot face emphasis this run: A ${input.facialEmphasis.A} · B ${input.facialEmphasis.B} · C ${input.facialEmphasis.C} · D ${input.facialEmphasis.D}.`,
  );
  return lines.join(" ");
}

/**
 * Build fresh-face DNA for a Creation Project.
 * Hair rotation is intentionally NOT computed here.
 */
export function buildUrbanFreshFaceDna(
  creationProjectId: string,
  recentFaceSamples?: readonly UrbanFaceEmbeddingSample[] | null,
): UrbanFreshFaceDna {
  const id = creationProjectId.trim();
  const facialEmphasis = pickUrbanSlotFacialEmphases(id);
  const analysis = analyzeRecentUrbanFaceClusters(recentFaceSamples ?? [], {
    currentCreationProjectId: id,
  });
  return {
    version: URBAN_FRESH_FACE_DNA_VERSION,
    freshFaceDirection: buildUrbanFreshFaceDirection({
      analysis,
      facialEmphasis,
    }),
    facialEmphasis,
    recentClustersConsidered: analysis.recentClustersConsidered,
    dominantClusterAvoided: analysis.dominantClusterAvoided,
    avoidanceWeight: analysis.avoidanceWeight,
    recentProjectIds: analysis.recentProjectIds,
  };
}
