"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminActionModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  onOpenChange: (open: boolean) => void;
}

const modalSizes = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-6xl",
};

export function AdminActionModal({
  open,
  title,
  description,
  children,
  footer,
  size = "md",
  onOpenChange,
}: AdminActionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="ปิดหน้าต่าง"
        className="absolute inset-0 bg-black/45"
        onClick={() => onOpenChange(false)}
      />
      <section
        aria-modal="true"
        role="dialog"
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg border bg-background shadow-xl [overflow:clip]",
          modalSizes[size]
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
        <div
          data-modal-scroll-area="true"
          className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-gutter:stable]"
        >
          {children}
        </div>
        {footer && <div className="border-t bg-secondary/30 p-4">{footer}</div>}
      </section>
    </div>
  );
}
