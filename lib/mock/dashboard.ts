import type { AgentId } from "@/lib/constants/agents";

export interface DashboardStat {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export interface ActivityItem {
  id: string;
  agentId: AgentId;
  message: string;
  timestamp: string;
  type: "info" | "success" | "warning";
}

export interface SystemMetric {
  label: string;
  value: number;
  max: number;
}

export const DASHBOARD_STATS: DashboardStat[] = [
  { label: "Active Agents", value: "1", change: "CEO online", trend: "neutral" },
  { label: "Open Tasks", value: "8", change: "SS26 capsule", trend: "up" },
  { label: "Intelligence Reports", value: "7", change: "3 awaiting review", trend: "neutral" },
  { label: "Brain Domains", value: "6", change: "5 synced", trend: "up" },
];

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    agentId: "ceo",
    message: "Queued SS26 capsule workflow — 5 specialist agents planned for delegation",
    timestamp: "2 min ago",
    type: "info",
  },
  {
    id: "act-2",
    agentId: "ceo",
    message: "Brain knowledge system online — 6 domains, 24 entries indexed",
    timestamp: "18 min ago",
    type: "success",
  },
  {
    id: "act-3",
    agentId: "ceo",
    message: "Research & Designer agents marked planned — routing held until activation",
    timestamp: "1 hr ago",
    type: "warning",
  },
  {
    id: "act-4",
    agentId: "ceo",
    message: "Command center OS initialized — all pages operational",
    timestamp: "3 hr ago",
    type: "success",
  },
];

export const SYSTEM_METRICS: SystemMetric[] = [
  { label: "Brain Sync", value: 100, max: 100 },
  { label: "CEO Uptime", value: 99, max: 100 },
  { label: "Task Pipeline", value: 42, max: 100 },
  { label: "Agent Capacity", value: 17, max: 100 },
];
