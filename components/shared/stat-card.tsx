import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  trend = "neutral",
  className,
}: StatCardProps) {
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <div className={cn("luxury-surface p-8", className)}>
      <p className="text-label">{label}</p>
      <p className="mt-2 font-display text-4xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      {change && (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 text-base",
            trend === "up" && "text-primary",
            trend === "down" && "text-red-400",
            trend === "neutral" && "text-muted-foreground",
          )}
        >
          <TrendIcon className="size-4" />
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
