"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  actOnCertificateApprovalStep,
  createCertificateApprovalReport,
} from "@/lib/certificate-approval-repositories";
import { issueCertificate, revokeCertificate } from "@/lib/certificate-repositories";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function issueCertificateAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const enrollmentId = Number(text(formData, "enrollmentId"));
  const certificateNo = await issueCertificate(enrollmentId);
  await logAudit({
    userId: user.id,
    action: "certificate.issued",
    entityType: "enrollment",
    entityId: enrollmentId,
    detail: { certificateNo },
  });
  revalidatePath("/admin/certificates");
  revalidatePath("/my-certificates");
  revalidatePath("/admin/enrollments");
}

export async function revokeCertificateAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const certificateId = Number(text(formData, "certificateId"));
  await revokeCertificate(certificateId, user.id);
  await logAudit({
    userId: user.id,
    action: "certificate.revoked",
    entityType: "certificate",
    entityId: certificateId,
  });
  revalidatePath("/admin/certificates");
  revalidatePath("/my-certificates");
}

export async function createCertificateApprovalReportAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const courseId = Number(text(formData, "courseId"));
  const reportId = await createCertificateApprovalReport({
    courseId,
    createdBy: user.id,
  });

  await logAudit({
    userId: user.id,
    action: "certificate_approval_report.created",
    entityType: "certificate_approval_report",
    entityId: reportId,
    detail: { courseId },
  });

  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates/reports/${reportId}`);
}

export async function createCertificateApprovalReportResultAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const courseId = Number(text(formData, "courseId"));

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return {
      ok: false as const,
      title: "ยังไม่ได้เลือกหลักสูตร",
      message: "กรุณาเลือกหลักสูตรที่มีผู้ผ่านเกณฑ์ก่อนสร้างรายงานเสนออนุมัติ",
    };
  }

  try {
    const reportId = await createCertificateApprovalReport({
      courseId,
      createdBy: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "certificate_approval_report.created",
      entityType: "certificate_approval_report",
      entityId: reportId,
      detail: { courseId },
    });

    revalidatePath("/admin/certificates");

    return {
      ok: true as const,
      title: "สร้างรายงานสำเร็จ",
      message: "ระบบสร้างบันทึกข้อความ รายชื่อผู้ผ่านการอบรม และ QR สำหรับอนุมัติตามลำดับเรียบร้อยแล้ว",
      reportId,
      href: `/admin/certificates/reports/${reportId}`,
    };
  } catch (error) {
    return {
      ok: false as const,
      title: "สร้างรายงานไม่สำเร็จ",
      message:
        error instanceof Error
          ? error.message
          : "ระบบไม่สามารถสร้างรายงานได้ในขณะนี้ กรุณาตรวจสอบข้อมูลผู้ผ่านเกณฑ์แล้วลองอีกครั้ง",
    };
  }
}

export async function actOnCertificateApprovalStepAction(formData: FormData) {
  const token = text(formData, "token");
  const decision = text(formData, "decision") === "return" ? "return" : "approve";
  const actorName = text(formData, "actorName");
  const note = text(formData, "note");

  await actOnCertificateApprovalStep({
    token,
    decision,
    actorName,
    note,
  });

  revalidatePath("/admin/certificates");
  revalidatePath("/my-certificates");
  revalidatePath("/certificate-approval/[token]", "page");
  redirect(`/certificate-approval/${encodeURIComponent(token)}?updated=1`);
}
