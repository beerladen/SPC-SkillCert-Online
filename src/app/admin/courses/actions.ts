"use server";

import { revalidatePath } from "next/cache";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser, type CurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import type {
  CourseCategoryOption,
  PromotionDiscountType,
} from "@/lib/db-repositories";
import { saveValidatedUpload } from "@/lib/upload-security";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CategoryActionResult extends ActionResult {
  category?: CourseCategoryOption;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface SlugRow extends RowDataPacket {
  slug: string;
}

interface CourseIdentityRow extends RowDataPacket {
  title: string;
  slug: string;
}

type SqlParam = string | number | boolean | Date | null;

const fallbackCoverImage = "/images/spc-hero-vocational-training.png";
const courseCoverUploadPolicy = {
  maxBytes: 4 * 1024 * 1024,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
};
const certificateDocumentTypes = ["certificate", "honor_certificate"] as const;

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`กรุณากรอก ${key}`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`ข้อมูลตัวเลข ${key} ไม่ถูกต้อง`);
  }

  return value;
}

function requiredNumber(formData: FormData, key: string) {
  const value = optionalNumber(formData, key);

  if (value === null) {
    throw new Error(`กรุณากรอก ${key}`);
  }

  return value;
}

function normalizeDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length === 16 ? `${value.replace("T", " ")}:00` : value.replace("T", " ");
}

async function saveCoverImageUpload(formData: FormData, ownerSegment: string) {
  const uploadedCover = await saveValidatedUpload(formData.get("coverImageFile"), {
    rootFolder: "course-covers",
    publicBasePath: "/uploads/course-covers",
    ownerSegment,
    fallbackName: "course-cover",
    label: "ภาพปกหลักสูตร",
    ...courseCoverUploadPolicy,
  });

  return uploadedCover?.fileUrl ?? null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function makeUniqueSlug(
  connection: PoolConnection,
  requestedSlug: string | null,
  fallbackTitle: string,
  currentCourseId: number | null = null,
) {
  const baseSlug = slugify(requestedSlug || fallbackTitle) || `course-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const [rows] = await connection.execute<Array<SlugRow & { id: number }>>(
      "SELECT id, slug FROM courses WHERE slug = ? LIMIT 1",
      [candidate],
    );
    const match = rows[0];

    if (!match || (currentCourseId && Number(match.id) === currentCourseId)) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function assertExists(connection: PoolConnection, sql: string, values: SqlParam[]) {
  const [rows] = await connection.execute<IdRow[]>(sql, values);

  if (!rows[0]) {
    throw new Error("ข้อมูลอ้างอิงไม่ถูกต้อง");
  }
}

async function getOwnInstructorId(connection: PoolConnection, user: CurrentUser) {
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

async function assertCanManageCourse(
  connection: PoolConnection,
  courseId: number,
  user: CurrentUser,
) {
  if (user.role === "admin" || user.role === "staff") {
    await assertExists(
      connection,
      "SELECT id FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [courseId],
    );
    return;
  }

  const instructorId = await getOwnInstructorId(connection, user);
  await assertExists(
    connection,
    `SELECT c.id
     FROM courses c
     WHERE c.id = ?
       AND c.deleted_at IS NULL
       AND (
         c.instructor_id = ?
         OR EXISTS (
           SELECT 1
           FROM course_instructors ci
           WHERE ci.course_id = c.id
             AND ci.instructor_id = ?
             AND ci.can_edit = 1
         )
       )
     LIMIT 1`,
    [courseId, instructorId, instructorId],
  );
}

async function resolveInstructorIdForCourse(
  connection: PoolConnection,
  user: CurrentUser,
  requestedInstructorId: number | null,
  courseId: number | null,
) {
  if (user.role === "instructor") {
    const instructorId = await getOwnInstructorId(connection, user);
    if (courseId) {
      await assertCanManageCourse(connection, courseId, user);
      const [courseRows] = await connection.execute<Array<RowDataPacket & { instructor_id: number }>>(
        "SELECT instructor_id FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [courseId],
      );
      return Number(courseRows[0]?.instructor_id ?? instructorId);
    }
    return instructorId;
  }

  if (!requestedInstructorId) {
    throw new Error("กรุณาเลือกครูผู้สอน");
  }

  if (courseId) {
    const [currentRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id
       FROM courses
       WHERE id = ?
         AND instructor_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [courseId, requestedInstructorId],
    );

    if (currentRows[0]) {
      return requestedInstructorId;
    }
  }

  await assertExists(
    connection,
    `SELECT i.id
     FROM instructors i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = ?
       AND i.status = 'active'
       AND u.status = 'active'
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [requestedInstructorId],
  );

  return requestedInstructorId;
}

