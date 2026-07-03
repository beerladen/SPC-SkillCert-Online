import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, getPool, queryRows } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export interface RegistrationCourseOption {
  id: number;
  title: string;
  slug: string;
  registrationFee: number;
  originalFee: number | null;
  promotionId: number | null;
  promotionName: string | null;
  coverImageUrl: string | null;
}

export interface ExistingCourseRegistrationState {
  registrationId: number | null;
  registrationNo: string | null;
  registrationStatus: string | null;
  paymentStatus: string | null;
  enrollmentId: number | null;
  enrollmentStatus: string | null;
}

export interface AdminRegistrationRow {
  id: number;
  registrationNo: string;
  learnerName: string;
  learnerEmail: string;
  courseTitles: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  submittedAt: string;
  note: string | null;
  paymentStatus: string | null;
  enrollmentCount: number;
  completedEnrollmentCount: number;
  certificateCount: number;
  canRemove: boolean;
  removeMode: "delete" | "cancel" | "blocked";
  removeLabel: string;
  removeHelp: string;
}

export interface AdminPaymentRow {
  id: number;
  registrationId: number;
  registrationNo: string;
  learnerName: string;
  learnerEmail: string;
  courseTitles: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  note: string | null;
  evidenceUrls: string[];
  evidenceNames: string[];
  canRemove: boolean;
  removeHelp: string;
}

export interface RegistrationActionResult {
  ok: boolean;
  message: string;
  mode?: "deleted" | "cancelled" | "blocked";
}

export async function getRegistrationCourseOptions(): Promise<RegistrationCourseOption[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT c.id, c.title, c.slug, c.cover_image_url, c.registration_fee, c.original_fee,
            p.id AS promotion_id, p.name AS promotion_name
     FROM courses c
     LEFT JOIN course_promotions cp ON cp.course_id = c.id
     LEFT JOIN promotions p ON p.id = cp.promotion_id
       AND p.status = 'active'
       AND (p.starts_at IS NULL OR p.starts_at <= NOW())
       AND (p.ends_at IS NULL OR p.ends_at >= NOW())
     WHERE c.deleted_at IS NULL AND c.status IN ('open', 'nearly_full')
     ORDER BY c.published_at DESC, c.id DESC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    coverImageUrl: row.cover_image_url,
    registrationFee: Number(row.registration_fee ?? 0),
    originalFee: row.original_fee === null ? null : Number(row.original_fee),
    promotionId: row.promotion_id === null ? null : Number(row.promotion_id),
    promotionName: row.promotion_name,
  }));
}

