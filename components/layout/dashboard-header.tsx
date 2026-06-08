"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-12 shrink-0 items-center px-4 lg:px-6",
        isHome
          ? "border-transparent bg-transparent"
          : "border-b border-border/30 bg-background/60 backdrop-blur-xl",
      )}
    >
      <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground" />
      {!isHome && (
        <span className="ml-3 text-xs text-muted-foreground/60">
          Milaene HQ
        </span>
      )}
    </header>
  );
}
