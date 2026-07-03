"use client";

import Link from "next/link";

interface LogoProps {
  collapsed?: boolean;
}

export function Logo({ collapsed }: LogoProps) {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        SPC
      </div>
      {!collapsed && (
        <span className="text-sm font-bold tracking-tight text-foreground">
          SkillCert
        </span>
      )}
    </Link>
  );
}
