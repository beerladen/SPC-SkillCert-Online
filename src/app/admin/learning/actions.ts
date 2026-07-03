"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { revalidatePath } from "next/cache";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser, type CurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import type { LearningTaskType } from "@/lib/learning-repositories";
import { isUploadFileEntry } from "@/lib/upload-security";

interface ActionResult {
  ok: boolean;
  message: string;
}

const taskTypes: LearningTaskType[] = ["worksheet", "practice"];
const taskStatuses = ["draft", "published", "archived"];
const submissionModes = ["file", "link", "file_or_link", "text"];
const ruleCriteria = ["lesson_progress", "pre_test", "post_test", "worksheet", "practice"];
const maxTaskUploadSizeBytes = 25 * 1024 * 1024;
const allowedTaskUploadExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
  ".mov",
  ".zip",
  ".rar",
  ".txt",
  ".csv",
]);

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? value : null;
}

function numberValue(formData: FormData, key: string, fallback: number | null = null) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`ข้อมูลตัวเลข ${key} ไม่ถูกต้อง`);
  }
  return value;
}

function requiredNumber(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  if (value === null) throw new Error(`กรุณาระบุ ${key}`);
  return value;
}

function oneOf<T extends string>(value: string, allowed: T[], fallback: T) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function safeUploadFileName(value: string, fallback = "task-file") {
  const parsed = parse(value || fallback);
  const name =
    parsed.name
      .normalize("NFKD")
      .replace(/[^\w\u0E00-\u0E7F-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || fallback;
  return `${name}${parsed.ext.toLowerCase()}`;
}

function inferAttachmentFileType(fileName: string, mimeType: string) {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if ([".doc", ".docx", ".ppt", ".pptx"].includes(extension)) return "doc";
  if ([".xls", ".xlsx", ".csv"].includes(extension)) return "sheet";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
}

async function saveTaskUpload(
  formData: FormData,
  key: string,
  courseId: number,
  folder: string,
) {
  const fileEntry = formData.get(key);

  if (!isUploadFileEntry(fileEntry)) {
    return null;
  }

  const extension = extname(fileEntry.name).toLowerCase();

  if (fileEntry.size > maxTaskUploadSizeBytes) {
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 25MB");
  }

  if (!allowedTaskUploadExtensions.has(extension)) {
    throw new Error("รองรับไฟล์ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอสั้น, ZIP, TXT และ CSV");
  }

  const uploadFolder = `learning-tasks/${courseId}/${folder}`;
  const uploadDir = join(process.cwd(), "public", "uploads", uploadFolder);
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeUploadFileName(fileEntry.name)}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, storedFileName), Buffer.from(await fileEntry.arrayBuffer()));

  return {
    fileName: fileEntry.name,
    fileSize: formatFileSize(fileEntry.size),
    fileType: inferAttachmentFileType(fileEntry.name, fileEntry.type),
    fileUrl: `/uploads/${uploadFolder}/${storedFileName}`,
  };
}

async function resolveNextTaskSortOrder(
  connection: PoolConnection,
  courseId: number,
  taskType: LearningTaskType,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { sort_order: number }>>(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM learning_tasks WHERE course_id = ? AND task_type = ?",
    [courseId, taskType],
  );
  return Number(rows[0]?.sort_order ?? 1);
}

async function assertCourseExists(
  connection: PoolConnection,
  courseId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    "SELECT id FROM courses WHERE id = ? LIMIT 1",
    [courseId],
  );
  if (!rows[0]) throw new Error("ไม่พบหลักสูตรที่ต้องการจัดการ");
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
    await assertCourseExists(connection, courseId);
    return;
  }

  const instructorId = await getOwnInstructorId(connection, user);
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
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

  if (!rows[0]) {
    throw new Error("คุณไม่มีสิทธิ์จัดการหลักสูตรนี้");
  }
}

