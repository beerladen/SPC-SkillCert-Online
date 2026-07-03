"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  reviewPaymentAndSyncEnrollment,
  safelyRemovePayment,
} from "@/lib/registration-repositories";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function reviewPaymentAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const paymentId = Number(text(formData, "paymentId"));
  const decision = text(formData, "decision") as "approved" | "rejected";
  const note = text(formData, "note");
  await reviewPaymentAndSyncEnrollment({
    paymentId,
    reviewerId: user.id,
    decision,
    note,
  });
  await logAudit({
    userId: user.id,
    action: "payment.reviewed",
    entityType: "registration_payment",
    entityId: paymentId,
    detail: { decision, note },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/enrollments");
  revalidatePath("/my-learning");
}

export async function removePaymentAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const paymentId = Number(text(formData, "paymentId"));
  const reason = text(formData, "reason");
  const result = await safelyRemovePayment({
    paymentId,
    userId: user.id,
    reason,
  });

  await logAudit({
    userId: user.id,
    action: "payment.removed_safely",
    entityType: "registration_payment",
    entityId: paymentId,
    detail: { reason, ok: result.ok, mode: result.mode, message: result.message },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/dashboard");

  return result;
}
