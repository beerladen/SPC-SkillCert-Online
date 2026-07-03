import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createConnection } from "./db/common.mjs";

const projectRoot = process.cwd();
const manifestPath = path.join(
  projectRoot,
  "public",
  "uploads",
  "ai-office-productivity-free",
  "course_manifest.json",
);

const RESOURCE_TYPES = new Set(["pdf", "doc", "link", "worksheet", "video", "image", "other"]);
const ATTACHMENT_TYPES = new Set(["pdf", "doc", "sheet", "image", "link", "other"]);
const ANSWER_INDEX = new Map([
  ["ก", 0],
  ["ข", 1],
  ["ค", 2],
  ["ง", 3],
  ["a", 0],
  ["b", 1],
  ["c", 2],
  ["d", 3],
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function bool(value) {
  return value ? 1 : 0;
}

function filenameFromUrl(url) {
  if (!url) return null;
  return decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).at(-1) ?? "");
}

function publicPathFromUrl(url) {
  if (!url || !url.startsWith("/")) return null;
  const relativePath = url.split("?")[0].replace(/^\//, "").replaceAll("/", path.sep);
  return path.join(projectRoot, "public", relativePath);
}

function extFromUrl(url) {
  const parsedPath = publicPathFromUrl(url);
  return path.extname(parsedPath ?? url).replace(/^\./, "").toLowerCase();
}

function lessonResourceType(resource) {
  if (RESOURCE_TYPES.has(resource.type)) return resource.type;
  const ext = extFromUrl(resource.url);
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  return "other";
}

function attachmentType(type, url) {
  if (ATTACHMENT_TYPES.has(type)) return type;
  const ext = extFromUrl(url);
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  return "other";
}

function rubricFields(rubric) {
  if (Array.isArray(rubric)) {
    return {
      title: rubric[0] ?? "",
      description: rubric[1] ?? null,
      maxScore: Number(rubric[2] ?? 0),
    };
  }

  return {
    title: rubric?.title ?? "",
    description: rubric?.description ?? null,
    maxScore: Number(rubric?.maxScore ?? 0),
  };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

async function fileSizeLabel(url) {
  const filePath = publicPathFromUrl(url);
  if (!filePath) return null;
  const stats = await fs.stat(filePath);
  return formatBytes(stats.size);
}

function collectPublicUrls(manifest) {
  const urls = new Set();

  if (manifest.course?.coverImageUrl) urls.add(manifest.course.coverImageUrl);

  for (const value of Object.values(manifest.files ?? {})) {
    if (typeof value === "string" && value.startsWith("/")) urls.add(value);
  }

  for (const lesson of manifest.lessons ?? []) {
    if (lesson.video) urls.add(lesson.video);
    for (const resource of lesson.resources ?? []) {
      if (resource.url) urls.add(resource.url);
    }
  }

  for (const assessment of manifest.assessments ?? []) {
    if (assessment.csv) urls.add(assessment.csv);
  }

  for (const task of manifest.tasks ?? []) {
    if (task.instructionFileUrl) urls.add(task.instructionFileUrl);
    if (task.attachmentUrl) urls.add(task.attachmentUrl);
  }

  return [...urls];
}

async function validateFiles(manifest) {
  const missing = [];

  for (const url of collectPublicUrls(manifest)) {
    const filePath = publicPathFromUrl(url);
    if (!filePath) continue;
    try {
      await fs.access(filePath);
    } catch {
      missing.push(`${url} -> ${filePath}`);
    }
  }

  assert(missing.length === 0, `Missing public files:\n${missing.join("\n")}`);
}

async function getSingleId(connection, sql, params, label) {
  const [rows] = await connection.execute(sql, params);
  assert(rows.length > 0, `Cannot resolve ${label}.`);
  return Number(rows[0].id);
}

async function resolveAdminUserId(connection) {
  const [preferredRows] = await connection.execute(
    `SELECT id
     FROM users
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND role IN ('admin', 'instructor')
     ORDER BY FIELD(role, 'admin', 'instructor'), id
     LIMIT 1`,
  );

  return preferredRows.length > 0 ? Number(preferredRows[0].id) : null;
}

async function upsertCategory(connection, course) {
  await connection.execute(
    `INSERT INTO categories (name, slug, icon, description, sort_order, deleted_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       icon = VALUES(icon),
       description = VALUES(description),
       sort_order = VALUES(sort_order),
       deleted_at = NULL`,
    [
      course.categoryName,
      course.categorySlug,
      "AI",
      "Free short courses for computer, technology, and AI skills.",
      10,
    ],
  );

  return getSingleId(connection, "SELECT id FROM categories WHERE slug = ? LIMIT 1", [course.categorySlug], "category");
}

async function upsertInstructor(connection, course) {
  const adminUserId = await resolveAdminUserId(connection);

  if (adminUserId) {
    await connection.execute(
      `INSERT INTO instructors (user_id, display_name, position, bio, status)
       VALUES (?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         position = VALUES(position),
         bio = VALUES(bio),
         status = 'active'`,
      [
        adminUserId,
        course.instructorName,
        "Course owner / admin",
        "Owner and administrator of this free short course.",
      ],
    );

    return {
      instructorId: await getSingleId(
        connection,
        "SELECT id FROM instructors WHERE user_id = ? LIMIT 1",
        [adminUserId],
        "instructor",
      ),
      adminUserId,
    };
  }

  const [existingRows] = await connection.execute(
    `SELECT id
     FROM instructors
     WHERE user_id IS NULL
       AND display_name = ?
       AND status = 'active'
     ORDER BY id
     LIMIT 1`,
    [course.instructorName],
  );

  if (existingRows.length > 0) {
    return { instructorId: Number(existingRows[0].id), adminUserId: null };
  }

  const [result] = await connection.execute(
    `INSERT INTO instructors (user_id, display_name, position, bio, status)
     VALUES (NULL, ?, ?, ?, 'active')`,
    [course.instructorName, "Course owner / admin", "Owner and administrator of this free short course."],
  );

  return { instructorId: Number(result.insertId), adminUserId: null };
}

async function deleteExistingDraftCourse(connection, slug) {
  const [rows] = await connection.execute(
    "SELECT id FROM courses WHERE slug = ? LIMIT 1",
    [slug],
  );

  if (rows.length === 0) return false;

  const courseId = Number(rows[0].id);
  const [usageRows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE course_id = ?) AS enrollment_count,
       (SELECT COUNT(*) FROM registration_items WHERE course_id = ?) AS registration_item_count
     `,
    [courseId, courseId],
  );

  const usage = usageRows[0] ?? {};
  const enrollmentCount = Number(usage.enrollment_count ?? 0);
  const registrationItemCount = Number(usage.registration_item_count ?? 0);
  assert(
    enrollmentCount === 0 && registrationItemCount === 0,
    `Course ${slug} already has learner or registration data. Refusing to replace it.`,
  );

  await connection.execute("DELETE FROM courses WHERE id = ?", [courseId]);
  return true;
}

async function insertCourse(connection, course, categoryId, instructorId) {
  const [result] = await connection.execute(
    `INSERT INTO courses (
       category_id, instructor_id, title, slug, short_description, description,
       cover_image_url, registration_fee, original_fee, duration_minutes, capacity,
       format, level, status, starts_at, ends_at, published_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NOW())`,
    [
      categoryId,
      instructorId,
      course.title,
      course.slug,
      course.shortDescription,
      course.description,
      course.coverImageUrl,
      Number(course.registrationFee ?? 0),
      Number(course.durationMinutes ?? 0),
      course.capacity ?? null,
      course.format ?? "online",
      course.level ?? "beginner",
      course.status ?? "open",
    ],
  );

  return Number(result.insertId);
}

async function insertOrderedText(connection, table, courseId, column, values) {
  for (const [index, value] of values.entries()) {
    await connection.execute(
      `INSERT INTO ${table} (course_id, ${column}, sort_order) VALUES (?, ?, ?)`,
      [courseId, value, index + 1],
    );
  }
}

async function insertSections(connection, manifest, courseId) {
  const sectionIds = new Map();

  for (const section of manifest.sections ?? []) {
    const [result] = await connection.execute(
      `INSERT INTO course_sections (
         course_id, code, title, description, objectives, competency, hours,
         learning_mode, passing_score, unlock_rule, status, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'online', 70, 'sequential', 'published', ?)`,
      [
        courseId,
        section.code,
        section.title,
        section.description,
        section.objectives,
        section.competency,
        Number(section.hours ?? 0),
        Number(section.sortOrder ?? sectionIds.size + 1),
      ],
    );
    sectionIds.set(section.code, Number(result.insertId));
  }

  return sectionIds;
}

async function insertLessons(connection, manifest, sectionIds) {
  const lessonIds = new Map();
  const nextSortOrder = new Map();

  for (const lesson of manifest.lessons ?? []) {
    const sectionId = sectionIds.get(lesson.section);
    assert(sectionId, `Unknown lesson section code: ${lesson.section}`);

    const sortOrder = nextSortOrder.get(lesson.section) ?? 1;
    nextSortOrder.set(lesson.section, sortOrder + 1);

    const [result] = await connection.execute(
      `INSERT INTO lessons (
         section_id, title, description, content, lesson_type, video_url,
         duration_minutes, is_preview, status, sort_order
       )
       VALUES (?, ?, ?, ?, 'video', ?, ?, ?, 'published', ?)`,
      [
        sectionId,
        lesson.title,
        lesson.description,
        lesson.content,
        lesson.video,
        Number(lesson.duration ?? 0),
        bool(sortOrder === 1 && lesson.section === "AIO-01"),
        sortOrder,
      ],
    );

    const lessonId = Number(result.insertId);
    lessonIds.set(`${lesson.section}::${lesson.title}`, lessonId);

    for (const [resourceIndex, resource] of (lesson.resources ?? []).entries()) {
      await connection.execute(
        `INSERT INTO lesson_resources (
           lesson_id, title, resource_type, file_url, file_name, file_size, status, sort_order
         )
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?)`,
        [
          lessonId,
          resource.title,
          lessonResourceType(resource),
          resource.url,
          resource.file ?? filenameFromUrl(resource.url),
          await fileSizeLabel(resource.url),
          resourceIndex + 1,
        ],
      );
    }
  }

  return lessonIds;
}

async function insertAssessments(connection, manifest, courseId, sectionIds) {
  const assessmentIds = new Map();

  for (const assessment of manifest.assessments ?? []) {
    const sectionId = assessment.sectionCode ? sectionIds.get(assessment.sectionCode) : null;
    assert(!assessment.sectionCode || sectionId, `Unknown assessment section code: ${assessment.sectionCode}`);

    const [assessmentResult] = await connection.execute(
      `INSERT INTO assessments (
         course_id, section_id, lesson_id, shared_question_source_id, title, type,
         description, passing_score, max_attempts, time_limit_minutes, question_limit,
         is_required, counts_toward_completion, compare_group, randomize_questions,
         randomize_options, show_answers, status, sort_order
       )
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, ?, 'published', ?)`,
      [
        courseId,
        sectionId,
        assessment.title,
        assessment.type,
        assessment.description,
        Number(assessment.passingScore ?? 70),
        assessment.maxAttempts ?? null,
        assessment.timeLimit ?? null,
        assessment.questionLimit ?? null,
        bool(assessment.required ?? true),
        bool(assessment.countsTowardCompletion ?? true),
        ["pre_test", "post_test"].includes(assessment.type) ? "main" : null,
        assessment.showAnswers ?? "after_close",
        Number(assessment.sortOrder ?? assessmentIds.size + 1),
      ],
    );

    const assessmentId = Number(assessmentResult.insertId);
    assessmentIds.set(assessment.key, assessmentId);

    for (const [questionIndex, question] of (assessment.questions ?? []).entries()) {
      const [questionResult] = await connection.execute(
        `INSERT INTO questions (
           assessment_id, question_text, question_type, score, explanation, status, sort_order
         )
         VALUES (?, ?, 'single_choice', ?, ?, 'active', ?)`,
        [
          assessmentId,
          question.question,
          Number(question.score ?? 1),
          question.explanation ?? null,
          questionIndex + 1,
        ],
      );

      const questionId = Number(questionResult.insertId);
      const correctIndex = ANSWER_INDEX.get(String(question.answer ?? "").trim().toLowerCase());
      assert(Number.isInteger(correctIndex), `Unknown answer key for question ${questionIndex + 1} in ${assessment.key}.`);

      const options = [question.choice_a, question.choice_b, question.choice_c, question.choice_d];
      for (const [optionIndex, optionText] of options.entries()) {
        await connection.execute(
          `INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
           VALUES (?, ?, ?, ?)`,
          [questionId, optionText, bool(optionIndex === correctIndex), optionIndex + 1],
        );
      }
    }
  }

  return assessmentIds;
}

async function insertTasks(connection, manifest, courseId, sectionIds, lessonIds) {
  for (const task of manifest.tasks ?? []) {
    const sectionId = task.sectionCode ? sectionIds.get(task.sectionCode) : null;
    assert(!task.sectionCode || sectionId, `Unknown task section code: ${task.sectionCode}`);

    const lessonId = task.sectionCode && task.lessonTitle ? lessonIds.get(`${task.sectionCode}::${task.lessonTitle}`) : null;
    assert(!task.lessonTitle || lessonId, `Unknown task lesson: ${task.sectionCode}::${task.lessonTitle}`);

    const [result] = await connection.execute(
      `INSERT INTO learning_tasks (
         course_id, section_id, lesson_id, assessment_id, task_type, title, description,
         instruction_html, instruction_file_url, instruction_file_name, resource_url,
         submission_mode, max_score, passing_score, weight_percent, due_days_after_enrollment,
         allow_resubmission, require_evidence, evidence_required_count, status, sort_order
       )
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'file_or_link', ?, ?, ?, ?, TRUE, TRUE, ?, 'published', ?)`,
      [
        courseId,
        sectionId,
        lessonId,
        task.type,
        task.title,
        task.description,
        task.instructionHtml,
        task.instructionFileUrl,
        task.instructionFileName ?? filenameFromUrl(task.instructionFileUrl),
        task.attachmentUrl ?? null,
        Number(task.maxScore ?? 100),
        Number(task.passingScore ?? 70),
        Number(task.weight ?? 0),
        task.dueDays ?? null,
        Number(task.evidenceCount ?? 0),
        Number(task.sortOrder ?? 1),
      ],
    );

    const taskId = Number(result.insertId);

    if (task.attachmentUrl) {
      await connection.execute(
        `INSERT INTO learning_task_attachments (task_id, title, file_url, file_name, file_type, sort_order)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          taskId,
          task.attachmentTitle ?? task.attachmentFileName ?? filenameFromUrl(task.attachmentUrl),
          task.attachmentUrl,
          task.attachmentFileName ?? filenameFromUrl(task.attachmentUrl),
          attachmentType(task.attachmentType, task.attachmentUrl),
        ],
      );
    }

    for (const [rubricIndex, rubric] of (task.rubrics ?? []).entries()) {
      const normalizedRubric = rubricFields(rubric);
      await connection.execute(
        `INSERT INTO learning_task_rubrics (task_id, title, description, max_score, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          taskId,
          normalizedRubric.title,
          normalizedRubric.description,
          normalizedRubric.maxScore,
          rubricIndex + 1,
        ],
      );
    }
  }
}

async function insertEvaluationRules(connection, manifest, courseId) {
  for (const rule of manifest.evaluationRules ?? []) {
    await connection.execute(
      `INSERT INTO course_evaluation_rules (
         course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        courseId,
        rule.criterion,
        rule.title,
        Number(rule.weight ?? 0),
        Number(rule.passing ?? 0),
        bool(rule.required ?? true),
        Number(rule.sortOrder ?? 1),
      ],
    );
  }

  await connection.execute(
    `INSERT INTO course_completion_rules (
       course_id, required_progress_percent, required_post_test_score,
       require_all_assignments, certificate_enabled
     )
     VALUES (?, 80, 70, TRUE, TRUE)`,
    [courseId],
  );
}

