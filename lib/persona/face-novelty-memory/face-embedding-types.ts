/**
 * Types for face embedding storage and comparison.
 * Server-side only — never exposed to client.
 */

import type { FaceDetectionStatus } from "./similarity-threshold";

export type { FaceDetectionStatus };

export interface FaceEmbeddingRecord {
  /** The novelty record ID this embedding belongs to. */
  noveltyRecordId: string;
  /** Workspace ID — always validated before comparison. */
  workspaceId: string;
  /** Asset ID the embedding was extracted from. */
  assetId: string;
  /** Candidate ID. */
  candidateId: string;
  /** 128-dim float array — never exposed in debug output or logs. */
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  embeddingVersion: string;
  detectionConfidence: number;
  faceCount: number;
  similarityThresholdVersion: string;
  createdAt: string;
}

export interface EmbeddingComparisonInput {
  candidateEmbedding: number[];
  priorEmbeddings: Array<{
    assetId: string;
    candidateId: string;
    embedding: number[];
  }>;
}

export interface EmbeddingComparisonResult {
  closestMatchAssetId?: string;
  closestMatchCandidateId?: string;
  /** Euclidean distance to closest match (lower = more similar). */
  closestDistance?: number;
  /** Cosine similarity to closest match (higher = more similar). */
  closestSimilarity?: number;
  isDuplicate: boolean;
  isWarning: boolean;
  euclideanThreshold: number;
  warningThreshold: number;
}
