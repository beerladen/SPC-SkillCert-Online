"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminDetailDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  wide?: boolean;
}

export function AdminDetailDrawer({
  open,
  title,
  description,
  children,
  footer,
  onOpenChange,
  wide = false,
}: AdminDetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="ปิดรายละเอียด"
        className="absolute inset-0 bg-black/35"
        onClick={() => onOpenChange(false)}
      />
      <aside
        aria-modal="true"
        role="dialog"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l bg-background shadow-xl",
          wide ? "max-w-3xl" : "max-w-xl"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="ปิด"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t bg-secondary/30 p-4">{footer}</div>}
      </aside>
    </div>
  );
}
