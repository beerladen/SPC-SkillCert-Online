"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportPrintActions() {
  return (
    <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between gap-3 print:hidden">
      <Button asChild variant="outline">
        <Link href="/admin/reports">
          <ArrowLeft className="size-4" />
          กลับหน้ารายงาน
        </Link>
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        พิมพ์ / บันทึก PDF
      </Button>
    </div>
  );
}
