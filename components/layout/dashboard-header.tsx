"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDictionary, useT, useWorkspace } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardHeader() {
  const pathname = usePathname();
  const t = useT();
  const workspace = useWorkspace();
  const { platform } = useDictionary();
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-12 shrink-0 items-center px-4 lg:px-6",
        isHome
          ? "border-b border-[oklch(0.82_0.055_85/0.08)] bg-[oklch(0.1_0.014_55)]"
          : "border-b border-border/30 bg-background/60 backdrop-blur-xl",
      )}
    >
      <SidebarTrigger
        className="-ml-1 size-8 text-muted-foreground hover:text-foreground"
        label={t("common.toggleSidebar")}
      />
      <span
        className={cn(
          "ml-3 text-xs",
          isHome
            ? "text-[oklch(0.48_0.015_70)]"
            : "text-muted-foreground/60",
        )}
      >
        {isHome ? (
          <>
            {platform.name}
            <span className="mx-2 opacity-40">·</span>
            {workspace.name}
          </>
        ) : (
          platform.name
        )}
      </span>
    </header>
  );
}
