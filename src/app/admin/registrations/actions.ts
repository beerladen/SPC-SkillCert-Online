"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  safelyRemoveRegistration,
  updateRegistrationStatus,
} from "@/lib/registration-repositories";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function updateRegistrationStatusAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const registrationId = Number(text(formData, "registrationId"));
  const status = text(formData, "status") as "pending_payment" | "pending_review" | "approved" | "rejected" | "cancelled" | "completed";
  const note = text(formData, "note");
  await updateRegistrationStatus({
    registrationId,
    userId: user.id,
    status,
    note,
  });
  await logAudit({
    userId: user.id,
    action: "registration.status_updated",
    entityType: "registration",
    entityId: registrationId,
    detail: { status, note },
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/enrollments");
}

export async function removeRegistrationAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const registrationId = Number(text(formData, "registrationId"));
  const reason = text(formData, "reason");
  const result = await safelyRemoveRegistration({
    registrationId,
    userId: user.id,
    reason,
  });

  await logAudit({
    userId: user.id,
    action: result.mode === "cancelled" ? "registration.cancelled_safely" : "registration.removed_safely",
    entityType: "registration",
    entityId: registrationId,
    detail: { reason, ok: result.ok, mode: result.mode, message: result.message },
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/dashboard");
  revalidatePath("/my-learning");

  return result;
}
