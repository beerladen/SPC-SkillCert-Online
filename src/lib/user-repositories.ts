import bcrypt from "bcryptjs";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, getPool, queryRows } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import type { UserRole } from "@/lib/auth";
import { assertUniqueUserIdentity, normalizePhone } from "@/lib/user-identity";

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled" | "pending";
  phone: string | null;
  citizenId: string | null;
  address: string | null;
  lastLoginAt: string;
  createdAt: string;
  enrollmentCount: number;
  registrationCount: number;
  certificateCount: number;
  courseCount: number;
  isInstructor: boolean;
  instructorId: number | null;
  instructorPosition: string | null;
  instructorSignatureUrl: string | null;
  canRemove: boolean;
  removeHelp: string;
}

async function getUserDeletionBlockers(connection: PoolConnection, userId: number) {
  const [courseRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(DISTINCT scoped.course_id) AS total
     FROM (
       SELECT c.id AS course_id
       FROM instructors i
       JOIN courses c ON c.instructor_id = i.id
       WHERE i.user_id = ?
       UNION
       SELECT ci.course_id
       FROM instructors i
       JOIN course_instructors ci ON ci.instructor_id = i.id
       WHERE i.user_id = ?
     ) scoped`,
    [userId, userId],
  );

  const [certificateRows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
     FROM certificates cert
     JOIN enrollments e ON e.id = cert.enrollment_id
     WHERE e.user_id = ?`,
    [userId],
  );

  return {
    courseCount: Number(courseRows[0]?.total ?? 0),
    certificateCount: Number(certificateRows[0]?.total ?? 0),
  };
}

async function hardDeleteUserData(connection: PoolConnection, userId: number) {
  await connection.execute<ResultSetHeader>("DELETE FROM user_sessions WHERE user_id = ?", [
    userId,
  ]);
  await connection.execute<ResultSetHeader>("DELETE FROM password_reset_tokens WHERE user_id = ?", [
    userId,
  ]);
  await connection.execute<ResultSetHeader>("DELETE FROM registrations WHERE user_id = ?", [
    userId,
  ]);
  await connection.execute<ResultSetHeader>("DELETE FROM enrollments WHERE user_id = ?", [userId]);
  await connection.execute<ResultSetHeader>(
    "UPDATE instructors SET status = 'inactive' WHERE user_id = ?",
    [userId],
  );
  await connection.execute<ResultSetHeader>("DELETE FROM users WHERE id = ?", [userId]);
}

async function purgeDeletedUserWithConnection(connection: PoolConnection, userId: number) {
  const blockers = await getUserDeletionBlockers(connection, userId);
  if (blockers.courseCount > 0 || blockers.certificateCount > 0) {
    return false;
  }

  await hardDeleteUserData(connection, userId);
  return true;
}

export async function purgeDeletedUsersByIdentity(input: {
  email?: string;
  phone?: string | null;
}) {
  const email = input.email?.trim().toLowerCase();
  const phone = normalizePhone(input.phone);

  if (!email && !phone) return 0;

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT DISTINCT u.id
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.deleted_at IS NOT NULL
         AND (
           (? IS NOT NULL AND LOWER(u.email) = LOWER(?))
           OR
           (? IS NOT NULL AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.phone, '-', ''), ' ', ''), '(', ''), ')', ''), '.', '') = ?)
         )`,
      [email ?? null, email ?? null, phone, phone],
    );

    let purged = 0;
    for (const row of rows) {
      const ok = await purgeDeletedUserWithConnection(connection, Number(row.id));
      if (ok) purged += 1;
    }

    await connection.commit();
    return purged;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getAdminUserRows(): Promise<AdminUserRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.last_login_at, u.created_at,
            p.phone, p.citizen_id, p.address,
            i.id AS instructor_id, i.position AS instructor_position, i.signature_url AS instructor_signature_url,
            i.status AS instructor_status,
            COUNT(DISTINCT e.id) AS enrollment_count,
            COUNT(DISTINCT r.id) AS registration_count,
            COUNT(DISTINCT cert.id) AS certificate_count,
            COUNT(DISTINCT c.id) AS course_count
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN enrollments e ON e.user_id = u.id
     LEFT JOIN registrations r ON r.user_id = u.id AND r.deleted_at IS NULL
     LEFT JOIN certificates cert ON cert.enrollment_id = e.id
     LEFT JOIN instructors i ON i.user_id = u.id
     LEFT JOIN courses c ON c.instructor_id = i.id
     WHERE u.deleted_at IS NULL
     GROUP BY u.id, p.id, i.id, i.position, i.signature_url, i.status
     ORDER BY FIELD(u.role, 'admin', 'staff', 'instructor', 'student'), u.created_at DESC`,
  );

  return rows.map((row) => {
    const courseCount = Number(row.course_count ?? 0);
    const certificateCount = Number(row.certificate_count ?? 0);
    const isInstructor = row.instructor_id !== null && row.instructor_status === "active";

    return {
    courseCount,
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    phone: row.phone,
    citizenId: row.citizen_id,
    address: row.address,
    lastLoginAt: formatDateTime(row.last_login_at),
    createdAt: formatDateTime(row.created_at),
    enrollmentCount: Number(row.enrollment_count ?? 0),
    registrationCount: Number(row.registration_count ?? 0),
    certificateCount,
    isInstructor,
    instructorId: row.instructor_id === null ? null : Number(row.instructor_id),
    instructorPosition: row.instructor_position,
    instructorSignatureUrl: row.instructor_signature_url,
    canRemove: row.role !== "admin" && courseCount === 0 && certificateCount === 0,
    removeHelp:
      row.role === "admin"
        ? "ไม่สามารถลบผู้ดูแลระบบหลักจากหน้านี้ได้"
        : courseCount > 0
          ? "บัญชีนี้ยังผูกกับหลักสูตรอยู่ กรุณาโอนย้ายผู้สอนหรือจัดการหลักสูตรก่อนลบ"
          : certificateCount > 0
            ? "บัญชีนี้มีใบประกาศผูกอยู่ จึงไม่ควรลบถาวรจากฐานข้อมูล"
            : "ลบสมาชิกออกจากฐานข้อมูลถาวรและปล่อยอีเมล/เบอร์โทรให้สมัครใหม่ได้",
    };
  });
}

