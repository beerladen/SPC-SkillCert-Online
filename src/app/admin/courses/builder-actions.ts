"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { revalidatePath } from "next/cache";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser, type CurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { isUploadFileEntry } from "@/lib/upload-security";
import type {
  BuilderPublishStatus,
  CourseBuilderAssessmentType,
  CourseBuilderQuestionType,
  CourseBuilderResourceType,
  CourseBuilderShowAnswers,
  CourseBuilderLessonType,
  CourseSectionLearningMode,
  CourseSectionStatus,
} from "@/lib/db-repositories";

interface BuilderActionResult {
  ok: boolean;
  message: string;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SortRow extends RowDataPacket {
  sort_order: number;
}

type SqlParam = string | number | boolean | Date | null;

const publishStatuses: BuilderPublishStatus[] = ["draft", "published", "archived"];
const sectionLearningModes: CourseSectionLearningMode[] = [
  "online",
  "live_online",
  "blended",
];
const sectionStatuses: CourseSectionStatus[] = publishStatuses;
const lessonTypes: CourseBuilderLessonType[] = ["video", "document", "practice"];
const resourceTypes: CourseBuilderResourceType[] = [
  "pdf",
  "doc",
  "link",
  "worksheet",
  "video",
  "image",
  "other",
];
const assessmentTypes: CourseBuilderAssessmentType[] = [
  "pre_test",
  "quiz",
  "post_test",
  "assignment",
  "final_project",
];
const showAnswerOptions: CourseBuilderShowAnswers[] = [
  "immediate",
  "after_close",
  "never",
];
const questionTypes: CourseBuilderQuestionType[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
  "file_upload",
];
const maxBuilderUploadSizeBytes = 25 * 1024 * 1024;
const maxQuestionImportSizeBytes = 2 * 1024 * 1024;
const allowedBuilderUploadExtensions = new Set([
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
const allowedQuestionImportExtensions = new Set([".txt", ".csv"]);

interface ParsedImportQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  score: number;
}

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

function requireOneOf<T extends string>(value: string, options: T[], label: string): T {
  if (!options.includes(value as T)) {
    throw new Error(`${label} ไม่ถูกต้อง`);
  }

  return value as T;
}

async function assertExists(
  connection: PoolConnection,
  sql: string,
  values: SqlParam[],
  message = "ข้อมูลอ้างอิงไม่ถูกต้อง",
) {
  const [rows] = await connection.execute<IdRow[]>(sql, values);

  if (!rows[0]) {
    throw new Error(message);
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
    "คุณไม่มีสิทธิ์จัดการหลักสูตรนี้",
  );
}

async function getCount(
  connection: PoolConnection,
  sql: string,
  values: SqlParam[],
) {
  const [rows] = await connection.execute<CountRow[]>(sql, values);
  return Number(rows[0]?.total ?? 0);
}

async function nextSortOrder(
  connection: PoolConnection,
  sql: string,
  values: SqlParam[],
) {
  const [rows] = await connection.execute<SortRow[]>(sql, values);
  return Number(rows[0]?.sort_order ?? 1);
}

function revalidateBuilder(courseSlug: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseSlug}/builder`);
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/my-learning/${courseSlug}`);
}

