import {
  Brain,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Agents", href: "/agents", icon: Users },
  { title: "Brain", href: "/brain", icon: Brain },
  { title: "Tasks", href: "/tasks", icon: ClipboardList },
  { title: "Reports", href: "/reports", icon: FileText },
];

export const SECONDARY_NAV: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];
