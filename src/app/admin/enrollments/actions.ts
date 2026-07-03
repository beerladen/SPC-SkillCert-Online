"use server";

import { revalidatePath } from "next/cache";
import type { ResultSetHeader } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { executeQuery } from "@/lib/db";

interface ActionResult {
  ok: boolean;
  message: string;
}

const enrollmentStatuses = ["active", "completed", "expired", "cancelled"] as const;
type EnrollmentStatus = (typeof enrollmentStatuses)[number];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isEnrollmentStatus(value: string): value is EnrollmentStatus {
  return enrollmentStatuses.includes(value as EnrollmentStatus);
}

export async function updateEnrollmentStatusAction(formData: FormData): Promise<ActionResult> {
  const user = await requireCurrentUser(["admin", "staff"]);

  try {
    const enrollmentId = Number(text(formData, "enrollmentId"));
    const status = text(formData, "status");
    const note = text(formData, "note") || null;

    if (!Number.isFinite(enrollmentId) || enrollmentId <= 0) {
      throw new Error("ไม่พบรายการผู้เข้าอบรม");
    }
    if (!isEnrollmentStatus(status)) {
      throw new Error("สถานะผู้เข้าอบรมไม่ถูกต้อง");
    }

    await executeQuery<ResultSetHeader>(
      `UPDATE enrollments
       SET status = ?,
           progress_percent = CASE WHEN ? = 'completed' THEN 100 ELSE progress_percent END,
           completed_at = CASE
             WHEN ? = 'completed' THEN COALESCE(completed_at, NOW())
             WHEN ? = 'active' THEN NULL
             ELSE completed_at
           END
       WHERE id = ?`,
      [status, status, status, status, enrollmentId],
    );

    await logAudit({
      userId: user.id,
      action: "enrollment.status_updated",
      entityType: "enrollment",
      entityId: enrollmentId,
      detail: { status, note },
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/certificates");
    revalidatePath("/my-learning");

    return { ok: true, message: "บันทึกสถานะผู้เข้าอบรมแล้ว" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกสถานะผู้เข้าอบรมไม่สำเร็จ",
    };
  }
}