function parseNumberList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

async function syncCourseInstructors(
  connection: PoolConnection,
  courseId: number,
  primaryInstructorId: number,
  coInstructorIds?: number[],
) {
  await connection.execute<ResultSetHeader>(
    `DELETE FROM course_instructors
     WHERE course_id = ?
       AND role = 'primary'
       AND instructor_id <> ?`,
    [courseId, primaryInstructorId],
  );

  await connection.execute<ResultSetHeader>(
    `INSERT INTO course_instructors (course_id, instructor_id, role, can_edit, can_grade, sort_order)
     VALUES (?, ?, 'primary', 1, 1, 0)
     ON DUPLICATE KEY UPDATE role = 'primary', can_edit = 1, can_grade = 1, sort_order = 0`,
    [courseId, primaryInstructorId],
  );

  if (!coInstructorIds) {
    return;
  }

  const uniqueCoInstructorIds = Array.from(new Set(coInstructorIds)).filter(
    (instructorId) => instructorId !== primaryInstructorId,
  );

  if (uniqueCoInstructorIds.length > 0) {
    const placeholders = uniqueCoInstructorIds.map(() => "?").join(",");
    const [rows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM instructors i
       JOIN users u ON u.id = i.user_id
       WHERE i.id IN (${placeholders})
         AND i.status = 'active'
         AND u.status = 'active'
         AND u.deleted_at IS NULL`,
      uniqueCoInstructorIds,
    );

    if (Number(rows[0]?.total ?? 0) !== uniqueCoInstructorIds.length) {
      throw new Error("พบผู้สอนร่วมที่ไม่พร้อมใช้งาน กรุณาตรวจสอบรายชื่ออีกครั้ง");
    }
  }

  await connection.execute<ResultSetHeader>(
    "DELETE FROM course_instructors WHERE course_id = ? AND role = 'co_instructor'",
    [courseId],
  );

  for (const [index, coInstructorId] of uniqueCoInstructorIds.entries()) {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO course_instructors (course_id, instructor_id, role, can_edit, can_grade, sort_order)
       VALUES (?, ?, 'co_instructor', 1, 1, ?)
       ON DUPLICATE KEY UPDATE role = 'co_instructor', can_edit = 1, can_grade = 1, sort_order = VALUES(sort_order)`,
      [courseId, coInstructorId, index + 1],
    );
  }
}

function calculateRegistrationFee({
  baseFee,
  discountType,
  discountValue,
}: {
  baseFee: number;
  discountType: PromotionDiscountType | null;
  discountValue: number;
}) {
  if (!discountType || discountValue <= 0) {
    return baseFee;
  }

  const discountAmount =
    discountType === "percent" ? baseFee * Math.min(discountValue, 100) / 100 : discountValue;

  return Math.max(0, Math.round((baseFee - discountAmount) * 100) / 100);
}

