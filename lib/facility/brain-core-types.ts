/** Client-safe types for Brain Core V2. */

export type BrainCoreNodeStatus = "online" | "idle" | "processing" | "alert";

export type BrainCoreCoreState =
  | "idle"
  | "processing"
  | "learning"
  | "decision"
  | "synthesizing";

export type BrainCoreDecisionPriority = "HIGH" | "MEDIUM" | "LOW";

export interface BrainCoreMetrics {
  neuralActivity: number;
  connectedAgents: number;
  knowledgeSignals: number;
  activeDecisions: number;
  intelligenceLevel: number;
  confidenceScore: number;
}

export interface BrainCoreAgentNode {
  id: string;
  label: string;
  angle: number;
  status: BrainCoreNodeStatus;
  activity: string | null;
}

export interface BrainCoreFeedItem {
  id: string;
  message: string;
  timestamp: string;
  kind:
    | "research"
    | "commerce"
    | "design"
    | "marketing"
    | "ceo"
    | "system";
}

export interface BrainCoreDecision {
  id: string;
  priority: BrainCoreDecisionPriority;
  message: string;
  confidence: number;
  sourceAgents: string[];
  reasoning: string;
}

export interface BrainCoreKnowledgeStream {
  id: string;
  from: string;
  to: string;
  active: boolean;
  signalCount: number;
}

export interface BrainCorePayload {
  metrics: BrainCoreMetrics;
  coreState: BrainCoreCoreState;
  nodes: BrainCoreAgentNode[];
  feed: BrainCoreFeedItem[];
  decisions: BrainCoreDecision[];
  knowledgeStreams: BrainCoreKnowledgeStream[];
  futureModules: string[];
  loadedAt: string;
}