export async function saveAdminUser(input: {
  id?: number;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled" | "pending";
  phone: string;
  citizenId: string;
  address: string;
  password?: string;
  isInstructor?: boolean;
  instructorPosition?: string;
  instructorSignatureUrl?: string | null;
}) {
  let userId = input.id ?? 0;
  const phone = input.phone.trim() || null;
  const shouldBeInstructor = input.role === "instructor" || input.isInstructor === true;
  const instructorPosition = input.instructorPosition?.trim() || "ผู้สอน";
  const instructorSignatureUrl = input.instructorSignatureUrl?.trim() || null;

  if (!input.id) {
    await purgeDeletedUsersByIdentity({
      email: input.email,
      phone,
    });
  }

  await assertUniqueUserIdentity({
    email: input.email,
    phone,
    excludeUserId: input.id,
  });

  if (input.id) {
    const [result] = await executeQuery<ResultSetHeader>(
      "UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ? AND deleted_at IS NULL",
      [input.name, input.email, input.role, input.status, input.id],
    );
    if (result.affectedRows === 0) {
      throw new Error("ไม่พบบัญชีผู้ใช้งาน หรือบัญชีนี้ถูกลบแล้ว");
    }
  } else {
    if (!input.password || input.password.length < 8) {
      throw new Error("กรุณากำหนดรหัสผ่านเริ่มต้นอย่างน้อย 8 ตัวอักษร");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [input.name, input.email, passwordHash, input.role, input.status],
    );
    userId = result.insertId;
  }

  await executeQuery<ResultSetHeader>(
    `INSERT INTO profiles (user_id, citizen_id, phone, address)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       citizen_id = VALUES(citizen_id),
       phone = VALUES(phone),
       address = VALUES(address)`,
    [userId, input.citizenId || null, phone, input.address || null],
  );

  if (shouldBeInstructor) {
    await executeQuery<ResultSetHeader>(
      `INSERT INTO instructors (user_id, display_name, position)
       VALUES (?, ?, 'ผู้สอน')
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      [userId, input.name],
    );
  }

  if (shouldBeInstructor) {
    await executeQuery<ResultSetHeader>(
      "UPDATE instructors SET position = ?, signature_url = ?, status = 'active' WHERE user_id = ?",
      [instructorPosition, instructorSignatureUrl, userId],
    );
  } else {
    const courseRows = await queryRows<RowDataPacket>(
      `SELECT COUNT(*) AS total
       FROM instructors i
       JOIN courses c ON c.instructor_id = i.id AND c.deleted_at IS NULL
       WHERE i.user_id = ?`,
      [userId],
    );
    if (Number(courseRows[0]?.total ?? 0) > 0) {
      throw new Error("บัญชีนี้ยังเป็นผู้สอนของหลักสูตรอยู่ กรุณาโอนย้ายหลักสูตรก่อนปิดสถานะครูผู้สอน");
    }
    await executeQuery<ResultSetHeader>(
      "UPDATE instructors SET status = 'inactive' WHERE user_id = ?",
      [userId],
    );
  }

  return userId;
}

export interface InstructorOwnProfile {
  userId: number;
  userName: string;
  email: string;
  instructorId: number;
  displayName: string;
  position: string | null;
  bio: string | null;
  signatureUrl: string | null;
}

export async function getOwnInstructorProfile(userId: number): Promise<InstructorOwnProfile | null> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT u.id AS user_id, u.name AS user_name, u.email,
            i.id AS instructor_id, i.display_name, i.position, i.bio, i.signature_url
     FROM users u
     JOIN instructors i ON i.user_id = u.id
     WHERE u.id = ?
       AND u.deleted_at IS NULL
       AND u.status = 'active'
       AND i.status = 'active'
     LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    userId: Number(row.user_id),
    userName: row.user_name,
    email: row.email,
    instructorId: Number(row.instructor_id),
    displayName: row.display_name,
    position: row.position,
    bio: row.bio,
    signatureUrl: row.signature_url,
  };
}

export async function saveOwnInstructorProfile(input: {
  userId: number;
  displayName: string;
  position: string;
  bio: string;
  signatureUrl: string | null;
}) {
  const [result] = await executeQuery<ResultSetHeader>(
    `UPDATE instructors i
     JOIN users u ON u.id = i.user_id
     SET i.display_name = ?, i.position = ?, i.bio = ?, i.signature_url = ?
     WHERE i.user_id = ?
       AND i.status = 'active'
       AND u.status = 'active'
       AND u.deleted_at IS NULL`,
    [
      input.displayName.trim(),
      input.position.trim() || "ผู้สอน",
      input.bio.trim() || null,
      input.signatureUrl,
      input.userId,
    ],
  );

  if (result.affectedRows === 0) {
    throw new Error("บัญชีนี้ยังไม่ถูกกำหนดเป็นครูผู้สอน หรือถูกปิดใช้งานแล้ว");
  }
}

export async function resetUserPassword(userId: number, password: string) {
  if (!password || password.length < 8) {
    throw new Error("กรุณากำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await executeQuery<ResultSetHeader>(
    "UPDATE users SET password_hash = ? WHERE id = ? AND deleted_at IS NULL",
    [passwordHash, userId],
  );
  if (result.affectedRows === 0) {
    throw new Error("ไม่พบบัญชีผู้ใช้งาน หรือบัญชีนี้ถูกลบแล้ว");
  }
  await executeQuery<ResultSetHeader>("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}

export async function safelyRemoveUser(input: {
  targetUserId: number;
  currentUserId: number;
  reason: string;
}) {
  if (input.targetUserId === input.currentUserId) {
    return {
      ok: false,
      message: "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้",
    };
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute<
      Array<RowDataPacket & { id: number; role: UserRole; name: string; email: string }>
    >(
      "SELECT id, role, name, email FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [input.targetUserId],
    );
    const user = userRows[0];

    if (!user) {
      await connection.rollback();
      return {
        ok: false,
        message: "ไม่พบบัญชีผู้ใช้งาน หรือบัญชีนี้ถูกลบไปแล้ว",
      };
    }

    if (user.role === "admin") {
      await connection.rollback();
      return {
        ok: false,
        message: "ไม่อนุญาตให้ลบผู้ดูแลระบบหลักจากหน้านี้",
      };
    }

    const blockers = await getUserDeletionBlockers(connection, input.targetUserId);

    if (blockers.courseCount > 0) {
      await connection.rollback();
      return {
        ok: false,
        message: "บัญชีครูผู้สอนนี้ยังมีหลักสูตรอยู่ กรุณาโอนย้ายผู้สอนหรือเก็บบัญชีเป็นปิดใช้งานก่อน",
      };
    }

    if (blockers.certificateCount > 0) {
      await connection.rollback();
      return {
        ok: false,
        message: "บัญชีนี้มีใบประกาศผูกอยู่ จึงไม่สามารถลบถาวรได้ กรุณาตรวจสอบใบประกาศหรือเพิกถอนก่อน",
      };
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
       VALUES (?, 'user.hard_deleted', 'user', ?, JSON_OBJECT('name', ?, 'email', ?, 'reason', ?))`,
      [
        input.currentUserId,
        input.targetUserId,
        user.name,
        user.email,
        input.reason || "removed from admin users",
      ],
    );
    await hardDeleteUserData(connection, input.targetUserId);

    await connection.commit();

    return {
      ok: true,
      message: "ลบสมาชิกออกจากฐานข้อมูลถาวรแล้ว อีเมลและเบอร์โทรนี้สามารถสมัครใหม่ได้",
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบบัญชีผู้ใช้งานไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
