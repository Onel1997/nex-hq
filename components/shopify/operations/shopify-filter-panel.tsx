"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface FilterSectionProps {
  title: string;
  items: Array<{ label: string; count?: number }>;
  selected: Set<string>;
  onToggle: (label: string) => void;
  defaultOpen?: boolean;
}

function FilterSection({
  title,
  items,
  selected,
  onToggle,
  defaultOpen = false,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <div className={cn("shopify-filter-section", open && "shopify-filter-section-open")}>
      <button
        type="button"
        className="shopify-filter-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 opacity-60" />
        ) : (
          <ChevronRight className="size-3.5 opacity-60" />
        )}
        <span>{title}</span>
        <span className="shopify-filter-section-count">{items.length}</span>
      </button>

      <div className="shopify-filter-section-body">
        <ul className="shopify-filter-list">
          {items.map((item) => {
            const active = selected.has(item.label);
            return (
              <li key={item.label}>
                <button
                  type="button"
                  className={cn(
                    "shopify-filter-chip",
                    active && "shopify-filter-chip-active",
                  )}
                  onClick={() => onToggle(item.label)}
                >
                  <span>{item.label}</span>
                  {item.count !== undefined ? (
                    <span className="shopify-filter-chip-count">{item.count}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface ShopifyFilterPanelProps {
  collections: Array<{ label: string; count: number }>;
  categories: Array<{ label: string; count: number }>;
  tags: Array<{ label: string; count: number }>;
  selectedCollections: Set<string>;
  selectedCategories: Set<string>;
  selectedTags: Set<string>;
  onToggleCollection: (label: string) => void;
  onToggleCategory: (label: string) => void;
  onToggleTag: (label: string) => void;
  onClear: () => void;
}

export function ShopifyFilterPanel({
  collections,
  categories,
  tags,
  selectedCollections,
  selectedCategories,
  selectedTags,
  onToggleCollection,
  onToggleCategory,
  onToggleTag,
  onClear,
}: ShopifyFilterPanelProps) {
  const hasFilters =
    selectedCollections.size > 0 ||
    selectedCategories.size > 0 ||
    selectedTags.size > 0;

  return (
    <aside className="shopify-filter-panel" aria-label="Catalog filters">
      <div className="shopify-filter-panel-header">
        <span className="shopify-filter-panel-title">Catalog</span>
        {hasFilters ? (
          <button type="button" className="shopify-filter-clear" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      <FilterSection
        title="Collections"
        items={collections}
        selected={selectedCollections}
        onToggle={onToggleCollection}
        defaultOpen={false}
      />
      <FilterSection
        title="Categories"
        items={categories}
        selected={selectedCategories}
        onToggle={onToggleCategory}
        defaultOpen={false}
      />
      <FilterSection
        title="Tags"
        items={tags.slice(0, 24)}
        selected={selectedTags}
        onToggle={onToggleTag}
        defaultOpen={false}
      />
    </aside>
  );
}
