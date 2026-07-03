"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { saveOwnInstructorProfile } from "@/lib/user-repositories";
import { certificateAssetUploadPolicy, saveValidatedUpload } from "@/lib/upload-security";

interface ActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function saveOwnInstructorProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);

  try {
    const signatureUpload = await saveValidatedUpload(formData.get("signatureFile"), {
      rootFolder: "instructor-signatures",
      publicBasePath: "/uploads/instructor-signatures",
      ownerSegment: currentUser.id,
      fallbackName: "instructor-signature",
      label: "ลายเซ็นครูผู้สอน",
      ...certificateAssetUploadPolicy,
    });

    await saveOwnInstructorProfile({
      userId: currentUser.id,
      displayName: text(formData, "displayName", currentUser.name),
      position: text(formData, "position", "ผู้สอน"),
      bio: text(formData, "bio"),
      signatureUrl: (signatureUpload?.fileUrl ?? text(formData, "signatureUrl")) || null,
    });

    await logAudit({
      userId: currentUser.id,
      action: "instructor.profile_updated",
      entityType: "instructor_profile",
      detail: {
        hasSignature: Boolean(signatureUpload?.fileUrl ?? text(formData, "signatureUrl")),
      },
    });

    revalidatePath("/admin/profile");
    revalidatePath("/admin/courses");
    revalidatePath("/admin/reports");

    return {
      ok: true,
      message: signatureUpload
        ? "อัปโหลดลายเซ็นและบันทึกโปรไฟล์ผู้สอนเรียบร้อยแล้ว"
        : "บันทึกโปรไฟล์ผู้สอนเรียบร้อยแล้ว",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกโปรไฟล์ผู้สอนไม่สำเร็จ",
    };
  }
}
