"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resetUserPassword, safelyRemoveUser, saveAdminUser } from "@/lib/user-repositories";
import { certificateAssetUploadPolicy, saveValidatedUpload } from "@/lib/upload-security";

interface ActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function saveAdminUserAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff"]);
  const id = Number(text(formData, "id"));
  const role = text(formData, "role", "student") as "student" | "instructor" | "staff" | "admin";
  const isNewUser = !(Number.isFinite(id) && id > 0);
  const password = text(formData, "password");

  if (currentUser.role !== "admin" && ["admin", "staff"].includes(role)) {
    return {
      ok: false,
      message: "เฉพาะผู้ดูแลระบบหลักเท่านั้นที่จัดการบัญชีผู้ดูแลหรือเจ้าหน้าที่ได้",
    };
  }

  if (isNewUser && password.length < 8) {
    return {
      ok: false,
      message: "กรุณากำหนดรหัสผ่านเริ่มต้นอย่างน้อย 8 ตัวอักษร",
    };
  }

  try {
    const signatureUpload = await saveValidatedUpload(formData.get("instructorSignatureFile"), {
      rootFolder: "instructor-signatures",
      publicBasePath: "/uploads/instructor-signatures",
      ownerSegment: id > 0 ? id : text(formData, "email").toLowerCase(),
      fallbackName: "instructor-signature",
      label: "ลายเซ็นครูผู้สอน",
      ...certificateAssetUploadPolicy,
    });

    const userId = await saveAdminUser({
      id: isNewUser ? undefined : id,
      name: text(formData, "name"),
      email: text(formData, "email").toLowerCase(),
      role,
      status: text(formData, "status", "active") as "active" | "disabled" | "pending",
      phone: text(formData, "phone"),
      citizenId: text(formData, "citizenId"),
      address: text(formData, "address"),
      password,
      isInstructor: formData.get("isInstructor") === "on",
      instructorPosition: text(formData, "instructorPosition"),
      instructorSignatureUrl:
        signatureUpload?.fileUrl ?? text(formData, "instructorSignatureUrl"),
    });

    await logAudit({
      userId: currentUser.id,
      action: id > 0 ? "user.updated" : "user.created",
      entityType: "user",
      entityId: userId,
      detail: { role },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/courses");
    revalidatePath("/admin/profile");
    revalidatePath("/admin/reports");

    return {
      ok: true,
      message: id > 0 ? "บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว" : "เพิ่มผู้ใช้งานเรียบร้อยแล้ว",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ",
    };
  }
}

export async function resetUserPasswordAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin"]);
  const password = text(formData, "password");
  const userId = Number(text(formData, "id"));

  if (password.length < 8) {
    return {
      ok: false,
      message: "กรุณากำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร",
    };
  }

  try {
    await resetUserPassword(userId, password);
    await logAudit({
      userId: currentUser.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: userId,
    });
    revalidatePath("/admin/users");

    return { ok: true, message: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ",
    };
  }
}

export async function removeAdminUserAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin"]);
  const userId = Number(text(formData, "id"));
  const reason = text(formData, "reason", "removed by administrator");

  const result = await safelyRemoveUser({
    targetUserId: userId,
    currentUserId: currentUser.id,
    reason,
  });

  if (result.ok) {
    await logAudit({
      userId: currentUser.id,
      action: "user.hard_deleted_from_workspace",
      entityType: "user",
      entityId: userId,
      detail: { reason },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/dashboard");

  return result;
}
