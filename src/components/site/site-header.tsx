import Link from "next/link";
import {
  Award,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LogOut,
  UserRound,
} from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSiteSettings } from "@/lib/public-repositories";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "หน้าแรก" },
  { href: "/courses", label: "หลักสูตรทั้งหมด" },
  { href: "/my-learning", label: "หลักสูตรของฉัน" },
  { href: "/my-certificates", label: "ใบประกาศของฉัน", authOnly: true },
  { href: "/verify-certificate", label: "ตรวจสอบใบประกาศ" },
];

const roleLabels: Record<string, string> = {
  student: "ผู้เรียน",
  instructor: "ผู้สอน",
  staff: "เจ้าหน้าที่",
  admin: "ผู้ดูแลระบบ",
};

export async function SiteHeader() {
  const [site, user] = await Promise.all([
    getPublicSiteSettings(),
    getCurrentUser().catch(() => null),
  ]);
  const accountHref = user ? (user.role === "student" ? "/my-learning" : "/admin/dashboard") : "/signin";
  const accountLabel = user ? "บัญชีออนไลน์" : "เข้าสู่ระบบ";
  const roleLabel = user ? (roleLabels[user.role] ?? "ผู้ใช้งาน") : "";
  const visibleNavItems = navItems.filter((item) => !item.authOnly || user);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-fit items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            SPC
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold">{site.shortName}</span>
            <span className="text-xs text-muted-foreground">SkillCert</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {visibleNavItems.map((item) => (
            <Button key={item.href} variant="ghost" className="shrink min-w-0 px-2 xl:px-3" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <Button
            variant="outline"
            asChild
            className="hidden w-9 shrink-0 px-0 sm:inline-flex xl:w-auto xl:px-3"
            title="รายการลงทะเบียน"
          >
            <Link href="/registration">
              <ClipboardList data-icon="inline-start" />
              <span className="hidden xl:inline">รายการลงทะเบียน</span>
            </Link>
          </Button>
          <Button asChild className="shrink-0 px-3" title={user ? `${roleLabel}ออนไลน์` : "เข้าสู่ระบบ"}>
            <Link href={accountHref} className={user ? "relative" : undefined}>
              <GraduationCap data-icon="inline-start" />
              {user && <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />}
              {accountLabel}
            </Link>
          </Button>
          {user && (
            <form action={signOutAction} className="hidden sm:block">
              <Button
                type="submit"
                size="default"
                variant="outline"
                className="w-9 shrink-0 border-rose-200 px-0 text-rose-700 hover:bg-rose-50 hover:text-rose-800 xl:w-auto xl:px-3"
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
              >
                <LogOut data-icon="inline-start" />
                <span className="hidden xl:inline">ออกจากระบบ</span>
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t bg-card/60 lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-2 sm:grid-cols-4">
          {user && (
            <div className="col-span-2 flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs sm:col-span-1">
              <UserRound className="size-4 text-primary" />
              <span className="max-w-[150px] truncate">{user.name}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">ออนไลน์</span>
            </div>
          )}
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/courses">
              <BookOpen data-icon="inline-start" />
              หลักสูตร
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/my-learning">
              <GraduationCap data-icon="inline-start" />
              ของฉัน
            </Link>
          </Button>
          {user && (
            <Button variant="ghost" size="sm" className="justify-start" asChild>
              <Link href="/my-certificates">
                <Award data-icon="inline-start" />
                ใบประกาศของฉัน
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/verify-certificate">
              <Award data-icon="inline-start" />
              ตรวจใบประกาศ
            </Link>
          </Button>
          {user && (
            <form action={signOutAction}>
              <Button type="submit" size="sm" variant="outline" className="w-full justify-start border-rose-200 text-rose-700">
                <LogOut data-icon="inline-start" />
                ออก
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
