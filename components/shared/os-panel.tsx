import { cn } from "@/lib/utils";

interface OsPanelProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function OsPanel({ children, className, glow = false }: OsPanelProps) {
  return (
    <div
      className={cn(
        "os-panel",
        glow && "os-panel-glow",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OsPanelHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function OsPanelHeader({
  title,
  subtitle,
  action,
  className,
}: OsPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-8 py-6",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="font-display text-2xl font-medium tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

interface OsPanelContentProps {
  children: React.ReactNode;
  className?: string;
}

export function OsPanelContent({ children, className }: OsPanelContentProps) {
  return <div className={cn("p-8", className)}>{children}</div>;
}