export async function createCategoryAction(formData: FormData): Promise<CategoryActionResult> {
  await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    const name = requiredString(formData, "categoryName");
    const icon = optionalString(formData, "categoryIcon") ?? "📚";
    const description = optionalString(formData, "categoryDescription");
    const requestedSlug = optionalString(formData, "categorySlug");
    const slug = slugify(requestedSlug || name) || `category-${Date.now()}`;

    const [existingRows] = await connection.execute<
      Array<RowDataPacket & CourseCategoryOption>
    >("SELECT id, name, slug, icon, description FROM categories WHERE name = ? OR slug = ? LIMIT 1", [
      name,
      slug,
    ]);

    if (existingRows[0]) {
      return {
        ok: true,
        message: "พบหมวดหมู่เดิมในระบบ",
        category: {
          id: Number(existingRows[0].id),
          name: existingRows[0].name,
          slug: existingRows[0].slug,
          icon: existingRows[0].icon,
          description: existingRows[0].description,
        },
      };
    }

    const [sortRows] = await connection.execute<Array<RowDataPacket & { sort_order: number }>>(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM categories",
    );

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO categories (name, slug, icon, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [name, slug, icon, description, Number(sortRows[0]?.sort_order ?? 1)],
    );

    const category = {
      id: result.insertId,
      name,
      slug,
      icon,
      description,
    };

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/");

    return {
      ok: true,
      message: "เพิ่มหมวดหมู่แล้ว",
      category,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "เพิ่มหมวดหมู่ไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveCourseAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = optionalNumber(formData, "courseId");
    const title = requiredString(formData, "title");
    const categoryId = requiredNumber(formData, "categoryId");
    const requestedInstructorId = optionalNumber(formData, "instructorId");
    const coInstructorIds = parseNumberList(formData.get("coInstructorIds"));
    const status = requiredString(formData, "status");
    const format = requiredString(formData, "format");
    const level = requiredString(formData, "level");
    const durationHours = requiredNumber(formData, "durationHours");
    const capacity = optionalNumber(formData, "capacity");
    const baseFee = requiredNumber(formData, "baseFee");
    const shortDescription = optionalString(formData, "shortDescription");
    const description = optionalString(formData, "description");
    const coverImageUrl =
      (await saveCoverImageUpload(
        formData,
        courseId ? `course-${courseId}` : slugify(optionalString(formData, "slug") || title) || "new-course",
      )) ??
      optionalString(formData, "coverImageUrl") ??
      fallbackCoverImage;
    const startsAt = normalizeDateTime(optionalString(formData, "startsAt"));
    const endsAt = normalizeDateTime(optionalString(formData, "endsAt"));
    const promotionEnabled = formData.get("promotionEnabled") === "on";
    const promotionId = optionalNumber(formData, "promotionId");
    const certificateDocumentType = requiredString(formData, "certificateDocumentType");
    const discountType = promotionEnabled
      ? (requiredString(formData, "discountType") as PromotionDiscountType)
      : null;
    const discountValue = promotionEnabled ? requiredNumber(formData, "discountValue") : 0;

    if (!["draft", "open", "nearly_full", "closed", "archived"].includes(status)) {
      throw new Error("สถานะหลักสูตรไม่ถูกต้อง");
    }
    if (!["online", "live_online", "recorded"].includes(format)) {
      throw new Error("รูปแบบการเรียนไม่ถูกต้อง");
    }
    if (!["beginner", "intermediate", "advanced"].includes(level)) {
      throw new Error("ระดับหลักสูตรไม่ถูกต้อง");
    }
    if (discountType && !["amount", "percent"].includes(discountType)) {
      throw new Error("รูปแบบส่วนลดไม่ถูกต้อง");
    }
    if (!certificateDocumentTypes.includes(certificateDocumentType as (typeof certificateDocumentTypes)[number])) {
      throw new Error("รูปแบบเอกสารใบประกาศไม่ถูกต้อง");
    }
    if (baseFee < 0 || discountValue < 0) {
      throw new Error("ค่าลงทะเบียนและส่วนลดต้องไม่ติดลบ");
    }

    await assertExists(connection, "SELECT id FROM categories WHERE id = ? LIMIT 1", [categoryId]);
    const instructorId = await resolveInstructorIdForCourse(
      connection,
      currentUser,
      requestedInstructorId,
      courseId,
    );

    const slug = await makeUniqueSlug(
      connection,
      optionalString(formData, "slug"),
      title,
      courseId,
    );
    const durationMinutes = Math.max(0, Math.round(durationHours * 60));
    const registrationFee = calculateRegistrationFee({
      baseFee,
      discountType,
      discountValue,
    });
    const originalFee = promotionEnabled && registrationFee < baseFee ? baseFee : null;
    const publishedAt = ["open", "nearly_full"].includes(status) ? new Date() : null;

    let savedCourseId = courseId;

    if (courseId) {
      await connection.execute<ResultSetHeader>(
        `UPDATE courses
         SET category_id = ?,
             instructor_id = ?,
             title = ?,
             slug = ?,
             short_description = ?,
             description = ?,
             cover_image_url = ?,
             registration_fee = ?,
             original_fee = ?,
             duration_minutes = ?,
             capacity = ?,
             format = ?,
             level = ?,
             status = ?,
             starts_at = ?,
             ends_at = ?,
             published_at = COALESCE(published_at, ?)
         WHERE id = ?`,
        [
          categoryId,
          instructorId,
          title,
          slug,
          shortDescription,
          description,
          coverImageUrl,
          registrationFee,
          originalFee,
          durationMinutes,
          capacity,
          format,
          level,
          status,
          startsAt,
          endsAt,
          publishedAt,
          courseId,
        ],
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO courses (
          category_id, instructor_id, title, slug, short_description, description,
          cover_image_url, registration_fee, original_fee, duration_minutes, capacity,
          format, level, status, starts_at, ends_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          categoryId,
          instructorId,
          title,
          slug,
          shortDescription,
          description,
          coverImageUrl,
          registrationFee,
          originalFee,
          durationMinutes,
          capacity,
          format,
          level,
          status,
          startsAt,
          endsAt,
          publishedAt,
        ],
      );
      savedCourseId = result.insertId;
    }

    if (!savedCourseId) {
      throw new Error("ไม่พบหลักสูตรที่ต้องการบันทึก");
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO course_completion_rules (
         course_id,
         required_progress_percent,
         required_post_test_score,
         require_all_assignments,
         certificate_enabled,
         certificate_document_type
       )
       VALUES (?, 80, 70, TRUE, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         certificate_document_type = VALUES(certificate_document_type)`,
      [savedCourseId, certificateDocumentType],
    );

    await syncCourseInstructors(
      connection,
      savedCourseId,
      instructorId,
      currentUser.role === "admin" || currentUser.role === "staff" ? coInstructorIds : undefined,
    );

    if (promotionEnabled) {
      const promotionName =
        optionalString(formData, "promotionName") ?? `ส่วนลด ${title}`;
      const promotionDescription = optionalString(formData, "promotionDescription");
      const promotionStartsAt = normalizeDateTime(optionalString(formData, "promotionStartsAt"));
      const promotionEndsAt = normalizeDateTime(optionalString(formData, "promotionEndsAt"));
      const promotionStatus = formData.get("promotionStatus") === "inactive" ? "inactive" : "active";
      let savedPromotionId = promotionId;

      if (promotionId) {
        await connection.execute<ResultSetHeader>(
          `UPDATE promotions
           SET name = ?,
               description = ?,
               discount_type = ?,
               discount_value = ?,
               starts_at = ?,
               ends_at = ?,
               status = ?
           WHERE id = ?`,
          [
            promotionName,
            promotionDescription,
            discountType,
            discountValue,
            promotionStartsAt,
            promotionEndsAt,
            promotionStatus,
            promotionId,
          ],
        );
      } else {
        const [promotionResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO promotions (
            name, description, discount_type, discount_value, starts_at, ends_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            promotionName,
            promotionDescription,
            discountType,
            discountValue,
            promotionStartsAt,
            promotionEndsAt,
            promotionStatus,
          ],
        );
        savedPromotionId = promotionResult.insertId;
      }

      await connection.execute<ResultSetHeader>(
        `INSERT INTO course_promotions (course_id, promotion_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE promotion_id = VALUES(promotion_id)`,
        [savedCourseId, savedPromotionId],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        "DELETE FROM course_promotions WHERE course_id = ?",
        [savedCourseId],
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO audit_logs (action, entity_type, entity_id, detail_json)
       VALUES (?, 'course', ?, JSON_OBJECT('title', ?, 'slug', ?))`,
      [courseId ? "course.updated" : "course.created", savedCourseId, title, slug],
    );

    await connection.commit();

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath(`/courses/${slug}`);
    revalidatePath("/");

    return {
      ok: true,
      message: courseId ? "บันทึกการแก้ไขหลักสูตรแล้ว" : "เพิ่มหลักสูตรใหม่แล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกหลักสูตรไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function archiveCourseAction(courseId: number): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await assertCanManageCourse(connection, courseId, currentUser);
    await connection.execute<ResultSetHeader>(
      "UPDATE courses SET status = 'archived' WHERE id = ? AND deleted_at IS NULL",
      [courseId],
    );
    await connection.execute<ResultSetHeader>(
      `INSERT INTO audit_logs (action, entity_type, entity_id)
       VALUES ('course.archived', 'course', ?)`,
      [courseId],
    );

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/");

    return {
      ok: true,
      message: "เก็บหลักสูตรเข้าคลังแล้ว",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "เก็บหลักสูตรไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteCourseAction(courseId: number): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await assertCanManageCourse(connection, courseId, currentUser);

    const [courseRows] = await connection.execute<CourseIdentityRow[]>(
      "SELECT title, slug FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1",
      [courseId],
    );
    const course = courseRows[0];

    if (!course) {
      await connection.rollback();
      return {
        ok: false,
        message: "ไม่พบหลักสูตรที่ต้องการลบ หรือหลักสูตรนี้ถูกลบไปแล้ว",
      };
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE courses SET status = 'archived', deleted_at = NOW() WHERE id = ?",
      [courseId],
    );
    await connection.execute<ResultSetHeader>(
      `INSERT INTO audit_logs (action, entity_type, entity_id, detail_json)
       VALUES ('course.deleted', 'course', ?, JSON_OBJECT('title', ?, 'slug', ?))`,
      [courseId, course.title, course.slug],
    );

    await connection.commit();

    revalidatePath("/admin/courses");
    revalidatePath("/admin/learning");
    revalidatePath("/courses");
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath("/my-learning");
    revalidatePath("/");

    return {
      ok: true,
      message: "ลบหลักสูตรออกจากระบบแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบหลักสูตรไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
