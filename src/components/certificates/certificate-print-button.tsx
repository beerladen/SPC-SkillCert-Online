"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificatePrintButton({
  label = "บันทึกเป็น PDF",
  icon = "download",
}: {
  label?: string;
  icon?: "download" | "print";
}) {
  const Icon = icon === "print" ? Printer : Download;

  return (
    <Button type="button" onClick={() => window.print()}>
      <Icon data-icon="inline-start" className="size-4" />
      {label}
    </Button>
  );
}
