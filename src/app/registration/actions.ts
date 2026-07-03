"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  paymentEvidenceUploadPolicy,
  saveValidatedUpload,
  validateUploadFile,
} from "@/lib/upload-security";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value) || value <= 0) throw new Error("ข้อมูลหลักสูตรไม่ถูกต้อง");
  return value;
}

export async function createRegistrationAction(formData: FormData) {
  const user = await requireCurrentUser(["student", "instructor", "admin", "staff"]);
  const courseId = numberValue(formData, "courseId");
  const method = text(formData, "method", "bank_transfer") || "bank_transfer";
  const note = text(formData, "note");
  const paidAt = text(formData, "paidAt");
  const evidenceFile = validateUploadFile(formData.get("paymentEvidence"), {
    ...paymentEvidenceUploadPolicy,
    label: "หลักฐานค่าลงทะเบียน",
  });
  const pool = getPool();
  const connection = await pool.getConnection();
  let registrationId = 0;
  let redirectHref = "/registration";
  let handledWithoutInsert = false;

  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [user.id]);

    const [courseRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          slug: string;
          title: string;
          registration_fee: string | number;
          original_fee: string | number | null;
          promotion_id: number | null;
          promotion_name: string | null;
        }
      >
    >(
      `SELECT c.id, c.slug, c.title, c.registration_fee, c.original_fee,
              p.id AS promotion_id, p.name AS promotion_name
       FROM courses c
       LEFT JOIN course_promotions cp ON cp.course_id = c.id
       LEFT JOIN promotions p ON p.id = cp.promotion_id
         AND p.status = 'active'
         AND (p.starts_at IS NULL OR p.starts_at <= NOW())
         AND (p.ends_at IS NULL OR p.ends_at >= NOW())
       WHERE c.id = ? AND c.deleted_at IS NULL AND c.status IN ('open', 'nearly_full')
       LIMIT 1`,
      [courseId],
    );

    const course = courseRows[0];
    if (!course) throw new Error("ไม่พบหลักสูตรที่เปิดรับสมัคร");

    const [existingEnrollmentRows] = await connection.execute<
      Array<RowDataPacket & { id: number; status: string }>
    >(
      `SELECT id, status
       FROM enrollments
       WHERE user_id = ?
         AND course_id = ?
         AND status IN ('active', 'completed')
       LIMIT 1`,
      [user.id, courseId],
    );

    if (existingEnrollmentRows.length > 0) {
      redirectHref = `/my-learning/${course.slug}?registration=already_enrolled`;
      handledWithoutInsert = true;
    }

    if (!handledWithoutInsert) {
      const [existingRegistrationRows] = await connection.execute<
        Array<
          RowDataPacket & {
            id: number;
            registration_no: string;
            status: string;
            payment_status: string | null;
          }
        >
      >(
        `SELECT r.id, r.registration_no, r.status, rp.status AS payment_status
         FROM registrations r
         JOIN registration_items ri ON ri.registration_id = r.id
         LEFT JOIN registration_payments rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
         WHERE r.user_id = ?
           AND ri.course_id = ?
           AND r.deleted_at IS NULL
           AND r.status IN ('pending_payment', 'pending_review', 'approved', 'completed')
         ORDER BY r.submitted_at DESC, r.id DESC
         LIMIT 1`,
        [user.id, courseId],
      );

      const existingRegistration = existingRegistrationRows[0];
      if (existingRegistration) {
        redirectHref =
          existingRegistration.status === "approved" || existingRegistration.status === "completed"
            ? `/my-learning/${course.slug}?registration=already_approved&no=${encodeURIComponent(existingRegistration.registration_no)}`
            : `/registration?course=${encodeURIComponent(course.slug)}&duplicate=${existingRegistration.id}&status=${encodeURIComponent(existingRegistration.status)}&no=${encodeURIComponent(existingRegistration.registration_no)}`;
        handledWithoutInsert = true;
      }
    }

    if (handledWithoutInsert) {
      await connection.rollback();
    } else {
    const registrationNo = `REG-${new Date().getFullYear() + 543}-${Date.now().toString().slice(-8)}`;
    const registrationFee = Number(course.registration_fee ?? 0);
    const originalFee = course.original_fee === null ? registrationFee : Number(course.original_fee);
    const discountAmount = Math.max(0, originalFee - registrationFee);
    const isFreeCourse = registrationFee <= 0;
    const status = isFreeCourse ? "approved" : evidenceFile ? "pending_review" : "pending_payment";

    const [registrationResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO registrations
         (registration_no, user_id, subtotal, discount_amount, total_amount, status, submitted_at, approved_at, note)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), IF(? = 'approved', NOW(), NULL), ?)`,
      [registrationNo, user.id, originalFee, discountAmount, registrationFee, status, status, note || null],
    );

    registrationId = registrationResult.insertId;

    const [itemResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO registration_items
         (registration_id, course_id, registration_fee, original_fee, discount_amount, promotion_id, promotion_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        registrationId,
        courseId,
        registrationFee,
        originalFee,
        discountAmount,
        course.promotion_id,
        course.promotion_name,
      ],
    );

    const [paymentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO registration_payments (registration_id, amount, method, status, paid_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        registrationId,
        registrationFee,
        isFreeCourse ? "waived" : method,
        isFreeCourse ? "approved" : status === "pending_review" ? "pending_review" : "pending",
        isFreeCourse ? null : paidAt ? paidAt.replace("T", " ") : null,
        isFreeCourse ? "หลักสูตรไม่มีค่าลงทะเบียน ระบบเปิดสิทธิ์เข้าเรียนอัตโนมัติ" : note || null,
      ],
    );

    const evidence = await saveValidatedUpload(evidenceFile, {
      ...paymentEvidenceUploadPolicy,
      rootFolder: "payments",
      publicBasePath: "/uploads/payments",
      ownerSegment: registrationNo,
      fallbackName: "payment-slip",
      label: "หลักฐานค่าลงทะเบียน",
    });
    if (evidence) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO payment_evidences (payment_id, file_url, original_file_name, mime_type)
         VALUES (?, ?, ?, ?)`,
        [paymentResult.insertId, evidence.fileUrl, evidence.fileName, evidence.mimeType],
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO registration_status_logs (registration_id, status, changed_by, note)
       VALUES (?, ?, ?, ?)`,
      [
        registrationId,
        status,
        user.id,
        isFreeCourse ? "หลักสูตรไม่มีค่าลงทะเบียน ระบบเปิดสิทธิ์เข้าเรียนอัตโนมัติ" : note || "ผู้เข้าอบรมส่งรายการลงทะเบียน",
      ],
    );

    if (isFreeCourse) {
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO enrollments (user_id, course_id, registration_item_id, status, enrolled_at)
         VALUES (?, ?, ?, 'active', NOW())`,
        [user.id, courseId, itemResult.insertId],
      );
    }

    await connection.commit();

    await logAudit({
      userId: user.id,
      action: "registration.created",
      entityType: "registration",
      entityId: registrationId,
      detail: { courseId, status, hasPaymentEvidence: Boolean(evidence), autoEnrolled: isFreeCourse },
    });

    revalidatePath("/admin/registrations");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/enrollments");
    revalidatePath("/my-learning");
    revalidatePath(`/my-learning/${course.slug}`);

    redirectHref = isFreeCourse
      ? `/my-learning/${course.slug}?registration=approved&success=${registrationId}&no=${encodeURIComponent(registrationNo)}`
      : `/registration?success=${registrationId}&status=${status}&no=${encodeURIComponent(registrationNo)}`;
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  redirect(redirectHref);
}
