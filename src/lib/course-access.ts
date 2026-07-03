import "server-only";

import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { CurrentUser } from "@/lib/auth";

export type CourseAccessPermission = "view" | "edit" | "grade";

type SqlValue = string | number | null;

function permissionClause(permission: CourseAccessPermission) {
  if (permission === "edit") return "AND ci.can_edit = 1";
  if (permission === "grade") return "AND ci.can_grade = 1";
  return "";
}

export function instructorCourseAccessCondition(
  courseAlias = "c",
  permission: CourseAccessPermission = "view",
) {
  const ciPermission = permissionClause(permission);

  return `(
    ${courseAlias}.instructor_id IN (
      SELECT own_i.id
      FROM instructors own_i
      JOIN users own_u ON own_u.id = own_i.user_id
      WHERE own_u.id = ?
        AND own_i.status = 'active'
        AND own_u.status = 'active'
        AND own_u.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM course_instructors ci
      JOIN instructors co_i ON co_i.id = ci.instructor_id
      JOIN users co_u ON co_u.id = co_i.user_id
      WHERE ci.course_id = ${courseAlias}.id
        AND co_u.id = ?
        AND co_i.status = 'active'
        AND co_u.status = 'active'
        AND co_u.deleted_at IS NULL
        ${ciPermission}
    )
  )`;
}

export function instructorCourseAccessValues(userId: number): [number, number] {
  return [userId, userId];
}

export function scopedCourseFilter(
  user: Pick<CurrentUser, "id" | "role"> | undefined,
  courseAlias = "c",
  permission: CourseAccessPermission = "view",
): { sql: string; values: SqlValue[] } {
  if (user?.role !== "instructor") {
    return { sql: "", values: [] };
  }

  return {
    sql: `AND ${instructorCourseAccessCondition(courseAlias, permission)}`,
    values: instructorCourseAccessValues(user.id),
  };
}

export async function getOwnInstructorId(
  connection: PoolConnection,
  user: Pick<CurrentUser, "id">,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT i.id
     FROM instructors i
     JOIN users u ON u.id = i.user_id
     WHERE u.id = ?
       AND i.status = 'active'
       AND u.status = 'active'
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [user.id],
  );

  const instructorId = rows[0]?.id;
  if (!instructorId) {
    throw new Error("บัญชีครูผู้สอนนี้ยังไม่ผูกกับโปรไฟล์ผู้สอน");
  }

  return Number(instructorId);
}

export async function assertCanAccessCourse(
  connection: PoolConnection,
  courseId: number,
  user: CurrentUser,
  permission: CourseAccessPermission = "view",
  message = "คุณไม่มีสิทธิ์จัดการหลักสูตรนี้",
) {
  if (user.role === "admin" || user.role === "staff") {
    const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [courseId],
    );
    if (!rows[0]) throw new Error("ไม่พบหลักสูตรที่ต้องการจัดการ");
    return;
  }

  const condition = instructorCourseAccessCondition("c", permission);
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT c.id
     FROM courses c
     WHERE c.id = ?
       AND c.deleted_at IS NULL
       AND ${condition}
     LIMIT 1`,
    [courseId, ...instructorCourseAccessValues(user.id)],
  );

  if (!rows[0]) {
    throw new Error(message);
  }
}
