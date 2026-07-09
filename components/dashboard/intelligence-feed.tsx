"use client";

import {
  getIntelligenceFeed,
  getIntelligenceTypeLabel,
} from "@/lib/i18n/data";
import type { IntelligenceItem, IntelligenceType } from "@/lib/mock/command-center";
import { useDictionary, useLocale, useT } from "@/lib/i18n";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  Lightbulb,
  Megaphone,
  Palette,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const TYPE_ICONS: Record<IntelligenceType, LucideIcon> = {
  trend: TrendingUp,
  design: Palette,
  market: Megaphone,
  content: Lightbulb,
};

function FeedItem({
  item,
  isLast,
  typeLabel,
  actLabel,
}: {
  item: IntelligenceItem;
  isLast: boolean;
  typeLabel: string;
  actLabel: string;
}) {
  const Icon = TYPE_ICONS[item.type];

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
            {typeLabel}
          </span>
          <span className="text-sm text-muted-foreground/60">{item.time}</span>
          {item.actionable && (
            <span className="ml-auto rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              {actLabel}
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
  const locale = useLocale();
  const t = useT();
  const { dashboard } = useDictionary();
  const feed = getIntelligenceFeed(locale);

  return (
    <section className="space-y-10">
      <SectionHeading
        label={dashboard.intelligence.label}
        title={dashboard.intelligence.title}
      />

      <div className="luxury-surface p-8 lg:p-10">
        {feed.map((item, index) => (
          <FeedItem
            key={item.id}
            item={item}
            isLast={index === feed.length - 1}
            typeLabel={getIntelligenceTypeLabel(locale, item.type)}
            actLabel={t("common.act")}
          />
        ))}
      </div>
    </section>
  );
}
