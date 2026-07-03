"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function ensurePreviewLearnerEnrollmentAction(formData: FormData) {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const slug = text(formData, "slug");
  if (!slug) throw new Error("ไม่พบหลักสูตรสำหรับสร้างผู้เรียนทดสอบ");

  const pool = getPool();
  const connection = await pool.getConnection();
  const learnerEmail = "learner@spc.ac.th";

  try {
    await connection.beginTransaction();
    const instructorOnly = currentUser.role === "instructor";
    const [courseRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      instructorOnly
        ? `SELECT c.id
           FROM courses c
           JOIN instructors i ON i.id = c.instructor_id
           WHERE c.slug = ?
             AND c.deleted_at IS NULL
             AND (
               (i.user_id = ? AND i.status = 'active')
               OR EXISTS (
                 SELECT 1
                 FROM course_instructors ci
                 JOIN instructors co_i ON co_i.id = ci.instructor_id
                 WHERE ci.course_id = c.id
                   AND co_i.user_id = ?
                   AND co_i.status = 'active'
                   AND ci.can_edit = 1
               )
             )
           LIMIT 1`
        : "SELECT id FROM courses WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      instructorOnly ? [slug, currentUser.id, currentUser.id] : [slug],
    );
    const courseId = Number(courseRows[0]?.id ?? 0);
    if (!courseId) throw new Error("ไม่พบหลักสูตรที่เปิดใช้งานสำหรับทดสอบ");

    const [userRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
      [learnerEmail],
    );

    let userId = Number(userRows[0]?.id ?? 0);
    if (!userId) {
      const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);
      const [userResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES ('ผู้เข้าอบรมตัวอย่าง', ?, ?, 'student', 'active')`,
        [learnerEmail, passwordHash],
      );
      userId = Number(userResult.insertId);
    }

    await connection.execute(
      `INSERT INTO enrollments (user_id, course_id, status, progress_percent, enrolled_at)
       VALUES (?, ?, 'active', 0, NOW())
       ON DUPLICATE KEY UPDATE
         status = IF(status = 'cancelled', 'active', status),
         enrolled_at = COALESCE(enrolled_at, NOW())`,
      [userId, courseId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidatePath(`/admin/learning/${slug}/preview`);
  revalidatePath("/admin/learning");
  redirect(`/admin/learning/${slug}/preview?learnerEmail=${encodeURIComponent(learnerEmail)}`);
}
