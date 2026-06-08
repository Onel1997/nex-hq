import {
  INTELLIGENCE_FEED,
  type IntelligenceItem,
  type IntelligenceType,
} from "@/lib/mock/command-center";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  Lightbulb,
  Megaphone,
  Palette,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const TYPE_CONFIG: Record<
  IntelligenceType,
  { icon: LucideIcon; label: string }
> = {
  trend: { icon: TrendingUp, label: "Trend" },
  design: { icon: Palette, label: "Design" },
  market: { icon: Megaphone, label: "Market" },
  content: { icon: Lightbulb, label: "Content" },
};

function FeedItem({
  item,
  isLast,
}: {
  item: IntelligenceItem;
  isLast: boolean;
}) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-2 size-2.5 rounded-full border-2 border-primary/40 bg-background" />
      {!isLast && (
        <div className="absolute bottom-0 left-[4px] top-5 w-px bg-border" />
      )}

      <div className="space-y-3 pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Icon className="size-4 text-primary/70" />
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {config.label}
          </span>
          <span className="text-sm text-muted-foreground/60">{item.time}</span>
          {item.actionable && (
            <span className="ml-auto rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              Act
            </span>
          )}
        </div>
        <h3 className="font-display text-xl font-medium leading-snug text-foreground">
          {item.title}
        </h3>
        <p className="text-base leading-relaxed text-muted-foreground">
          {item.insight}
        </p>
      </div>
    </article>
  );
}

export function IntelligenceFeed() {
  return (
    <section className="space-y-10">
      <SectionHeading
        label="Intelligence"
        title="Signals & opportunities"
      />

      <div className="luxury-surface p-8 lg:p-10">
        {INTELLIGENCE_FEED.map((item, index) => (
          <FeedItem
            key={item.id}
            item={item}
            isLast={index === INTELLIGENCE_FEED.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