export async function getExistingCourseRegistrationState(input: {
  userId: number;
  courseId: number;
}): Promise<ExistingCourseRegistrationState | null> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT
        r.id AS registration_id,
        r.registration_no,
        r.status AS registration_status,
        MAX(rp.status) AS payment_status,
        e.id AS enrollment_id,
        e.status AS enrollment_status
     FROM registration_items ri
     JOIN registrations r ON r.id = ri.registration_id
     LEFT JOIN registration_payments rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
     LEFT JOIN enrollments e ON e.registration_item_id = ri.id
     WHERE r.user_id = ?
       AND ri.course_id = ?
       AND r.deleted_at IS NULL
       AND r.status IN ('pending_payment', 'pending_review', 'approved', 'completed')
     GROUP BY r.id, r.registration_no, r.status, e.id, e.status
     ORDER BY r.submitted_at DESC, r.id DESC
     LIMIT 1`,
    [input.userId, input.courseId],
  );

  const row = rows[0];
  if (row) {
    return {
      registrationId: Number(row.registration_id),
      registrationNo: row.registration_no,
      registrationStatus: row.registration_status,
      paymentStatus: row.payment_status,
      enrollmentId: row.enrollment_id === null ? null : Number(row.enrollment_id),
      enrollmentStatus: row.enrollment_status,
    };
  }

  const enrollmentRows = await queryRows<RowDataPacket>(
    `SELECT id, status
     FROM enrollments
     WHERE user_id = ?
       AND course_id = ?
       AND status IN ('active', 'completed')
     ORDER BY enrolled_at DESC, id DESC
     LIMIT 1`,
    [input.userId, input.courseId],
  );
  const enrollment = enrollmentRows[0];

  return enrollment
    ? {
        registrationId: null,
        registrationNo: null,
        registrationStatus: null,
        paymentStatus: null,
        enrollmentId: Number(enrollment.id),
        enrollmentStatus: enrollment.status,
      }
    : null;
}

export async function getAdminRegistrationRows(): Promise<AdminRegistrationRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT r.id, r.registration_no, r.subtotal, r.discount_amount, r.total_amount,
            r.status, r.submitted_at, r.note, u.name AS learner_name, u.email AS learner_email,
            GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') AS course_titles,
            MAX(rp.status) AS payment_status,
            COUNT(DISTINCT e.id) AS enrollment_count,
            COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) AS completed_enrollment_count,
            COUNT(DISTINCT cert.id) AS certificate_count
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     JOIN registration_items ri ON ri.registration_id = r.id
     JOIN courses c ON c.id = ri.course_id
     LEFT JOIN registration_payments rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
     LEFT JOIN enrollments e ON e.registration_item_id = ri.id
     LEFT JOIN certificates cert ON cert.enrollment_id = e.id AND cert.status = 'issued'
     WHERE r.deleted_at IS NULL
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
  );

  return rows.map((row) => {
    const status = String(row.status);
    const enrollmentCount = Number(row.enrollment_count ?? 0);
    const completedEnrollmentCount = Number(row.completed_enrollment_count ?? 0);
    const certificateCount = Number(row.certificate_count ?? 0);
    const removeState = getRegistrationRemoveState({
      status,
      enrollmentCount,
      completedEnrollmentCount,
      certificateCount,
    });

    return {
      id: Number(row.id),
      registrationNo: row.registration_no,
      learnerName: row.learner_name,
      learnerEmail: row.learner_email,
      courseTitles: row.course_titles ?? "-",
      subtotal: Number(row.subtotal ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
      status,
      submittedAt: formatDateTime(row.submitted_at),
      note: row.note,
      paymentStatus: row.payment_status,
      enrollmentCount,
      completedEnrollmentCount,
      certificateCount,
      ...removeState,
    };
  });
}

export async function getAdminPaymentRows(): Promise<AdminPaymentRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT rp.id, rp.registration_id, rp.amount, rp.method, rp.status, rp.paid_at, rp.note,
            r.registration_no, u.name AS learner_name, u.email AS learner_email,
            GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') AS course_titles,
            GROUP_CONCAT(DISTINCT pe.file_url ORDER BY pe.id SEPARATOR '||') AS evidence_urls,
            GROUP_CONCAT(DISTINCT pe.original_file_name ORDER BY pe.id SEPARATOR '||') AS evidence_names
     FROM registration_payments rp
     JOIN registrations r ON r.id = rp.registration_id
     JOIN users u ON u.id = r.user_id
     JOIN registration_items ri ON ri.registration_id = r.id
     JOIN courses c ON c.id = ri.course_id
     LEFT JOIN payment_evidences pe ON pe.payment_id = rp.id
     WHERE rp.deleted_at IS NULL
       AND r.deleted_at IS NULL
     GROUP BY rp.id
     ORDER BY FIELD(rp.status, 'pending_review', 'pending', 'approved', 'rejected', 'refunded'), rp.created_at DESC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    registrationId: Number(row.registration_id),
    registrationNo: row.registration_no,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    courseTitles: row.course_titles ?? "-",
    amount: Number(row.amount ?? 0),
    method: row.method,
    status: row.status,
    paidAt: formatDateTime(row.paid_at),
    note: row.note,
    evidenceUrls: row.evidence_urls ? String(row.evidence_urls).split("||") : [],
    evidenceNames: row.evidence_names ? String(row.evidence_names).split("||") : [],
    canRemove: ["pending", "pending_review", "rejected"].includes(String(row.status)),
    removeHelp: ["approved", "refunded"].includes(String(row.status))
      ? "รายการนี้ผ่านการตรวจหรือคืนเงินแล้ว ควรเก็บไว้เป็นหลักฐาน"
      : "ลบ/ซ่อนหลักฐานที่แนบผิดหรือรายการทดสอบได้",
  }));
}

export async function reviewPaymentAndSyncEnrollment(input: {
  paymentId: number;
  reviewerId: number;
  decision: "approved" | "rejected";
  note: string;
}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.execute<
      Array<RowDataPacket & { registration_id: number }>
    >(
      `SELECT registration_id
       FROM registration_payments
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [input.paymentId],
    );

    const payment = paymentRows[0];
    if (!payment) throw new Error("ไม่พบรายการชำระค่าลงทะเบียน");

    await connection.execute<ResultSetHeader>(
      `UPDATE registration_payments
       SET status = ?, reviewed_at = NOW(), reviewed_by = ?, note = ?
       WHERE id = ?`,
      [input.decision, input.reviewerId, input.note || null, input.paymentId],
    );

    const registrationStatus = input.decision === "approved" ? "approved" : "rejected";
    await connection.execute<ResultSetHeader>(
      `UPDATE registrations
       SET status = ?, approved_at = IF(? = 'approved', NOW(), approved_at),
           approved_by = IF(? = 'approved', ?, approved_by),
           note = COALESCE(?, note)
       WHERE id = ?`,
      [
        registrationStatus,
        registrationStatus,
        registrationStatus,
        input.reviewerId,
        input.note || null,
        payment.registration_id,
      ],
    );

    await connection.execute<ResultSetHeader>(
      `INSERT INTO registration_status_logs (registration_id, status, changed_by, note)
       VALUES (?, ?, ?, ?)`,
      [payment.registration_id, registrationStatus, input.reviewerId, input.note || null],
    );

    if (input.decision === "approved") {
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO enrollments (user_id, course_id, registration_item_id, status, enrolled_at)
         SELECT r.user_id, ri.course_id, ri.id, 'active', NOW()
         FROM registrations r
         JOIN registration_items ri ON ri.registration_id = r.id
         WHERE r.id = ? AND r.deleted_at IS NULL`,
        [payment.registration_id],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRegistrationStatus(input: {
  registrationId: number;
  userId: number;
  status: "pending_payment" | "pending_review" | "approved" | "rejected" | "cancelled" | "completed";
  note: string;
}) {
  await executeQuery<ResultSetHeader>(
    "UPDATE registrations SET status = ?, note = COALESCE(?, note) WHERE id = ? AND deleted_at IS NULL",
    [input.status, input.note || null, input.registrationId],
  );
  await executeQuery<ResultSetHeader>(
    `INSERT INTO registration_status_logs (registration_id, status, changed_by, note)
     VALUES (?, ?, ?, ?)`,
    [input.registrationId, input.status, input.userId, input.note || null],
  );
}

function getRegistrationRemoveState(input: {
  status: string;
  enrollmentCount: number;
  completedEnrollmentCount: number;
  certificateCount: number;
}) {
  if (input.certificateCount > 0) {
    return {
      canRemove: false,
      removeMode: "blocked" as const,
      removeLabel: "ลบไม่ได้",
      removeHelp: "มีใบประกาศแล้ว ต้องเพิกถอนใบประกาศก่อน",
    };
  }

  if (input.completedEnrollmentCount > 0 || input.status === "completed") {
    return {
      canRemove: false,
      removeMode: "blocked" as const,
      removeLabel: "ลบไม่ได้",
      removeHelp: "ผู้เรียนจบหลักสูตรแล้ว ควรเก็บประวัติไว้",
    };
  }

  if (input.enrollmentCount > 0 || input.status === "approved") {
    return {
      canRemove: true,
      removeMode: "cancel" as const,
      removeLabel: "ยกเลิก",
      removeHelp: "ยกเลิกรายการและสิทธิ์เข้าเรียน แต่เก็บประวัติไว้",
    };
  }

  return {
    canRemove: true,
    removeMode: "delete" as const,
    removeLabel: "ลบ",
    removeHelp: "ซ่อนรายการออกจากหลังบ้านและรายงาน โดยยังมี audit log",
  };
}

async function appendRegistrationStatusLog(
  connection: PoolConnection,
  input: { registrationId: number; status: string; userId: number; note: string | null },
) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO registration_status_logs (registration_id, status, changed_by, note)
     VALUES (?, ?, ?, ?)`,
    [input.registrationId, input.status, input.userId, input.note],
  );
}

