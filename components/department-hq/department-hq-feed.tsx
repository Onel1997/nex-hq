"use client";

import { cn } from "@/lib/utils";
import type { DepartmentHqFeedItem } from "./types";

interface DepartmentHqFeedProps {
  items: DepartmentHqFeedItem[];
  className?: string;
}

export function DepartmentHqFeed({ items, className }: DepartmentHqFeedProps) {
  return (
    <ul className={cn("dhq-feed-list", className)}>
      {items.map((item, index) => (
        <li
          key={`${item.id}-${index}`}
          className={cn(
            "dhq-feed-item",
            item.kind && `dhq-feed-${item.kind}`,
            index === 0 && "dhq-feed-item-new",
          )}
        >
          <span className="dhq-feed-pulse" aria-hidden />
          <div>
            <p>{item.message}</p>
            <time>
              {new Date(item.timestamp).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
