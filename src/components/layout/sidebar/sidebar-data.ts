import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Home,
  MessageCircle,
  Navigation,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  iconKey?: string;
  badge?: string;
  badgeKey?: "pendingRegistrations" | "pendingPayments";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const sidebarData: NavSection[] = [
  {
    items: [{ title: "Dashboard", href: "/admin/dashboard", icon: Home }],
  },
  {
    title: "หลักสูตร",
    items: [
      { title: "จัดการหลักสูตร", href: "/admin/courses", icon: BookOpen },
      { title: "จัดการการเรียนรู้", href: "/admin/learning", icon: ClipboardList },
      { title: "ผู้เข้าอบรม", href: "/admin/enrollments", icon: GraduationCap },
      { title: "วัดผล/ข้อสอบ", href: "/admin/assessments", icon: FileQuestion },
    ],
  },
  {
    title: "ลงทะเบียน",
    items: [
      {
        title: "รายการลงทะเบียน",
        href: "/admin/registrations",
        icon: ClipboardCheck,
        badgeKey: "pendingRegistrations",
      },
      {
        title: "ตรวจหลักฐานชำระเงิน",
        href: "/admin/payments",
        icon: CreditCard,
        badgeKey: "pendingPayments",
      },
      { title: "ใบประกาศนียบัตร", href: "/admin/certificates", icon: Award },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { title: "รายงาน", href: "/admin/reports", icon: BarChart3 },
      { title: "ผู้ใช้งาน", href: "/admin/users", icon: Users },
      { title: "จัดการเมนู", href: "/admin/navigation", icon: Navigation },
      { title: "ตั้งค่าเว็บไซต์", href: "/admin/settings", icon: Settings },
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { title: "ข้อความติดต่อ", href: "/feedback", icon: MessageCircle },
  { title: "คู่มือระบบ", href: "/help", icon: HelpCircle },
];