function normalizePositiveNumber(value: number | null, fallback: number) {
  if (value === null) {
    return fallback;
  }

  return Math.max(0, value);
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

function safeUploadFileName(value: string, fallback = "resource") {
  const parsed = parse(value || fallback);
  const name =
    parsed.name
      .normalize("NFKD")
      .replace(/[^\w\u0E00-\u0E7F-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || fallback;
  const extension = parsed.ext.toLowerCase();
  return `${name}${extension}`;
}

function normalizeAnswerIndex(value: string) {
  const normalized = value
    .trim()
    .replace(/[.)\]]/g, "")
    .toLowerCase();
  const answerMap = new Map([
    ["ก", 0],
    ["ข", 1],
    ["ค", 2],
    ["ง", 3],
    ["a", 0],
    ["b", 1],
    ["c", 2],
    ["d", 3],
    ["1", 0],
    ["2", 1],
    ["3", 2],
    ["4", 3],
  ]);

  return answerMap.get(normalized) ?? null;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseCsvQuestions(text: string): ParsedImportQuestion[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexOf = (...keys: string[]) => {
    for (const key of keys) {
      const index = headers.indexOf(key);
      if (index >= 0) return index;
    }
    return -1;
  };

  const questionIndex = indexOf("question", "question_text", "คำถาม", "โจทย์");
  const choiceIndexes = [
    indexOf("choice_a", "a", "ก", "ตัวเลือก ก"),
    indexOf("choice_b", "b", "ข", "ตัวเลือก ข"),
    indexOf("choice_c", "c", "ค", "ตัวเลือก ค"),
    indexOf("choice_d", "d", "ง", "ตัวเลือก ง"),
  ];
  const answerIndex = indexOf("answer", "correct", "เฉลย", "คำตอบ");
  const explanationIndex = indexOf("explanation", "อธิบาย", "คำอธิบาย");
  const scoreIndex = indexOf("score", "คะแนน");

  if (questionIndex < 0 || choiceIndexes.some((index) => index < 0) || answerIndex < 0) {
    return [];
  }

  return rows.slice(1).map((row, rowIndex) => {
    const correctIndex = normalizeAnswerIndex(row[answerIndex] ?? "");
    if (correctIndex === null) {
      throw new Error(`แถว CSV ที่ ${rowIndex + 2} ระบุเฉลยไม่ถูกต้อง`);
    }

    return {
      questionText: row[questionIndex]?.trim() ?? "",
      options: choiceIndexes.map((index) => row[index]?.trim() ?? ""),
      correctIndex,
      explanation: explanationIndex >= 0 ? row[explanationIndex]?.trim() || null : null,
      score: Number(row[scoreIndex] ?? 1) || 1,
    };
  });
}

function parseTextQuestions(text: string): ParsedImportQuestion[] {
  const questions: ParsedImportQuestion[] = [];
  let current: ParsedImportQuestion | null = null;
  let lastOptionIndex: number | null = null;

  const commit = () => {
    if (!current) return;
    current.questionText = current.questionText.trim();
    current.options = current.options.map((option) => option.trim());
    if (current.questionText || current.options.some(Boolean)) {
      questions.push(current);
    }
    current = null;
    lastOptionIndex = null;
  };

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (current?.questionText && current.options.length >= 4 && current.correctIndex >= 0) {
        commit();
      }
      continue;
    }

    const questionMatch = line.match(/^(?:ข้อ\s*)?(\d+)[.)\s:-]+(.+)$/i);
    const optionMatch = line.match(/^([กขคงa-dA-D1-4])[.)\]:：\s-]+(.+)$/);
    const answerMatch = line.match(/^(?:เฉลย|คำตอบ|answer|correct)\s*[:：]\s*(.+)$/i);
    const explanationMatch = line.match(/^(?:อธิบาย|คำอธิบาย|explanation)\s*[:：]\s*(.+)$/i);

    if (questionMatch) {
      commit();
      current = {
        questionText: questionMatch[2].trim(),
        options: [],
        correctIndex: -1,
        explanation: null,
        score: 1,
      };
      continue;
    }

    if (!current) {
      current = {
        questionText: line,
        options: [],
        correctIndex: -1,
        explanation: null,
        score: 1,
      };
      continue;
    }

    if (optionMatch) {
      const optionIndex = normalizeAnswerIndex(optionMatch[1]);
      const targetIndex = optionIndex ?? current.options.length;
      current.options[targetIndex] = optionMatch[2].trim();
      lastOptionIndex = targetIndex;
      continue;
    }

    if (answerMatch) {
      const correctIndex = normalizeAnswerIndex(answerMatch[1]);
      if (correctIndex === null) {
        throw new Error(`เฉลย "${answerMatch[1]}" ไม่ถูกต้อง กรุณาใช้ ก/ข/ค/ง หรือ A/B/C/D`);
      }
      current.correctIndex = correctIndex;
      lastOptionIndex = null;
      continue;
    }

    if (explanationMatch) {
      current.explanation = explanationMatch[1].trim();
      lastOptionIndex = null;
      continue;
    }

    if (lastOptionIndex !== null) {
      current.options[lastOptionIndex] = `${current.options[lastOptionIndex] ?? ""} ${line}`.trim();
    } else if (current.correctIndex >= 0) {
      current.explanation = `${current.explanation ?? ""} ${line}`.trim();
    } else {
      current.questionText = `${current.questionText} ${line}`.trim();
    }
  }

  commit();
  return questions;
}

function validateImportedQuestions(questions: ParsedImportQuestion[]) {
  if (!questions.length) {
    throw new Error("ไม่พบข้อสอบที่นำเข้าได้ กรุณาตรวจรูปแบบข้อความหรือไฟล์");
  }

  questions.forEach((question, index) => {
    if (!question.questionText) {
      throw new Error(`ข้อที่ ${index + 1} ยังไม่มีคำถาม`);
    }
    if (question.options.length !== 4 || question.options.some((option) => !option)) {
      throw new Error(`ข้อที่ ${index + 1} ต้องมีตัวเลือกครบ 4 ตัวเลือก`);
    }
    if (question.correctIndex < 0 || question.correctIndex > 3) {
      throw new Error(`ข้อที่ ${index + 1} ต้องระบุเฉลยเป็น ก/ข/ค/ง`);
    }
  });
}

async function readQuestionImportText(formData: FormData) {
  const textValue = optionalString(formData, "importText");
  if (textValue) return textValue;

  const fileEntry = formData.get("questionImportFile");
  if (!isUploadFileEntry(fileEntry)) {
    return null;
  }

  const extension = extname(fileEntry.name).toLowerCase();
  if (fileEntry.size > maxQuestionImportSizeBytes) {
    throw new Error("ไฟล์นำเข้าข้อสอบต้องมีขนาดไม่เกิน 2MB");
  }
  if (!allowedQuestionImportExtensions.has(extension)) {
    throw new Error("รองรับไฟล์นำเข้าข้อสอบเฉพาะ .txt และ .csv");
  }

  return Buffer.from(await fileEntry.arrayBuffer()).toString("utf8");
}

