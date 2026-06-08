"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getMainNav, getSecondaryNav } from "@/lib/i18n/data";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { platform } = useDictionary();
  const mainNav = getMainNav(locale);
  const secondaryNav = getSecondaryNav(locale);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r-0">
      <SidebarHeader className="pt-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="hover:bg-transparent"
            >
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl border border-border bg-card">
                <span className="font-display text-lg font-medium tracking-tight text-foreground">
                  N
                </span>
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-display text-lg font-medium tracking-tight">
                  {platform.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("common.workspaceSuffix", { name: workspace.name })}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                    className={cn(
                      "h-11 text-base text-muted-foreground",
                      isActive(item.href) && "text-foreground",
                    )}
                  >
                    <item.icon className="size-[18px] opacity-70" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                    className="h-11 text-base text-muted-foreground"
                  >
                    <item.icon className="size-[18px] opacity-70" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-6">
        <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {platform.ceoAgentActive}
        </div>
      </SidebarFooter>

      <SidebarRail label={t("common.toggleSidebar")} />
    </Sidebar>
  );
}
