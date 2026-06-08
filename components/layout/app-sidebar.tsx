"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MAIN_NAV,
  SECONDARY_NAV,
} from "@/lib/constants/navigation";
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
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

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
                  M
                </span>
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-display text-lg font-medium tracking-tight">
                  Milaene
                </span>
                <span className="text-sm text-muted-foreground">Headquarters</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {MAIN_NAV.map((item) => (
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
              {SECONDARY_NAV.map((item) => (
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
          CEO Agent active
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