async function syncTaskAttachments(
  connection: PoolConnection,
  taskId: number,
  formData: FormData,
) {
  await connection.execute("DELETE FROM learning_task_attachments WHERE task_id = ?", [taskId]);

  const attachmentUrl = optionalText(formData, "attachmentUrl");
  if (!attachmentUrl) return;

  await connection.execute(
    `INSERT INTO learning_task_attachments
       (task_id, title, file_url, file_name, file_type, sort_order)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      taskId,
      optionalText(formData, "attachmentTitle") ?? "ไฟล์ประกอบ",
      attachmentUrl,
      optionalText(formData, "attachmentFileName"),
      oneOf(text(formData, "attachmentFileType"), ["pdf", "doc", "sheet", "image", "link", "other"], "other"),
    ],
  );
}

async function syncTaskRubrics(
  connection: PoolConnection,
  taskId: number,
  formData: FormData,
) {
  await connection.execute("DELETE FROM learning_task_rubrics WHERE task_id = ?", [taskId]);

  for (let index = 1; index <= 4; index += 1) {
    const title = text(formData, `rubricTitle${index}`);
    const maxScore = numberValue(formData, `rubricScore${index}`, 0) ?? 0;
    if (!title || maxScore <= 0) continue;

    await connection.execute(
      `INSERT INTO learning_task_rubrics
         (task_id, title, description, max_score, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [taskId, title, optionalText(formData, `rubricDescription${index}`), maxScore, index],
    );
  }
}

function revalidateLearning(courseSlug?: string | null) {
  revalidatePath("/admin/learning");
  revalidatePath("/admin/assessments");
  revalidatePath("/my-learning");
  if (courseSlug) {
    revalidatePath(`/my-learning/${courseSlug}`);
  }
}