function parseImportedQuestions(text: string) {
  const csvQuestions = parseCsvQuestions(text);
  const questions = csvQuestions.length ? csvQuestions : parseTextQuestions(text);
  validateImportedQuestions(questions);
  return questions;
}

function inferResourceType(fileName: string, mimeType: string): CourseBuilderResourceType {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if ([".doc", ".docx", ".ppt", ".pptx"].includes(extension)) return "doc";
  if ([".xls", ".xlsx", ".csv"].includes(extension)) return "worksheet";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "other";
}

async function saveBuilderUpload(formData: FormData, key: string, folder: string) {
  const fileEntry = formData.get(key);

  if (!isUploadFileEntry(fileEntry)) {
    return null;
  }

  const extension = extname(fileEntry.name).toLowerCase();

  if (fileEntry.size > maxBuilderUploadSizeBytes) {
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 25MB");
  }

  if (!allowedBuilderUploadExtensions.has(extension)) {
    throw new Error("รองรับไฟล์ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอสั้น, ZIP, TXT และ CSV");
  }

  const uploadDir = join(process.cwd(), "public", "uploads", folder);
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeUploadFileName(fileEntry.name)}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, storedFileName), Buffer.from(await fileEntry.arrayBuffer()));

  return {
    fileName: fileEntry.name,
    fileUrl: `/uploads/${folder}/${storedFileName}`,
    fileSize: formatFileSize(fileEntry.size),
    resourceType: inferResourceType(fileEntry.name, fileEntry.type),
  };
}

