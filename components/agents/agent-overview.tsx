import { AGENT_CATALOG } from "@/lib/constants/agents";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";

export function AgentOverview() {
  const active = Object.values(AGENT_CATALOG).filter((a) => a.status === "active").length;
  const planned = Object.values(AGENT_CATALOG).filter((a) => a.status === "planned").length;

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {[
        { label: "Total Agents", value: "6" },
        { label: "Active", value: String(active), highlight: true },
        { label: "Planned", value: String(planned) },
      ].map((stat) => (
        <div key={stat.label} className="luxury-surface p-8">
          <p className="text-label">{stat.label}</p>
          <p
            className={`mt-2 font-display text-5xl font-medium tracking-tight ${
              stat.highlight ? "text-primary" : "text-foreground"
            }`}
          >
            {stat.value}
          </p>
          {stat.highlight && (
            <div className="mt-4">
              <AgentStatusBadge status="active" showPulse />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