export async function saveLearningTaskAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const taskId = numberValue(formData, "taskId");
    const courseId = requiredNumber(formData, "courseId");
    const taskType = oneOf(text(formData, "taskType"), taskTypes, "worksheet");
    const title = text(formData, "title");
    if (!title) throw new Error("กรุณากรอกชื่อใบงาน/แบบฝึก");

    await assertCanManageCourse(connection, courseId, currentUser);

    const instructionUpload = await saveTaskUpload(
      formData,
      "instructionFile",
      courseId,
      "instructions",
    );
    const attachmentUpload = await saveTaskUpload(
      formData,
      "attachmentFile",
      courseId,
      "attachments",
    );

    if (instructionUpload) {
      formData.set("instructionFileUrl", instructionUpload.fileUrl);
      formData.set("instructionFileName", instructionUpload.fileName);
    }

    if (attachmentUpload) {
      formData.set("attachmentUrl", attachmentUpload.fileUrl);
      formData.set("attachmentFileName", attachmentUpload.fileName);
      formData.set("attachmentFileType", attachmentUpload.fileType);
      formData.set("resourceUrl", attachmentUpload.fileUrl);

      if (!optionalText(formData, "attachmentTitle")) {
        formData.set("attachmentTitle", attachmentUpload.fileName);
      }
    }

    const sortOrder =
      numberValue(formData, "sortOrder") ??
      (await resolveNextTaskSortOrder(connection, courseId, taskType));
    const sectionId = numberValue(formData, "sectionId");
    const lessonId = numberValue(formData, "lessonId");
    const assessmentId = numberValue(formData, "assessmentId");
    const description = optionalText(formData, "description");
    const instructionHtml = optionalText(formData, "instructionHtml");
    const instructionFileUrl = optionalText(formData, "instructionFileUrl");
    const instructionFileName = optionalText(formData, "instructionFileName");
    const resourceUrl =
      optionalText(formData, "resourceUrl") ?? optionalText(formData, "attachmentUrl");
    const submissionMode = oneOf(text(formData, "submissionMode"), submissionModes, "file_or_link");
    const maxScore = numberValue(formData, "maxScore", 100) ?? 100;
    const defaultPassingScore = Math.round(maxScore * 70) / 100;
    const passingScore =
      numberValue(formData, "passingScore", defaultPassingScore) ?? defaultPassingScore;

    if (passingScore > maxScore) {
      throw new Error("คะแนนผ่านต้องไม่มากกว่าคะแนนเต็ม เช่น คะแนนเต็ม 20 ให้กรอกผ่าน 14 หากต้องการเกณฑ์ 70%");
    }

    const weightPercent = numberValue(formData, "weightPercent", 0) ?? 0;
    const dueDays = numberValue(formData, "dueDaysAfterEnrollment");
    const allowResubmission = formData.get("allowResubmission") === "on";
    const requireEvidence = formData.get("requireEvidence") === "on";
    const evidenceRequiredCount = numberValue(formData, "evidenceRequiredCount", 0) ?? 0;
    const status = oneOf(text(formData, "status"), taskStatuses, "draft");

    let savedTaskId = taskId;
    if (taskId) {
      await connection.execute(
        `UPDATE learning_tasks
         SET course_id = ?, section_id = ?, lesson_id = ?, assessment_id = ?,
             task_type = ?, title = ?, description = ?, instruction_html = ?,
             instruction_file_url = ?, instruction_file_name = ?, resource_url = ?,
             submission_mode = ?, max_score = ?, passing_score = ?, weight_percent = ?,
             due_days_after_enrollment = ?, allow_resubmission = ?,
             require_evidence = ?, evidence_required_count = ?,
             status = ?, sort_order = ?, deleted_at = NULL
         WHERE id = ?`,
        [
          courseId,
          sectionId,
          lessonId,
          assessmentId,
          taskType,
          title,
          description,
          instructionHtml,
          instructionFileUrl,
          instructionFileName,
          resourceUrl,
          submissionMode,
          maxScore,
          passingScore,
          weightPercent,
          dueDays,
          allowResubmission,
          requireEvidence,
          evidenceRequiredCount,
          status,
          sortOrder,
          taskId,
        ],
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_tasks (
           course_id, section_id, lesson_id, assessment_id, task_type, title,
           description, instruction_html, instruction_file_url, instruction_file_name,
           resource_url, submission_mode, max_score, passing_score, weight_percent,
           due_days_after_enrollment, allow_resubmission, require_evidence,
           evidence_required_count, status, sort_order
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          sectionId,
          lessonId,
          assessmentId,
          taskType,
          title,
          description,
          instructionHtml,
          instructionFileUrl,
          instructionFileName,
          resourceUrl,
          submissionMode,
          maxScore,
          passingScore,
          weightPercent,
          dueDays,
          allowResubmission,
          requireEvidence,
          evidenceRequiredCount,
          status,
          sortOrder,
        ],
      );
      savedTaskId = result.insertId;
    }

    if (!savedTaskId) throw new Error("ไม่สามารถบันทึกรายการงานได้");
    await syncTaskAttachments(connection, savedTaskId, formData);
    await syncTaskRubrics(connection, savedTaskId, formData);

    const [slugRows] = await connection.execute<Array<RowDataPacket & { slug: string }>>(
      "SELECT slug FROM courses WHERE id = ? LIMIT 1",
      [courseId],
    );

    await connection.commit();
    revalidateLearning(slugRows[0]?.slug);

    return {
      ok: true,
      message: taskId ? "บันทึกการแก้ไขรายการแล้ว" : "เพิ่มรายการใหม่แล้ว",
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function archiveLearningTaskAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const taskId = requiredNumber(formData, "taskId");
    const [rows] = await connection.execute<Array<RowDataPacket & { id: number; slug: string }>>(
      `SELECT c.id, c.slug
       FROM learning_tasks t
       JOIN courses c ON c.id = t.course_id
       WHERE t.id = ?
       LIMIT 1`,
      [taskId],
    );
    if (!rows[0]) throw new Error("ไม่พบรายการที่ต้องการปิดใช้งาน");

    await assertCanManageCourse(connection, Number(rows[0].id), currentUser);

    await connection.execute(
      "UPDATE learning_tasks SET status = 'archived', deleted_at = NOW() WHERE id = ?",
      [taskId],
    );
    revalidateLearning(rows[0].slug);
    return { ok: true, message: "ปิดใช้งานรายการแล้ว" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "ปิดใช้งานไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveAssessmentPairAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);

    let preAssessmentId = numberValue(formData, "preAssessmentId");
    let postAssessmentId = numberValue(formData, "postAssessmentId");

    if (!preAssessmentId) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO assessments (
           course_id, title, type, description, passing_score, max_attempts,
           time_limit_minutes, is_required, counts_toward_completion,
           compare_group, randomize_questions, randomize_options, show_answers,
           status, sort_order
         )
         VALUES (?, 'แบบทดสอบก่อนเรียน', 'pre_test',
                 'ใช้วัดพื้นฐานก่อนเรียน ไม่นำไปตัดสินผลผ่านหลักสูตร',
                 0, 1, 15, TRUE, FALSE, 'main', TRUE, TRUE, 'never',
                 'published', 1)`,
        [courseId],
      );
      preAssessmentId = result.insertId;
    }

    if (!postAssessmentId) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO assessments (
           course_id, shared_question_source_id, title, type, description,
           passing_score, max_attempts, time_limit_minutes, is_required,
           counts_toward_completion, compare_group, randomize_questions,
           randomize_options, show_answers, status, sort_order
         )
         VALUES (?, ?, 'แบบทดสอบหลังเรียน', 'post_test',
                 'ใช้ชุดคำถามเดียวกับก่อนเรียน แต่สุ่มลำดับข้อและนำคะแนนไปตัดสินผล',
                 70, 2, 45, TRUE, TRUE, 'main', TRUE, TRUE, 'after_close',
                 'published', 4)`,
        [courseId, preAssessmentId],
      );
      postAssessmentId = result.insertId;
    }

    await connection.execute(
      `UPDATE assessments
       SET status = 'published',
           counts_toward_completion = FALSE,
           compare_group = 'main',
           randomize_questions = TRUE,
           randomize_options = TRUE,
           show_answers = 'never'
       WHERE id = ? AND course_id = ?`,
      [preAssessmentId, courseId],
    );

    await connection.execute(
      `UPDATE assessments
       SET status = 'published',
           shared_question_source_id = ?,
           counts_toward_completion = TRUE,
           compare_group = 'main',
           randomize_questions = TRUE,
           randomize_options = TRUE,
           show_answers = 'after_close'
       WHERE id = ? AND course_id = ?`,
      [preAssessmentId, postAssessmentId, courseId],
    );

    const [slugRows] = await connection.execute<Array<RowDataPacket & { slug: string }>>(
      "SELECT slug FROM courses WHERE id = ? LIMIT 1",
      [courseId],
    );

    await connection.commit();
    revalidateLearning(slugRows[0]?.slug);
    return { ok: true, message: "ตั้งค่า pre-test/post-test ให้ใช้ชุดคำถามเดียวกันแล้ว" };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกการจับคู่แบบทดสอบไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveEvaluationRuleAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const courseId = requiredNumber(formData, "courseId");
    const criterion = oneOf(text(formData, "criterion"), ruleCriteria, "lesson_progress");
    const title = text(formData, "title");
    if (!title) throw new Error("กรุณากรอกชื่อเกณฑ์");

    await assertCanManageCourse(connection, courseId, currentUser);

    await connection.execute(
      `INSERT INTO course_evaluation_rules (
         course_id, criterion, title, weight_percent, passing_score,
         is_required, status, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         weight_percent = VALUES(weight_percent),
         passing_score = VALUES(passing_score),
         is_required = VALUES(is_required),
         status = VALUES(status),
         sort_order = VALUES(sort_order)`,
      [
        courseId,
        criterion,
        title,
        numberValue(formData, "weightPercent", 0),
        numberValue(formData, "passingScore", 0),
        formData.get("isRequired") === "on",
        formData.get("status") === "inactive" ? "inactive" : "active",
        numberValue(formData, "sortOrder", 0),
      ],
    );

    const [slugRows] = await connection.execute<Array<RowDataPacket & { slug: string }>>(
      "SELECT slug FROM courses WHERE id = ? LIMIT 1",
      [courseId],
    );

    revalidateLearning(slugRows[0]?.slug);
    return { ok: true, message: "บันทึกเกณฑ์วัดผลแล้ว" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกเกณฑ์ไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