async function audit(
  connection: PoolConnection,
  action: string,
  entityType: string,
  entityId: number,
  title: string,
  courseId: number,
) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO audit_logs (action, entity_type, entity_id, detail_json)
     VALUES (?, ?, ?, JSON_OBJECT('title', ?, 'course_id', ?))`,
    [action, entityType, entityId, title, courseId],
  );
}

export async function saveCourseSectionAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const sectionId = optionalNumber(formData, "sectionId");
    const code = optionalString(formData, "code");
    const title = requiredString(formData, "title");
    const description = optionalString(formData, "description");
    const objectives = optionalString(formData, "objectives");
    const competency = optionalString(formData, "competency");
    const hours = normalizePositiveNumber(optionalNumber(formData, "hours"), 0);
    const learningMode = requireOneOf(
      requiredString(formData, "learningMode"),
      sectionLearningModes,
      "รูปแบบการเรียน",
    );
    const passingScore = normalizePositiveNumber(
      optionalNumber(formData, "passingScore"),
      70,
    );
    const unlockRule = optionalString(formData, "unlockRule") ?? "manual";
    const status = requireOneOf(
      requiredString(formData, "status"),
      sectionStatuses,
      "สถานะหน่วย",
    );
    const requestedSortOrder = optionalNumber(formData, "sortOrder");

    await assertExists(connection, "SELECT id FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1", [
      courseId,
    ]);

    const sortOrder =
      requestedSortOrder ??
      (await nextSortOrder(
        connection,
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM course_sections WHERE course_id = ?",
        [courseId],
      ));

    if (sectionId) {
      await assertExists(
        connection,
        "SELECT id FROM course_sections WHERE id = ? AND course_id = ? LIMIT 1",
        [sectionId, courseId],
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE course_sections
         SET code = ?,
             title = ?,
             description = ?,
             objectives = ?,
             competency = ?,
             hours = ?,
             learning_mode = ?,
             passing_score = ?,
             unlock_rule = ?,
             status = ?,
             deleted_at = NULL,
             sort_order = ?
         WHERE id = ?`,
        [
          code,
          title,
          description,
          objectives,
          competency,
          hours,
          learningMode,
          passingScore,
          unlockRule,
          status,
          sortOrder,
          sectionId,
        ],
      );
      await audit(connection, "course_section.updated", "course_section", sectionId, title, courseId);
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO course_sections (
          course_id, code, title, description, objectives, competency, hours,
          learning_mode, passing_score, unlock_rule, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          code,
          title,
          description,
          objectives,
          competency,
          hours,
          learningMode,
          passingScore,
          unlockRule,
          status,
          sortOrder,
        ],
      );
      await audit(connection, "course_section.created", "course_section", result.insertId, title, courseId);
    }

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: sectionId ? "บันทึกหน่วยการเรียนรู้แล้ว" : "เพิ่มหน่วยการเรียนรู้แล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "บันทึกหน่วยการเรียนรู้ไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveLessonAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const lessonId = optionalNumber(formData, "lessonId");
    const sectionId = requiredNumber(formData, "sectionId");
    const title = requiredString(formData, "title");
    const description = optionalString(formData, "description");
    const content = optionalString(formData, "content");
    const lessonType = requireOneOf(
      requiredString(formData, "lessonType"),
      lessonTypes,
      "ประเภทบทเรียน",
    );
    const videoUrl = optionalString(formData, "videoUrl");
    const durationMinutes = normalizePositiveNumber(
      optionalNumber(formData, "durationMinutes"),
      0,
    );
    const isPreview = formData.get("isPreview") === "on";
    const status = requireOneOf(
      requiredString(formData, "status"),
      publishStatuses,
      "สถานะบทเรียน",
    );
    const requestedSortOrder = optionalNumber(formData, "sortOrder");

    await assertExists(
      connection,
      "SELECT id FROM course_sections WHERE id = ? AND course_id = ? LIMIT 1",
      [sectionId, courseId],
      "ไม่พบหน่วยการเรียนรู้ของหลักสูตรนี้",
    );

    const sortOrder =
      requestedSortOrder ??
      (await nextSortOrder(
        connection,
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM lessons WHERE section_id = ?",
        [sectionId],
      ));

    if (lessonId) {
      await assertExists(
        connection,
        `SELECT l.id
         FROM lessons l
         JOIN course_sections s ON s.id = l.section_id
         WHERE l.id = ? AND s.course_id = ?
         LIMIT 1`,
        [lessonId, courseId],
        "ไม่พบบทเรียนของหลักสูตรนี้",
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE lessons
         SET section_id = ?,
             title = ?,
             description = ?,
             content = ?,
             lesson_type = ?,
             video_url = ?,
             duration_minutes = ?,
             is_preview = ?,
             status = ?,
             deleted_at = NULL,
             sort_order = ?
         WHERE id = ?`,
        [
          sectionId,
          title,
          description,
          content,
          lessonType,
          videoUrl,
          durationMinutes,
          isPreview,
          status,
          sortOrder,
          lessonId,
        ],
      );
      await audit(connection, "lesson.updated", "lesson", lessonId, title, courseId);
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lessons (
          section_id, title, description, content, lesson_type, video_url,
          duration_minutes, is_preview, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sectionId,
          title,
          description,
          content,
          lessonType,
          videoUrl,
          durationMinutes,
          isPreview,
          status,
          sortOrder,
        ],
      );
      await audit(connection, "lesson.created", "lesson", result.insertId, title, courseId);
    }

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: lessonId ? "บันทึกบทเรียนแล้ว" : "เพิ่มบทเรียนแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกบทเรียนไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveLessonResourceAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const resourceId = optionalNumber(formData, "resourceId");
    const lessonId = requiredNumber(formData, "lessonId");
    const title = requiredString(formData, "title");
    const uploadedResource = await saveBuilderUpload(
      formData,
      "resourceFile",
      "lesson-resources",
    );
    const selectedResourceType = requireOneOf(
      requiredString(formData, "resourceType"),
      resourceTypes,
      "ประเภทสื่อ",
    );
    const resourceType = uploadedResource?.resourceType ?? selectedResourceType;
    const fileUrl = uploadedResource?.fileUrl ?? optionalString(formData, "fileUrl");
    const fileName = uploadedResource?.fileName ?? optionalString(formData, "fileName");
    const fileSize = uploadedResource?.fileSize ?? optionalString(formData, "fileSize");
    const status = requireOneOf(
      requiredString(formData, "status"),
      publishStatuses,
      "สถานะสื่อ",
    );
    const requestedSortOrder = optionalNumber(formData, "sortOrder");

    if (!fileUrl) {
      throw new Error("กรุณาอัปโหลดไฟล์หรือกรอก URL ไฟล์/ลิงก์");
    }

    await assertExists(
      connection,
      `SELECT l.id
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       WHERE l.id = ? AND s.course_id = ?
       LIMIT 1`,
      [lessonId, courseId],
      "ไม่พบบทเรียนของหลักสูตรนี้",
    );

    const sortOrder =
      requestedSortOrder ??
      (await nextSortOrder(
        connection,
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM lesson_resources WHERE lesson_id = ?",
        [lessonId],
      ));

    if (resourceId) {
      await assertExists(
        connection,
        `SELECT r.id
         FROM lesson_resources r
         JOIN lessons l ON l.id = r.lesson_id
         JOIN course_sections s ON s.id = l.section_id
         WHERE r.id = ? AND s.course_id = ?
         LIMIT 1`,
        [resourceId, courseId],
        "ไม่พบสื่อของหลักสูตรนี้",
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE lesson_resources
         SET lesson_id = ?,
             title = ?,
             resource_type = ?,
             file_url = ?,
             file_name = ?,
             file_size = ?,
             status = ?,
             deleted_at = NULL,
             sort_order = ?
         WHERE id = ?`,
        [
          lessonId,
          title,
          resourceType,
          fileUrl,
          fileName,
          fileSize,
          status,
          sortOrder,
          resourceId,
        ],
      );
      await audit(connection, "lesson_resource.updated", "lesson_resource", resourceId, title, courseId);
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lesson_resources (
          lesson_id, title, resource_type, file_url, file_name, file_size, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [lessonId, title, resourceType, fileUrl, fileName, fileSize, status, sortOrder],
      );
      await audit(connection, "lesson_resource.created", "lesson_resource", result.insertId, title, courseId);
    }

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: resourceId ? "บันทึกสื่อการเรียนแล้ว" : "เพิ่มสื่อการเรียนแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกสื่อการเรียนไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveAssessmentAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const assessmentId = optionalNumber(formData, "assessmentId");
    const target = requiredString(formData, "target");
    const title = requiredString(formData, "title");
    const type = requireOneOf(
      requiredString(formData, "type"),
      assessmentTypes,
      "ประเภทกิจกรรมวัดผล",
    );
    const description = optionalString(formData, "description");
    const passingScore = normalizePositiveNumber(
      optionalNumber(formData, "passingScore"),
      70,
    );
    const maxAttempts = optionalNumber(formData, "maxAttempts");
    const timeLimitMinutes = optionalNumber(formData, "timeLimitMinutes");
    const questionLimit = optionalNumber(formData, "questionLimit");
    const selectedSharedQuestionSourceId = optionalNumber(formData, "sharedQuestionSourceId");
    const sharedQuestionSourceId =
      selectedSharedQuestionSourceId && selectedSharedQuestionSourceId > 0
        ? selectedSharedQuestionSourceId
        : null;
    const isRequired = formData.get("isRequired") === "on";
    const countsTowardCompletion = type !== "pre_test";
    const compareGroup = type === "pre_test" || type === "post_test" ? "main" : null;
    const randomizeQuestions = formData.get("randomizeQuestions") === "on";
    const randomizeOptions = formData.get("randomizeOptions") === "on";
    const showAnswers = requireOneOf(
      requiredString(formData, "showAnswers"),
      showAnswerOptions,
      "การแสดงเฉลย",
    );
    const status = requireOneOf(
      requiredString(formData, "status"),
      publishStatuses,
      "สถานะกิจกรรมวัดผล",
    );
    const requestedSortOrder = optionalNumber(formData, "sortOrder");

    await assertExists(connection, "SELECT id FROM courses WHERE id = ? AND deleted_at IS NULL LIMIT 1", [
      courseId,
    ]);

    let sectionId: number | null = null;
    let lessonId: number | null = null;

    if (target.startsWith("section:")) {
      sectionId = Number(target.replace("section:", ""));
      if (!Number.isFinite(sectionId)) {
        throw new Error("หน่วยอ้างอิงไม่ถูกต้อง");
      }
      await assertExists(
        connection,
        "SELECT id FROM course_sections WHERE id = ? AND course_id = ? LIMIT 1",
        [sectionId, courseId],
        "ไม่พบหน่วยการเรียนรู้ของหลักสูตรนี้",
      );
    } else if (target.startsWith("lesson:")) {
      lessonId = Number(target.replace("lesson:", ""));
      if (!Number.isFinite(lessonId)) {
        throw new Error("บทเรียนอ้างอิงไม่ถูกต้อง");
      }
      await assertExists(
        connection,
        `SELECT l.id
         FROM lessons l
         JOIN course_sections s ON s.id = l.section_id
         WHERE l.id = ? AND s.course_id = ?
         LIMIT 1`,
        [lessonId, courseId],
        "ไม่พบบทเรียนของหลักสูตรนี้",
      );
    } else if (target !== "course") {
      throw new Error("ตำแหน่งกิจกรรมวัดผลไม่ถูกต้อง");
    }

    const sortOrder =
      requestedSortOrder ??
      (await nextSortOrder(
        connection,
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM assessments WHERE course_id = ? AND type = ?",
        [courseId, type],
      ));

    if (sharedQuestionSourceId) {
      if (assessmentId && sharedQuestionSourceId === assessmentId) {
        throw new Error("ไม่สามารถเลือกแบบทดสอบเดียวกันเป็นแหล่งข้อสอบร่วมได้");
      }
      await assertExists(
        connection,
        "SELECT id FROM assessments WHERE id = ? AND course_id = ? LIMIT 1",
        [sharedQuestionSourceId, courseId],
        "ไม่พบชุดข้อสอบต้นทางที่ต้องการใช้ร่วมกัน",
      );
    }

    if (assessmentId) {
      await assertExists(
        connection,
        "SELECT id FROM assessments WHERE id = ? AND course_id = ? LIMIT 1",
        [assessmentId, courseId],
        "ไม่พบกิจกรรมวัดผลของหลักสูตรนี้",
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE assessments
         SET section_id = ?,
             lesson_id = ?,
             shared_question_source_id = ?,
             title = ?,
             type = ?,
             description = ?,
             passing_score = ?,
             max_attempts = ?,
             time_limit_minutes = ?,
             question_limit = ?,
             is_required = ?,
             counts_toward_completion = ?,
             compare_group = ?,
             randomize_questions = ?,
             randomize_options = ?,
             show_answers = ?,
             status = ?,
             deleted_at = NULL,
             sort_order = ?
         WHERE id = ?`,
        [
          sectionId,
          lessonId,
          sharedQuestionSourceId,
          title,
          type,
          description,
          passingScore,
          maxAttempts,
          timeLimitMinutes,
          questionLimit,
          isRequired,
          countsTowardCompletion,
          compareGroup,
          randomizeQuestions,
          randomizeOptions,
          showAnswers,
          status,
          sortOrder,
          assessmentId,
        ],
      );
      await audit(connection, "assessment.updated", "assessment", assessmentId, title, courseId);
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO assessments (
          course_id, section_id, lesson_id, shared_question_source_id, title, type, description, passing_score,
          max_attempts, time_limit_minutes, question_limit, is_required, counts_toward_completion,
          compare_group, randomize_questions,
          randomize_options, show_answers, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          sectionId,
          lessonId,
          sharedQuestionSourceId,
          title,
          type,
          description,
          passingScore,
          maxAttempts,
          timeLimitMinutes,
          questionLimit,
          isRequired,
          countsTowardCompletion,
          compareGroup,
          randomizeQuestions,
          randomizeOptions,
          showAnswers,
          status,
          sortOrder,
        ],
      );
      await audit(connection, "assessment.created", "assessment", result.insertId, title, courseId);
    }

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: assessmentId
        ? "บันทึกกิจกรรมวัดผลแล้ว"
        : "เพิ่มกิจกรรมวัดผลแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "บันทึกกิจกรรมวัดผลไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function saveQuestionAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const assessmentId = requiredNumber(formData, "assessmentId");
    const questionId = optionalNumber(formData, "questionId");
    const questionText = requiredString(formData, "questionText");
    const questionType = requireOneOf(
      requiredString(formData, "questionType"),
      questionTypes,
      "ประเภทคำถาม",
    );
    const score = normalizePositiveNumber(optionalNumber(formData, "score"), 1);
    const explanation = optionalString(formData, "explanation");
    const status = requireOneOf(
      requiredString(formData, "status"),
      ["active", "inactive", "archived"],
      "สถานะคำถาม",
    );
    const requestedSortOrder = optionalNumber(formData, "sortOrder");

    await assertExists(
      connection,
      "SELECT id FROM assessments WHERE id = ? AND course_id = ? LIMIT 1",
      [assessmentId, courseId],
      "ไม่พบแบบทดสอบของหลักสูตรนี้",
    );

    const sortOrder =
      requestedSortOrder ??
      (await nextSortOrder(
        connection,
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM questions WHERE assessment_id = ?",
        [assessmentId],
      ));

    let savedQuestionId = questionId;

    if (questionId) {
      await assertExists(
        connection,
        `SELECT q.id
         FROM questions q
         JOIN assessments a ON a.id = q.assessment_id
         WHERE q.id = ? AND a.course_id = ?
         LIMIT 1`,
        [questionId, courseId],
        "ไม่พบคำถามของหลักสูตรนี้",
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE questions
         SET assessment_id = ?,
             question_text = ?,
             question_type = ?,
             score = ?,
             explanation = ?,
             status = ?,
             sort_order = ?
         WHERE id = ?`,
        [
          assessmentId,
          questionText,
          questionType,
          score,
          explanation,
          status,
          sortOrder,
          questionId,
        ],
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO questions (
          assessment_id, question_text, question_type, score, explanation, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [assessmentId, questionText, questionType, score, explanation, status, sortOrder],
      );
      savedQuestionId = result.insertId;
    }

    if (!savedQuestionId) {
      throw new Error("ไม่พบคำถามที่ต้องการบันทึก");
    }

    await connection.execute<ResultSetHeader>(
      "DELETE FROM question_options WHERE question_id = ?",
      [savedQuestionId],
    );

    const optionTexts = formData.getAll("optionText").map((value) => String(value).trim());
    const correctValues = new Set(
      formData.getAll("correctOption").map((value) => String(value)),
    );
    let insertedOptions = 0;

    for (let index = 0; index < optionTexts.length; index += 1) {
      const optionText = optionTexts[index];

      if (!optionText) {
        continue;
      }

      insertedOptions += 1;
      await connection.execute<ResultSetHeader>(
        `INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
         VALUES (?, ?, ?, ?)`,
        [
          savedQuestionId,
          optionText,
          correctValues.has(String(index)),
          insertedOptions,
        ],
      );
    }

    if (
      ["single_choice", "multiple_choice", "true_false"].includes(questionType) &&
      insertedOptions < 2
    ) {
      throw new Error("คำถามแบบตัวเลือกต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก");
    }

    if (
      ["single_choice", "multiple_choice", "true_false"].includes(questionType) &&
      correctValues.size === 0
    ) {
      throw new Error("กรุณาเลือกเฉลยอย่างน้อย 1 ข้อ");
    }

    await audit(
      connection,
      questionId ? "question.updated" : "question.created",
      "question",
      savedQuestionId,
      questionText.slice(0, 120),
      courseId,
    );

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: questionId ? "บันทึกคำถามแล้ว" : "เพิ่มคำถามแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกคำถามไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function importQuestionsAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const assessmentId = requiredNumber(formData, "assessmentId");
    const importText = await readQuestionImportText(formData);

    if (!importText) {
      throw new Error("กรุณาวางข้อความข้อสอบหรืออัปโหลดไฟล์ .txt/.csv");
    }

    await assertExists(
      connection,
      "SELECT id FROM assessments WHERE id = ? AND course_id = ? LIMIT 1",
      [assessmentId, courseId],
      "ไม่พบแบบทดสอบของหลักสูตรนี้",
    );

    const questions = parseImportedQuestions(importText);
    const firstSortOrder = await nextSortOrder(
      connection,
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM questions WHERE assessment_id = ?",
      [assessmentId],
    );

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO questions (
          assessment_id, question_text, question_type, score, explanation, status, sort_order
        ) VALUES (?, ?, 'single_choice', ?, ?, 'active', ?)`,
        [
          assessmentId,
          question.questionText,
          question.score,
          question.explanation,
          firstSortOrder + index,
        ],
      );

      for (let optionIndex = 0; optionIndex < question.options.length; optionIndex += 1) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
           VALUES (?, ?, ?, ?)`,
          [
            result.insertId,
            question.options[optionIndex],
            optionIndex === question.correctIndex,
            optionIndex + 1,
          ],
        );
      }
    }

    await audit(
      connection,
      "question.imported",
      "assessment",
      assessmentId,
      `imported ${questions.length} questions`,
      courseId,
    );

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: `นำเข้าข้อสอบ ${questions.length} ข้อแล้ว`,
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "นำเข้าข้อสอบไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteCourseSectionAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const sectionId = requiredNumber(formData, "sectionId");

    await assertExists(
      connection,
      "SELECT id FROM course_sections WHERE id = ? AND course_id = ? LIMIT 1",
      [sectionId, courseId],
      "ไม่พบหน่วยการเรียนรู้ของหลักสูตรนี้",
    );

    const evidenceCount = await getCount(
      connection,
      `SELECT
         (SELECT COUNT(*)
          FROM lesson_progress lp
          JOIN lessons l ON l.id = lp.lesson_id
          WHERE l.section_id = ?) +
         (SELECT COUNT(*)
          FROM assessment_attempts aa
          JOIN assessments a ON a.id = aa.assessment_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE a.section_id = ? OR l.section_id = ?) +
         (SELECT COUNT(*)
          FROM assignment_submissions sub
          JOIN assessments a ON a.id = sub.assessment_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE a.section_id = ? OR l.section_id = ?) AS total`,
      [sectionId, sectionId, sectionId, sectionId, sectionId],
    );

    if (evidenceCount > 0) {
      await connection.execute<ResultSetHeader>(
        "UPDATE course_sections SET status = 'archived', deleted_at = NOW() WHERE id = ?",
        [sectionId],
      );
      await audit(connection, "course_section.archived", "course_section", sectionId, "archived", courseId);
      await connection.commit();
      revalidateBuilder(courseSlug);

      return {
        ok: true,
        message: "พบหลักฐานการเรียนแล้ว จึงเก็บหน่วยเข้าคลังแทนการลบถาวร",
      };
    }

    await connection.execute<ResultSetHeader>(
      `DELETE qo FROM question_options qo
       JOIN questions q ON q.id = qo.question_id
       JOIN assessments a ON a.id = q.assessment_id
       LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.section_id = ? OR l.section_id = ?`,
      [sectionId, sectionId],
    );
    await connection.execute<ResultSetHeader>(
      `DELETE q FROM questions q
       JOIN assessments a ON a.id = q.assessment_id
       LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.section_id = ? OR l.section_id = ?`,
      [sectionId, sectionId],
    );
    await connection.execute<ResultSetHeader>(
      `DELETE a FROM assessments a
       LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.section_id = ? OR l.section_id = ?`,
      [sectionId, sectionId],
    );
    await connection.execute<ResultSetHeader>(
      `DELETE r FROM lesson_resources r
       JOIN lessons l ON l.id = r.lesson_id
       WHERE l.section_id = ?`,
      [sectionId],
    );
    await connection.execute<ResultSetHeader>("DELETE FROM lessons WHERE section_id = ?", [
      sectionId,
    ]);
    await connection.execute<ResultSetHeader>("DELETE FROM course_sections WHERE id = ?", [
      sectionId,
    ]);
    await audit(connection, "course_section.deleted", "course_section", sectionId, "deleted", courseId);

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: "ลบหน่วยการเรียนรู้แล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบหน่วยการเรียนรู้ไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteLessonAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const lessonId = requiredNumber(formData, "lessonId");

    await assertExists(
      connection,
      `SELECT l.id
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       WHERE l.id = ? AND s.course_id = ?
       LIMIT 1`,
      [lessonId, courseId],
      "ไม่พบบทเรียนของหลักสูตรนี้",
    );

    const evidenceCount = await getCount(
      connection,
      `SELECT
         (SELECT COUNT(*) FROM lesson_progress WHERE lesson_id = ?) +
         (SELECT COUNT(*)
          FROM assessment_attempts aa
          JOIN assessments a ON a.id = aa.assessment_id
          WHERE a.lesson_id = ?) +
         (SELECT COUNT(*)
          FROM assignment_submissions sub
          JOIN assessments a ON a.id = sub.assessment_id
          WHERE a.lesson_id = ?) AS total`,
      [lessonId, lessonId, lessonId],
    );

    if (evidenceCount > 0) {
      await connection.execute<ResultSetHeader>(
        "UPDATE lessons SET status = 'archived', deleted_at = NOW() WHERE id = ?",
        [lessonId],
      );
      await audit(connection, "lesson.archived", "lesson", lessonId, "archived", courseId);
      await connection.commit();
      revalidateBuilder(courseSlug);

      return {
        ok: true,
        message: "พบหลักฐานการเรียนแล้ว จึงเก็บบทเรียนเข้าคลังแทนการลบถาวร",
      };
    }

    await connection.execute<ResultSetHeader>(
      `DELETE qo FROM question_options qo
       JOIN questions q ON q.id = qo.question_id
       JOIN assessments a ON a.id = q.assessment_id
       WHERE a.lesson_id = ?`,
      [lessonId],
    );
    await connection.execute<ResultSetHeader>(
      `DELETE q FROM questions q
       JOIN assessments a ON a.id = q.assessment_id
       WHERE a.lesson_id = ?`,
      [lessonId],
    );
    await connection.execute<ResultSetHeader>("DELETE FROM assessments WHERE lesson_id = ?", [
      lessonId,
    ]);
    await connection.execute<ResultSetHeader>("DELETE FROM lesson_resources WHERE lesson_id = ?", [
      lessonId,
    ]);
    await connection.execute<ResultSetHeader>("DELETE FROM lessons WHERE id = ?", [lessonId]);
    await audit(connection, "lesson.deleted", "lesson", lessonId, "deleted", courseId);

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: "ลบบทเรียนแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบบทเรียนไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteLessonResourceAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const resourceId = requiredNumber(formData, "resourceId");

    await assertExists(
      connection,
      `SELECT r.id
       FROM lesson_resources r
       JOIN lessons l ON l.id = r.lesson_id
       JOIN course_sections s ON s.id = l.section_id
       WHERE r.id = ? AND s.course_id = ?
       LIMIT 1`,
      [resourceId, courseId],
      "ไม่พบสื่อของหลักสูตรนี้",
    );

    await connection.execute<ResultSetHeader>(
      "DELETE FROM lesson_resources WHERE id = ?",
      [resourceId],
    );
    await audit(connection, "lesson_resource.deleted", "lesson_resource", resourceId, "deleted", courseId);

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: "ลบสื่อการเรียนแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบสื่อการเรียนไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteAssessmentAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const assessmentId = requiredNumber(formData, "assessmentId");

    await assertExists(
      connection,
      "SELECT id FROM assessments WHERE id = ? AND course_id = ? LIMIT 1",
      [assessmentId, courseId],
      "ไม่พบกิจกรรมวัดผลของหลักสูตรนี้",
    );

    const evidenceCount = await getCount(
      connection,
      `SELECT
         (SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id = ?) +
         (SELECT COUNT(*) FROM assignment_submissions WHERE assessment_id = ?) AS total`,
      [assessmentId, assessmentId],
    );

    if (evidenceCount > 0) {
      await connection.execute<ResultSetHeader>(
        "UPDATE assessments SET status = 'archived', deleted_at = NOW() WHERE id = ?",
        [assessmentId],
      );
      await audit(connection, "assessment.archived", "assessment", assessmentId, "archived", courseId);
      await connection.commit();
      revalidateBuilder(courseSlug);

      return {
        ok: true,
        message: "พบคำตอบหรือใบงานแล้ว จึงเก็บกิจกรรมเข้าคลังแทนการลบถาวร",
      };
    }

    await connection.execute<ResultSetHeader>(
      `DELETE qo FROM question_options qo
       JOIN questions q ON q.id = qo.question_id
       WHERE q.assessment_id = ?`,
      [assessmentId],
    );
    await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE assessment_id = ?", [
      assessmentId,
    ]);
    await connection.execute<ResultSetHeader>("DELETE FROM assessments WHERE id = ?", [
      assessmentId,
    ]);
    await audit(connection, "assessment.deleted", "assessment", assessmentId, "deleted", courseId);

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: "ลบกิจกรรมวัดผลแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบกิจกรรมวัดผลไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function deleteQuestionAction(
  formData: FormData,
): Promise<BuilderActionResult> {
  const currentUser = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const courseId = requiredNumber(formData, "courseId");
    await assertCanManageCourse(connection, courseId, currentUser);
    const courseSlug = requiredString(formData, "courseSlug");
    const questionId = requiredNumber(formData, "questionId");

    await assertExists(
      connection,
      `SELECT q.id
       FROM questions q
       JOIN assessments a ON a.id = q.assessment_id
       WHERE q.id = ? AND a.course_id = ?
       LIMIT 1`,
      [questionId, courseId],
      "ไม่พบคำถามของหลักสูตรนี้",
    );

    const answerCount = await getCount(
      connection,
      "SELECT COUNT(*) AS total FROM assessment_answers WHERE question_id = ?",
      [questionId],
    );

    if (answerCount > 0) {
      await connection.execute<ResultSetHeader>(
        "UPDATE questions SET status = 'archived' WHERE id = ?",
        [questionId],
      );
      await audit(connection, "question.archived", "question", questionId, "archived", courseId);
      await connection.commit();
      revalidateBuilder(courseSlug);

      return {
        ok: true,
        message: "พบคำตอบผู้เรียนแล้ว จึงเก็บคำถามเข้าคลังแทนการลบถาวร",
      };
    }

    await connection.execute<ResultSetHeader>(
      "DELETE FROM question_options WHERE question_id = ?",
      [questionId],
    );
    await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE id = ?", [
      questionId,
    ]);
    await audit(connection, "question.deleted", "question", questionId, "deleted", courseId);

    await connection.commit();
    revalidateBuilder(courseSlug);

    return {
      ok: true,
      message: "ลบคำถามแล้ว",
    };
  } catch (error) {
    await connection.rollback();

    return {
      ok: false,
      message: error instanceof Error ? error.message : "ลบคำถามไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
