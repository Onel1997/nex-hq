import {
  FOUNDER_NAME,
  STATUS_PULSES,
  type StatusPulse,
} from "@/lib/mock/command-center";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function PulseItem({ pulse }: { pulse: StatusPulse }) {
  return (
    <div className="space-y-3">
      <p className="text-label">{pulse.label}</p>
      <p className="font-display text-4xl font-medium tracking-tight text-foreground">
        {pulse.value}
      </p>
      <p className="text-base leading-relaxed text-muted-foreground">
        {pulse.detail}
      </p>
      <div className="flex items-center gap-2 pt-1">
        <span
          className={cn(
            "size-2 rounded-full",
            pulse.state === "nominal" && "status-live",
            pulse.state === "attention" && "status-attention",
            pulse.state === "critical" && "status-critical",
          )}
        />
        <span className="text-sm capitalize text-muted-foreground">
          {pulse.state}
        </span>
      </div>
    </div>
  );
}

export function CommandHero() {
  return (
    <header className="space-y-16">
      <div className="space-y-6">
        <p className="text-lg text-muted-foreground">
          {getGreeting()}, {FOUNDER_NAME}.
        </p>
        <h1 className="text-display-xl max-w-4xl text-foreground">
          Milaene is operating normally.
        </h1>
      </div>

      <div className="grid gap-12 border-y border-border py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-16">
        {STATUS_PULSES.map((pulse) => (
          <PulseItem key={pulse.id} pulse={pulse} />
        ))}
      </div>
    </header>
  );
}
