"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { createReportExport } from "@/lib/admin-summary-repositories";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function createReportExportAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const reportType = text(formData, "reportType", "course_summary");

  await createReportExport({
    userId: user.id,
    user,
    reportType,
  });

  revalidatePath("/admin/reports");
}
