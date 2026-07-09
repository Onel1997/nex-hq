import { cn } from "@/lib/utils";

interface CommandSurfaceProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "hq";
}

export function CommandSurface({
  children,
  className,
  variant = "default",
}: CommandSurfaceProps) {
  return (
    <div
      className={cn(
        "command-grid relative min-h-full flex-1 overflow-auto",
        variant === "hq" && "command-grid-hq",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-10 mx-auto px-8 py-12 lg:px-12 lg:py-16",
          variant === "hq"
            ? "max-w-[1280px] space-y-28"
            : "max-w-7xl space-y-12",
        )}
      >
        {children}
      </div>
    </div>
  );
}
