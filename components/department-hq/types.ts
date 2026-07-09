import type { LucideIcon } from "lucide-react";

export interface DepartmentHqTheme {
  accent: string;
  accentDim: string;
  accentBright: string;
  secondary: string;
  secondaryDim: string;
}

export interface DepartmentHqHeaderConfig {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusLine: string;
}

export interface DepartmentHqMetric {
  id: string;
  label: string;
  value: string;
  pulse?: boolean;
  glow?: boolean;
  trend?: "up" | "down" | "neutral";
}

export interface DepartmentHqFeedItem {
  id: string;
  message: string;
  timestamp: string;
  kind?: "info" | "success" | "warning" | "alert";
}

export type DepartmentHqSignalStatus =
  | "positive"
  | "warning"
  | "opportunity"
  | "neutral"
  | "critical";

export interface DepartmentHqSignal {
  id: string;
  label: string;
  detail?: string;
  status: DepartmentHqSignalStatus;
}

export type DepartmentHqDecisionPriority = "high" | "medium" | "low";

export interface DepartmentHqDecision {
  id: string;
  title: string;
  confidence: number;
  priority: DepartmentHqDecisionPriority;
  agents: string[];
}

export interface DepartmentHqNeuralNode {
  id: string;
  label: string;
  icon?: LucideIcon;
  x: number;
  y: number;
  active?: boolean;
}

export interface DepartmentHqNeuralLink {
  id: string;
  from: string;
  to: string;
  active?: boolean;
}

export interface DepartmentHqNeuralConfig {
  nodes: DepartmentHqNeuralNode[];
  links: DepartmentHqNeuralLink[];
  centerLabel?: string;
}