export async function safelyRemoveRegistration(input: {
  registrationId: number;
  userId: number;
  reason: string;
}): Promise<RegistrationActionResult> {
  const reason = input.reason.trim() || "เจ้าหน้าที่ลบ/ยกเลิกรายการจากหลังบ้าน";
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [registrationRows] = await connection.execute<
      Array<RowDataPacket & { id: number; registration_no: string; status: string }>
    >(
      `SELECT id, registration_no, status
       FROM registrations
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [input.registrationId],
    );
    const registration = registrationRows[0];

    if (!registration) {
      await connection.rollback();
      return {
        ok: false,
        mode: "blocked",
        message: "ไม่พบรายการลงทะเบียน หรือรายการนี้ถูกลบไปแล้ว",
      };
    }

    const [dependencyRows] = await connection.execute<
      Array<
        RowDataPacket & {
          enrollment_count: number;
          completed_enrollment_count: number;
          certificate_count: number;
        }
      >
    >(
      `SELECT
          COUNT(DISTINCT e.id) AS enrollment_count,
          COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) AS completed_enrollment_count,
          COUNT(DISTINCT cert.id) AS certificate_count
       FROM registration_items ri
       LEFT JOIN enrollments e ON e.registration_item_id = ri.id
       LEFT JOIN certificates cert ON cert.enrollment_id = e.id AND cert.status = 'issued'
       WHERE ri.registration_id = ?`,
      [input.registrationId],
    );
    const dependency = dependencyRows[0] ?? {};
    const removeState = getRegistrationRemoveState({
      status: registration.status,
      enrollmentCount: Number(dependency.enrollment_count ?? 0),
      completedEnrollmentCount: Number(dependency.completed_enrollment_count ?? 0),
      certificateCount: Number(dependency.certificate_count ?? 0),
    });

    if (!removeState.canRemove) {
      await connection.rollback();
      return {
        ok: false,
        mode: "blocked",
        message: removeState.removeHelp,
      };
    }

    if (removeState.removeMode === "cancel") {
      await connection.execute<ResultSetHeader>(
        `UPDATE registrations
         SET status = 'cancelled',
             note = CONCAT_WS('\n', NULLIF(note, ''), ?)
         WHERE id = ?`,
        [`ยกเลิกโดยเจ้าหน้าที่: ${reason}`, input.registrationId],
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE enrollments e
         JOIN registration_items ri ON ri.id = e.registration_item_id
         SET e.status = 'cancelled'
         WHERE ri.registration_id = ?
           AND e.status = 'active'`,
        [input.registrationId],
      );
      await appendRegistrationStatusLog(connection, {
        registrationId: input.registrationId,
        status: "cancelled",
        userId: input.userId,
        note: reason,
      });

      await connection.commit();
      return {
        ok: true,
        mode: "cancelled",
        message: "ยกเลิกรายการลงทะเบียนและสิทธิ์เข้าเรียนแล้ว โดยยังเก็บประวัติไว้",
      };
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE registration_payments
       SET deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           note = CONCAT_WS('\n', NULLIF(note, ''), ?)
       WHERE registration_id = ?
         AND deleted_at IS NULL`,
      [input.userId, reason, `ซ่อนพร้อมรายการลงทะเบียน: ${reason}`, input.registrationId],
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE registrations
       SET status = 'cancelled',
           deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           note = CONCAT_WS('\n', NULLIF(note, ''), ?)
       WHERE id = ?`,
      [input.userId, reason, `ลบ/ซ่อนโดยเจ้าหน้าที่: ${reason}`, input.registrationId],
    );
    await appendRegistrationStatusLog(connection, {
      registrationId: input.registrationId,
      status: "deleted",
      userId: input.userId,
      note: reason,
    });

    await connection.commit();
    return {
      ok: true,
      mode: "deleted",
      message: "ลบ/ซ่อนรายการลงทะเบียนแล้ว รายการนี้จะไม่แสดงในตารางและรายงานปกติ",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      mode: "blocked",
      message: error instanceof Error ? error.message : "ลบ/ยกเลิกรายการลงทะเบียนไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function safelyRemovePayment(input: {
  paymentId: number;
  userId: number;
  reason: string;
}): Promise<RegistrationActionResult> {
  const reason = input.reason.trim() || "เจ้าหน้าที่ลบหลักฐานจากหลังบ้าน";
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          registration_id: number;
          status: string;
          registration_status: string;
        }
      >
    >(
      `SELECT rp.id, rp.registration_id, rp.status, r.status AS registration_status
       FROM registration_payments rp
       JOIN registrations r ON r.id = rp.registration_id
       WHERE rp.id = ?
         AND rp.deleted_at IS NULL
         AND r.deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [input.paymentId],
    );
    const payment = paymentRows[0];

    if (!payment) {
      await connection.rollback();
      return {
        ok: false,
        mode: "blocked",
        message: "ไม่พบรายการหลักฐาน หรือรายการนี้ถูกลบไปแล้ว",
      };
    }

    if (["approved", "refunded"].includes(payment.status)) {
      await connection.rollback();
      return {
        ok: false,
        mode: "blocked",
        message: "รายการที่อนุมัติหรือคืนเงินแล้วไม่ควรลบจากหน้าตรวจหลักฐาน ให้ยกเลิกรายการลงทะเบียนแทน",
      };
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE registration_payments
       SET deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           note = CONCAT_WS('\n', NULLIF(note, ''), ?)
       WHERE id = ?`,
      [input.userId, reason, `ลบ/ซ่อนหลักฐานโดยเจ้าหน้าที่: ${reason}`, input.paymentId],
    );

    if (payment.registration_status === "pending_review") {
      const [remainingRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total
         FROM registration_payments
         WHERE registration_id = ?
           AND deleted_at IS NULL
           AND status IN ('pending_review', 'approved')`,
        [payment.registration_id],
      );

      if (Number(remainingRows[0]?.total ?? 0) === 0) {
        await connection.execute<ResultSetHeader>(
          `UPDATE registrations
           SET status = 'pending_payment',
               note = CONCAT_WS('\n', NULLIF(note, ''), ?)
           WHERE id = ?`,
          [`ลบหลักฐานที่รอตรวจ: ${reason}`, payment.registration_id],
        );
        await appendRegistrationStatusLog(connection, {
          registrationId: Number(payment.registration_id),
          status: "pending_payment",
          userId: input.userId,
          note: reason,
        });
      }
    }

    await connection.commit();
    return {
      ok: true,
      mode: "deleted",
      message: "ลบ/ซ่อนหลักฐานชำระเงินแล้ว หากไม่มีหลักฐานรอตรวจ ระบบจะปรับกลับเป็นรอชำระค่าลงทะเบียน",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      mode: "blocked",
      message: error instanceof Error ? error.message : "ลบหลักฐานชำระเงินไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
