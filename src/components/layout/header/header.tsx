"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ExternalLink data-icon="inline-start" />
            หน้าเว็บไซต์
          </Link>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
