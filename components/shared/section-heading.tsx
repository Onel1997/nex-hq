import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  label,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-3">
        {label && <p className="text-label">{label}</p>}
        <h2 className="text-section-title text-foreground">{title}</h2>
        {description && (
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