async function insertAuditLog(connection, userId, courseId, slug) {
  await connection.execute(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
     VALUES (?, 'course.import_ai_office_free', 'course', ?, ?)`,
    [
      userId,
      courseId,
      JSON.stringify({
        slug,
        source: "scripts/import-ai-office-course.mjs",
        importedAt: new Date().toISOString(),
      }),
    ],
  );
}

async function countImportedRows(connection, courseId) {
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM course_sections WHERE course_id = ?) AS sections,
       (SELECT COUNT(*) FROM lessons l JOIN course_sections s ON s.id = l.section_id WHERE s.course_id = ?) AS lessons,
       (SELECT COUNT(*) FROM lesson_resources lr JOIN lessons l ON l.id = lr.lesson_id JOIN course_sections s ON s.id = l.section_id WHERE s.course_id = ?) AS lesson_resources,
       (SELECT COUNT(*) FROM assessments WHERE course_id = ?) AS assessments,
       (SELECT COUNT(*) FROM questions q JOIN assessments a ON a.id = q.assessment_id WHERE a.course_id = ?) AS questions,
       (SELECT COUNT(*) FROM learning_tasks WHERE course_id = ?) AS tasks,
       (SELECT COUNT(*) FROM learning_task_rubrics r JOIN learning_tasks t ON t.id = r.task_id WHERE t.course_id = ?) AS rubrics`,
    [courseId, courseId, courseId, courseId, courseId, courseId, courseId],
  );

  return rows[0] ?? {};
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const course = manifest.course;

assert(course?.slug, "Manifest course.slug is required.");
assert(Array.isArray(manifest.sections) && manifest.sections.length > 0, "Manifest sections are required.");
assert(Array.isArray(manifest.lessons) && manifest.lessons.length > 0, "Manifest lessons are required.");

await validateFiles(manifest);

let connection;

try {
  connection = await createConnection({ includeDatabase: true });
  await connection.beginTransaction();

  const categoryId = await upsertCategory(connection, course);
  const { instructorId, adminUserId } = await upsertInstructor(connection, course);
  const replacedExisting = await deleteExistingDraftCourse(connection, course.slug);
  const courseId = await insertCourse(connection, course, categoryId, instructorId);

  await insertOrderedText(connection, "course_outcomes", courseId, "outcome", manifest.outcomes ?? []);
  await insertOrderedText(connection, "course_requirements", courseId, "requirement", manifest.requirements ?? []);
  await insertOrderedText(connection, "course_audiences", courseId, "audience", manifest.audience ?? []);

  const sectionIds = await insertSections(connection, manifest, courseId);
  const lessonIds = await insertLessons(connection, manifest, sectionIds);
  await insertAssessments(connection, manifest, courseId, sectionIds);
  await insertTasks(connection, manifest, courseId, sectionIds, lessonIds);
  await insertEvaluationRules(connection, manifest, courseId);
  await insertAuditLog(connection, adminUserId, courseId, course.slug);

  const counts = await countImportedRows(connection, courseId);

  await connection.commit();

  console.log(
    JSON.stringify(
      {
        ok: true,
        courseId,
        slug: course.slug,
        replacedExisting,
        instructorId,
        categoryId,
        counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])),
      },
      null,
      2,
    ),
  );
} catch (error) {
  await connection?.rollback();
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  await connection?.end();
}
