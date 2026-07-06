import { runFashionDesignEngine } from "@/lib/design/fashion-design-engine";
import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import { evaluateCreativeThinking } from "./creative-thinking";
import {
  applyFashionKnowledgeToEngine,
  buildFashionKnowledgeQuery,
  decideFromFashionKnowledge,
  getPatternForIteration,
} from "./director";
import { scoreCommercialDesignRanking } from "./ranking";
import type {
  FashionKnowledgeCandidate,
  FashionKnowledgePipelineInput,
  FashionKnowledgePipelineResult,
} from "./types";
import { MAX_CREATIVE_ITERATIONS } from "./types";

function evaluateCandidate(
  input: FashionKnowledgePipelineInput,
  engine: FashionDesignEngineResult,
  iteration: number,
  seed: number,
): FashionKnowledgeCandidate {
  const query = buildFashionKnowledgeQuery(input.brief, input.concept, input.designDirection);
  const pattern = iteration === 1
    ? decideFromFashionKnowledge(query).pattern
    : getPatternForIteration({ ...query, seed }, iteration);

  const decision = decideFromFashionKnowledge({ ...query, seed });
  const adjustedDecision = { ...decision, pattern };
  const adjustedEngine = applyFashionKnowledgeToEngine(engine, adjustedDecision);

  const ranking = scoreCommercialDesignRanking({
    brief: input.brief,
    concept: input.concept,
    engine: adjustedEngine,
  });

  const creativeVerdict = evaluateCreativeThinking({
    brief: input.brief,
    concept: input.concept,
    engine: adjustedEngine,
    pattern,
    rankingOverall: ranking.overall,
  });

  return {
    iteration,
    seed,
    pattern,
    engine: adjustedEngine,
    creativeVerdict,
    ranking,
  };
}

function pickBestCandidate(candidates: FashionKnowledgeCandidate[]): FashionKnowledgeCandidate {
  const exportReady = candidates.filter(
    (c) => c.ranking.exportApproved && c.creativeVerdict.passed,
  );
  if (exportReady.length > 0) {
    return exportReady.sort((a, b) => b.ranking.overall - a.ranking.overall)[0]!;
  }

  const creativePassed = candidates.filter((c) => c.creativeVerdict.passed);
  if (creativePassed.length > 0) {
    return creativePassed.sort((a, b) => b.ranking.overall - a.ranking.overall)[0]!;
  }

  return [...candidates].sort((a, b) => b.ranking.overall - a.ranking.overall)[0]!;
}

/**
 * Fashion Knowledge Pipeline — creative thinking loop with commercial ranking.
 *
 * Position: after Fashion Design Engine, before Design Quality Layer.
 * Evaluates up to 20 internal concept variants, returns only the best design.
 */
export function runFashionKnowledgePipeline(
  input: FashionKnowledgePipelineInput,
): FashionKnowledgePipelineResult {
  const maxIterations = input.maxIterations ?? MAX_CREATIVE_ITERATIONS;
  const query = buildFashionKnowledgeQuery(input.brief, input.concept, input.designDirection);
  const baseDecision = decideFromFashionKnowledge(query);
  const candidates: FashionKnowledgeCandidate[] = [];

  for (let i = 1; i <= maxIterations; i += 1) {
    const seed = query.seed + i * 137;
    const candidate = evaluateCandidate(input, input.engine, i, seed);
    candidates.push(candidate);

    if (candidate.ranking.exportApproved && candidate.creativeVerdict.passed) {
      break;
    }
  }

  const best = pickBestCandidate(candidates);
  const decision = { ...baseDecision, pattern: best.pattern };

  return {
    engine: best.engine,
    decision,
    creativeVerdict: best.creativeVerdict,
    ranking: best.ranking,
    candidatesEvaluated: candidates.length,
    exportApproved: best.ranking.exportApproved,
    selectedPattern: best.pattern,
  };
}

/**
 * Full knowledge-informed engine run — wraps fashion design engine with knowledge query.
 * Use when starting from brief/concept without a pre-built engine.
 */
export function runFashionKnowledgeEngine(
  input: Omit<FashionKnowledgePipelineInput, "engine"> & {
    generationMode?: "draft" | "production";
  },
): FashionKnowledgePipelineResult {
  const engine = runFashionDesignEngine(
    {
      brief: input.brief,
      concept: input.concept,
      designDirection: input.designDirection,
    },
    { generationMode: input.generationMode },
  );

  return runFashionKnowledgePipeline({ ...input, engine });
}
