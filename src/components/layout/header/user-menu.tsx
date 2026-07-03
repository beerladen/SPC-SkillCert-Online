"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { UserCog, Settings, LogOut, UserRoundPen } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface CurrentAdminUser {
  name: string;
  email: string;
  role: string;
}

export function UserMenu() {
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState<CurrentAdminUser | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/admin/current-user", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CurrentAdminUser | null) => {
        if (mounted && data) setUser(data);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const fallback = user?.email?.slice(0, 2).toUpperCase() ?? "SP";
  const canManageUsers = user?.role === "admin" || user?.role === "staff";
  const canManageSettings = user?.role === "admin";
  const initials = useMemo(() => {
    const name = user?.name.trim();
    if (!name) return fallback;
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [fallback, user?.name]);

  const handleLogout = () => {
    startTransition(() => {
      signOutAction();
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-2 py-1">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="hidden min-w-0 leading-tight xl:block">
        <p className="max-w-[150px] truncate text-sm font-medium">{user?.name ?? "SPC SkillCert"}</p>
        <p className="max-w-[150px] truncate text-xs text-muted-foreground">{user?.email ?? "บัญชีที่เข้าสู่ระบบ"}</p>
      </div>
      {canManageUsers && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="ผู้ใช้งาน">
          <Link href="/admin/users">
            <UserCog className="h-4 w-4" />
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="โปรไฟล์/ลายเซ็นของฉัน">
        <Link href="/admin/profile">
          <UserRoundPen className="h-4 w-4" />
        </Link>
      </Button>
      {canManageSettings && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="ตั้งค่าระบบ">
          <Link href="/admin/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={handleLogout}
        disabled={isPending}
        title={isPending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
