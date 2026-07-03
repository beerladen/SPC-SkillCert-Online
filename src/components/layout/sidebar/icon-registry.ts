import {
  Award,
  BarChart3,
  BookOpen,
  Circle,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Home,
  Menu,
  MessageCircle,
  Navigation,
  Newspaper,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export const sidebarIconMap = {
  Award,
  BarChart3,
  BookOpen,
  Circle,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Home,
  Menu,
  MessageCircle,
  Navigation,
  Newspaper,
  Settings,
  Users,
} satisfies Record<string, LucideIcon>;

export type SidebarIconKey = keyof typeof sidebarIconMap;

export const sidebarIconOptions = Object.keys(sidebarIconMap).map((key) => ({
  value: key,
  label: key,
}));

export function getSidebarIcon(iconKey?: string | null) {
  return sidebarIconMap[(iconKey ?? "Circle") as SidebarIconKey] ?? Circle;
}
