import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createConnection, getDatabaseConfig } from "./db/common.mjs";

const projectRoot = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const args = new Set(process.argv.slice(2));
const applyMode = args.has("--apply");

dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const sourceDatabase = readArgValue("--source-db") ?? "modulestd";
const sourceDatabaseUrl = readArgValue("--source-url") ?? process.env.SOURCE_DATABASE_URL ?? null;
const sourcePublicRoot =
  readArgValue("--source-public") ??
  process.env.SOURCE_PUBLIC_ROOT ??
  "C:\\xampp\\htdocs\\modulestd1\\public";
const reportPath =
  readArgValue("--report") ??
  path.join(projectRoot, "backups", `modulestd-import-report-${timestamp}.json`);

const oldCourseCodeToTargetSlug = new Map([
  ["WORD", "microsoft-word"],
  ["EXCEL", "microsoft-excel-office"],
]);

const courseKeywordBySlug = new Map([
  ["microsoft-word", "word"],
  ["microsoft-excel-office", "excel"],
]);

const oldRoleToNewRole = {
  LEARNER: "student",
  INSTRUCTOR: "instructor",
  ASSESSOR: "staff",
  ADMIN: "admin",
};

const oldStatusToNewStatus = {
  ACTIVE: "active",
  PENDING: "pending",
  SUSPENDED: "disabled",
};

const oldEnrollmentStatusToNewStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const oldSubmissionStatusToNewStatus = {
  SUBMITTED: "submitted",
  NEEDS_REVISION: "needs_revision",
  PASSED: "passed",
  NOT_PASSED: "not_passed",
};

const rolePriority = {
  student: 1,
  instructor: 2,
  staff: 3,
  admin: 4,
};

function readArgValue(flag) {
  const token = [...args].find((value) => value.startsWith(`${flag}=`));
  return token ? token.slice(flag.length + 1) : null;
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/บทเรียนที่\s*\d+\s*/gu, "")
    .replace(/ใบงาน(?:\s*(word|excel|ai))?\s*ที่\s*\d+\s*[:：-]?\s*/giu, "")
    .replace(/lesson\s*\d+\s*/giu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function basenameFromUrl(url) {
  return decodeURIComponent(String(url ?? "").split("?")[0].split("/").filter(Boolean).at(-1) ?? "");
}

function extractLessonNumber(title) {
  const match = String(title ?? "").match(/บทเรียนที่\s*(\d+)/u);
  return match ? Number(match[1]) : null;
}

function preferredRole(existingRole, incomingRole) {
  const left = rolePriority[existingRole] ?? 0;
  const right = rolePriority[incomingRole] ?? 0;
  return left >= right ? existingRole : incomingRole;
}

function deriveProgressPercent({ totalLessons, completedLessons, inProgressLessons, totalTasks, submittedTasks }) {
  const lessonPercent =
    totalLessons > 0 ? ((completedLessons + inProgressLessons * 0.5) / totalLessons) * 100 : 0;
  const taskPercent = totalTasks > 0 ? (submittedTasks / totalTasks) * 100 : 0;
  return Math.max(lessonPercent, taskPercent);
}

async function ensureDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyPublicAsset(url, destinationPublicRoot, report) {
  if (!sourcePublicRoot) {
    report.files.missing.push(`${url} (source public root not configured)`);
    return url;
  }

  if (!url || !String(url).startsWith("/")) {
    return null;
  }

  const relativePath = String(url).replace(/^\//, "").replaceAll("/", path.sep);
  const sourceFile = path.join(sourcePublicRoot, relativePath);
  const targetFile = path.join(destinationPublicRoot, relativePath);

  try {
    await fs.access(sourceFile);
  } catch {
    report.files.missing.push(url);
    return url;
  }

  try {
    await fs.access(targetFile);
    report.files.skipped += 1;
    return url;
  } catch {
    await ensureDirectory(targetFile);
    await fs.copyFile(sourceFile, targetFile);
    report.files.copied += 1;
    return url;
  }
}

async function fetchTargetUsers(connection) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.status, u.last_login_at, p.phone
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.deleted_at IS NULL`,
  );
  return rows.map(toPlainObject);
}

async function fetchTargetCourseMap(connection) {
  const [rows] = await connection.execute(
    `SELECT id, slug, title
     FROM courses
     WHERE deleted_at IS NULL`,
  );

  const bySlug = new Map();
  for (const row of rows.map(toPlainObject)) {
    bySlug.set(row.slug, row);
  }
  return bySlug;
}

async function fetchTargetLessonMaps(connection, targetCourseIds) {
  if (!targetCourseIds.length) {
    return { byCourseAndNumber: new Map(), byCourseAndTitle: new Map() };
  }

  const placeholders = targetCourseIds.map(() => "?").join(", ");
  const [rows] = await connection.execute(
    `SELECT s.course_id, l.id, l.title
     FROM course_sections s
     JOIN lessons l ON l.section_id = s.id
     WHERE s.course_id IN (${placeholders})
       AND s.deleted_at IS NULL
       AND l.deleted_at IS NULL
       AND s.status = 'published'
       AND l.status = 'published'
     ORDER BY s.course_id, l.id`,
    targetCourseIds,
  );

  const byCourseAndNumber = new Map();
  const byCourseAndTitle = new Map();

  for (const row of rows.map(toPlainObject)) {
    const lessonNumber = extractLessonNumber(row.title);
    if (lessonNumber !== null) {
      const key = `${row.course_id}:${lessonNumber}`;
      if (!byCourseAndNumber.has(key)) {
        byCourseAndNumber.set(key, row);
      }
    }

    const normalizedTitle = normalizeText(row.title);
    if (normalizedTitle) {
      const key = `${row.course_id}:${normalizedTitle}`;
      if (!byCourseAndTitle.has(key)) {
        byCourseAndTitle.set(key, row);
      }
    }
  }

  return { byCourseAndNumber, byCourseAndTitle };
}

async function fetchSourceSnapshot(connection) {
  const [
    usersRows,
    memberProfileRows,
    courseRows,
    lessonRows,
    worksheetRows,
    enrollmentRows,
    lessonProgressRows,
    submissionRows,
    evidenceRows,
  ] = await Promise.all([
    connection.execute(
      `SELECT id, email, password_hash, first_name, last_name, phone, role, status, last_login_at, created_at
       FROM users
       ORDER BY created_at, id`,
    ),
    connection.execute(
      `SELECT user_id, audience_type, organization, education_level, province, consent_accepted_at
       FROM member_profiles`,
    ),
    connection.execute(
      `SELECT id, module_id, code, title, total_worksheets
       FROM courses`,
    ),
    connection.execute(
      `SELECT id, course_id, order_no, title
       FROM course_lessons`,
    ),
    connection.execute(
      `SELECT id, course_id, order_no, title, worksheet_type
       FROM worksheets`,
    ),
    connection.execute(
      `SELECT id, user_id, course_id, status, enrolled_at, completed_at
       FROM enrollments`,
    ),
    connection.execute(
      `SELECT id, user_id, lesson_id, status, started_at, completed_at, last_viewed_at, view_count, created_at
       FROM lesson_progress`,
    ),
    connection.execute(
      `SELECT id, user_id, worksheet_id, work_url, note, status, score, feedback, submitted_at, reviewed_at, reviewer_id
       FROM worksheet_submissions`,
    ),
    connection.execute(
      `SELECT id, user_id, worksheet_id, submission_id, evidence_no, image_url, captured_at, created_at
       FROM submission_evidence`,
    ),
  ]);

  return {
    users: usersRows[0].map(toPlainObject),
    memberProfiles: memberProfileRows[0].map(toPlainObject),
    courses: courseRows[0].map(toPlainObject),
    lessons: lessonRows[0].map(toPlainObject),
    worksheets: worksheetRows[0].map(toPlainObject),
    enrollments: enrollmentRows[0].map(toPlainObject),
    lessonProgress: lessonProgressRows[0].map(toPlainObject),
    worksheetSubmissions: submissionRows[0].map(toPlainObject),
    submissionEvidence: evidenceRows[0].map(toPlainObject),
  };
}

async function main() {
  const report = {
    sourceDatabase,
    applyMode,
    generatedAt: new Date().toISOString(),
    mappings: {
      courses: [],
      skippedCourses: [],
    },
    users: {
      sourceCount: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    profiles: {
      upserted: 0,
    },
    enrollments: {
      sourceCount: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    lessonProgress: {
      sourceCount: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    submissions: {
      sourceCount: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    evidences: {
      sourceCount: 0,
      inserted: 0,
      skipped: 0,
    },
    files: {
      copied: 0,
      skipped: 0,
      missing: [],
    },
    warnings: [],
  };

  const destinationPublicRoot = path.join(projectRoot, "public");
  const dbConfig = getDatabaseConfig();
  const parsedSourceUrl = sourceDatabaseUrl ? new URL(sourceDatabaseUrl) : null;
  const sourceConnection = await mysql.createConnection({
    host: parsedSourceUrl?.hostname || dbConfig.host,
    port: Number(parsedSourceUrl?.port || 3306),
    user: parsedSourceUrl ? decodeURIComponent(parsedSourceUrl.username || "root") : dbConfig.user,
    password: parsedSourceUrl ? decodeURIComponent(parsedSourceUrl.password || "") : dbConfig.password,
    database: parsedSourceUrl ? parsedSourceUrl.pathname.replace(/^\//, "") : sourceDatabase,
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });
  const targetConnection = await createConnection();

  try {
    const [sourceSnapshot, targetUsers, targetCourseBySlug] = await Promise.all([
      fetchSourceSnapshot(sourceConnection),
      fetchTargetUsers(targetConnection),
      fetchTargetCourseMap(targetConnection),
    ]);

    report.users.sourceCount = sourceSnapshot.users.length;
    report.enrollments.sourceCount = sourceSnapshot.enrollments.length;
    report.lessonProgress.sourceCount = sourceSnapshot.lessonProgress.length;
    report.submissions.sourceCount = sourceSnapshot.worksheetSubmissions.length;
    report.evidences.sourceCount = sourceSnapshot.submissionEvidence.length;

    const sourceProfileByUserId = new Map(sourceSnapshot.memberProfiles.map((row) => [row.user_id, row]));
    const sourceCourseById = new Map(sourceSnapshot.courses.map((row) => [row.id, row]));
    const sourceLessonById = new Map(sourceSnapshot.lessons.map((row) => [row.id, row]));
    const sourceWorksheetById = new Map(sourceSnapshot.worksheets.map((row) => [row.id, row]));

    const mappedTargetCoursesByOldCourseId = new Map();
    for (const sourceCourse of sourceSnapshot.courses) {
      const mappedSlug = oldCourseCodeToTargetSlug.get(sourceCourse.code);
      if (!mappedSlug) {
        report.mappings.skippedCourses.push({
          sourceCourseId: sourceCourse.id,
          sourceCourseCode: sourceCourse.code,
          sourceCourseTitle: sourceCourse.title,
          reason: "No target slug mapping configured.",
        });
        continue;
      }

      const targetCourse = targetCourseBySlug.get(mappedSlug);
      if (!targetCourse) {
        report.mappings.skippedCourses.push({
          sourceCourseId: sourceCourse.id,
          sourceCourseCode: sourceCourse.code,
          sourceCourseTitle: sourceCourse.title,
          reason: `Target course slug '${mappedSlug}' was not found.`,
        });
        continue;
      }

      mappedTargetCoursesByOldCourseId.set(sourceCourse.id, targetCourse);
      report.mappings.courses.push({
        sourceCourseId: sourceCourse.id,
        sourceCourseCode: sourceCourse.code,
        sourceCourseTitle: sourceCourse.title,
        targetCourseId: targetCourse.id,
        targetCourseSlug: targetCourse.slug,
        targetCourseTitle: targetCourse.title,
      });
    }

    const targetCourseIds = [...new Set([...mappedTargetCoursesByOldCourseId.values()].map((row) => Number(row.id)))];
    const targetLessonMaps = await fetchTargetLessonMaps(targetConnection, targetCourseIds);
    const targetTaskMap = new Map();

    if (targetCourseIds.length) {
      const placeholders = targetCourseIds.map(() => "?").join(", ");
      const [taskRows] = await targetConnection.execute(
        `SELECT course_id, id, sort_order, title
         FROM learning_tasks
         WHERE course_id IN (${placeholders})
           AND deleted_at IS NULL
           AND status = 'published'
         ORDER BY course_id, sort_order, id`,
        targetCourseIds,
      );

      for (const row of taskRows.map(toPlainObject)) {
        const key = `${row.course_id}:${row.sort_order}`;
        const current = targetTaskMap.get(key);
        if (!current) {
          targetTaskMap.set(key, row);
          continue;
        }

        const targetCourse = [...mappedTargetCoursesByOldCourseId.values()].find(
          (course) => Number(course.id) === Number(row.course_id),
        );
        const keyword = targetCourse ? courseKeywordBySlug.get(targetCourse.slug) ?? "" : "";
        const currentScore = keyword && String(current.title).toLowerCase().includes(keyword) ? 1 : 0;
        const nextScore = keyword && String(row.title).toLowerCase().includes(keyword) ? 1 : 0;
        if (nextScore > currentScore || (nextScore === currentScore && Number(row.id) > Number(current.id))) {
          targetTaskMap.set(key, row);
        }
      }
    }

    const targetUsersByEmail = new Map(targetUsers.map((row) => [String(row.email).toLowerCase(), row]));
    const userIdMap = new Map();

    const enrollmentStateBySourceKey = new Map();
    const lessonSummaryByEnrollmentKey = new Map();
    const submissionSummaryByEnrollmentKey = new Map();

    if (applyMode) {
      await targetConnection.beginTransaction();
    }

    for (const sourceUser of sourceSnapshot.users) {
      const email = String(sourceUser.email).trim().toLowerCase();
      const name = [sourceUser.first_name, sourceUser.last_name].filter(Boolean).join(" ").trim();
      const incomingRole = oldRoleToNewRole[sourceUser.role] ?? "student";
      const incomingStatus = oldStatusToNewStatus[sourceUser.status] ?? "active";
      const existing = targetUsersByEmail.get(email) ?? null;

      let targetUserId = existing ? Number(existing.id) : null;
      const mergedRole = existing ? preferredRole(existing.role, incomingRole) : incomingRole;

      if (applyMode) {
        if (existing) {
          await targetConnection.execute(
            `UPDATE users
             SET name = ?,
                 password_hash = ?,
                 role = ?,
                 status = ?,
                 last_login_at = CASE
                   WHEN ? IS NULL THEN last_login_at
                   WHEN last_login_at IS NULL OR last_login_at < ? THEN ?
                   ELSE last_login_at
                 END
             WHERE id = ?`,
            [
              name || existing.name,
              sourceUser.password_hash,
              mergedRole,
              incomingStatus,
              sourceUser.last_login_at,
              sourceUser.last_login_at,
              sourceUser.last_login_at,
              existing.id,
            ],
          );
          report.users.updated += 1;
        } else {
          const [result] = await targetConnection.execute(
            `INSERT INTO users (name, email, password_hash, role, status, last_login_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name || email, email, sourceUser.password_hash, mergedRole, incomingStatus, sourceUser.last_login_at],
          );
          targetUserId = Number(result.insertId);
          report.users.inserted += 1;
        }

        if (!targetUserId) {
          const [rows] = await targetConnection.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [email],
          );
          targetUserId = Number(rows[0]?.id ?? 0);
        }

        const sourceProfile = sourceProfileByUserId.get(sourceUser.id);
        const profileNoteParts = [];
        if (sourceProfile?.organization) profileNoteParts.push(`Organization: ${sourceProfile.organization}`);
        if (sourceProfile?.education_level) profileNoteParts.push(`Education: ${sourceProfile.education_level}`);
        if (sourceProfile?.province) profileNoteParts.push(`Province: ${sourceProfile.province}`);
        const mergedAddress = profileNoteParts.join(" | ") || null;

        await targetConnection.execute(
          `INSERT INTO profiles (user_id, phone, address, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             phone = VALUES(phone),
             address = COALESCE(VALUES(address), address),
             updated_at = NOW()`,
          [targetUserId, sourceUser.phone || null, mergedAddress],
        );
        report.profiles.upserted += 1;
      } else {
        if (existing) {
          report.users.updated += 1;
          targetUserId = Number(existing.id);
        } else {
          report.users.inserted += 1;
          targetUserId = -(report.users.inserted + report.users.updated);
        }
        report.profiles.upserted += 1;
      }

      userIdMap.set(sourceUser.id, targetUserId);
      targetUsersByEmail.set(email, {
        ...(existing ?? {}),
        id: targetUserId,
        email,
        name,
        role: mergedRole,
        status: incomingStatus,
        phone: sourceUser.phone || null,
      });
    }

    for (const sourceEnrollment of sourceSnapshot.enrollments) {
      const targetUserId = userIdMap.get(sourceEnrollment.user_id);
      const sourceCourse = sourceCourseById.get(sourceEnrollment.course_id);
      const targetCourse = mappedTargetCoursesByOldCourseId.get(sourceEnrollment.course_id);

      if (!targetUserId || !sourceCourse || !targetCourse) {
        report.enrollments.skipped += 1;
        report.warnings.push(`Skipped enrollment ${sourceEnrollment.id}: unresolved user or course mapping.`);
        continue;
      }

      const targetStatus = oldEnrollmentStatusToNewStatus[sourceEnrollment.status] ?? "active";
      const enrollmentKey = `${sourceEnrollment.user_id}:${sourceEnrollment.course_id}`;
      let targetEnrollmentId = null;

      if (applyMode) {
        const [rows] = await targetConnection.execute(
          `SELECT id
           FROM enrollments
           WHERE user_id = ?
             AND course_id = ?
           LIMIT 1`,
          [targetUserId, targetCourse.id],
        );
        if (rows.length) {
          targetEnrollmentId = Number(rows[0].id);
          await targetConnection.execute(
            `UPDATE enrollments
             SET status = ?,
                 enrolled_at = LEAST(enrolled_at, ?),
                 completed_at = COALESCE(completed_at, ?)
             WHERE id = ?`,
            [targetStatus, sourceEnrollment.enrolled_at, sourceEnrollment.completed_at, targetEnrollmentId],
          );
          report.enrollments.updated += 1;
        } else {
          const [result] = await targetConnection.execute(
            `INSERT INTO enrollments (user_id, course_id, status, progress_percent, enrolled_at, completed_at)
             VALUES (?, ?, ?, 0, ?, ?)`,
            [targetUserId, targetCourse.id, targetStatus, sourceEnrollment.enrolled_at, sourceEnrollment.completed_at],
          );
          targetEnrollmentId = Number(result.insertId);
          report.enrollments.inserted += 1;
        }
      } else {
        targetEnrollmentId = -(report.enrollments.inserted + report.enrollments.updated + 1);
        report.enrollments.inserted += 1;
      }

      enrollmentStateBySourceKey.set(enrollmentKey, {
        targetEnrollmentId,
        sourceCourseId: sourceEnrollment.course_id,
        targetCourseId: Number(targetCourse.id),
        totalLessons: sourceSnapshot.lessons.filter((row) => row.course_id === sourceEnrollment.course_id).length,
        totalTasks: sourceCourse.total_worksheets ?? 0,
      });
    }

    for (const progressRow of sourceSnapshot.lessonProgress) {
      const sourceLesson = sourceLessonById.get(progressRow.lesson_id);
      if (!sourceLesson) {
        report.lessonProgress.skipped += 1;
        report.warnings.push(`Skipped lesson progress ${progressRow.id}: source lesson missing.`);
        continue;
      }

      const targetCourse = mappedTargetCoursesByOldCourseId.get(sourceLesson.course_id);
      const enrollmentState = enrollmentStateBySourceKey.get(`${progressRow.user_id}:${sourceLesson.course_id}`);
      if (!targetCourse || !enrollmentState) {
        report.lessonProgress.skipped += 1;
        report.warnings.push(`Skipped lesson progress ${progressRow.id}: target course/enrollment missing.`);
        continue;
      }

      const byNumber = targetLessonMaps.byCourseAndNumber.get(`${targetCourse.id}:${sourceLesson.order_no}`);
      const byTitle = targetLessonMaps.byCourseAndTitle.get(
        `${targetCourse.id}:${normalizeText(sourceLesson.title)}`,
      );
      const targetLesson = byNumber ?? byTitle ?? null;

      if (!targetLesson) {
        report.lessonProgress.skipped += 1;
        report.warnings.push(
          `Skipped lesson progress ${progressRow.id}: no target lesson match for ${sourceLesson.course_id}#${sourceLesson.order_no}.`,
        );
        continue;
      }

      const targetStatus =
        progressRow.status === "COMPLETED"
          ? "completed"
          : progressRow.status === "IN_PROGRESS"
            ? "in_progress"
            : "not_started";
      const progressPercent = targetStatus === "completed" ? 100 : targetStatus === "in_progress" ? 50 : 0;

      if (applyMode) {
        const [rows] = await targetConnection.execute(
          `SELECT id
           FROM lesson_progress
           WHERE enrollment_id = ?
             AND lesson_id = ?
           LIMIT 1`,
          [enrollmentState.targetEnrollmentId, targetLesson.id],
        );

        if (rows.length) {
          await targetConnection.execute(
            `UPDATE lesson_progress
             SET status = ?,
                 progress_percent = GREATEST(progress_percent, ?),
                 completed_at = COALESCE(completed_at, ?)
             WHERE id = ?`,
            [targetStatus, progressPercent, progressRow.completed_at, rows[0].id],
          );
          report.lessonProgress.updated += 1;
        } else {
          await targetConnection.execute(
            `INSERT INTO lesson_progress (enrollment_id, lesson_id, status, progress_percent, last_position_seconds, completed_at)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [enrollmentState.targetEnrollmentId, targetLesson.id, targetStatus, progressPercent, progressRow.completed_at],
          );
          report.lessonProgress.inserted += 1;
        }
      } else {
        report.lessonProgress.inserted += 1;
      }

      const summary = lessonSummaryByEnrollmentKey.get(enrollmentState.targetEnrollmentId) ?? {
        completedLessons: 0,
        inProgressLessons: 0,
      };
      if (targetStatus === "completed") summary.completedLessons += 1;
      if (targetStatus === "in_progress") summary.inProgressLessons += 1;
      lessonSummaryByEnrollmentKey.set(enrollmentState.targetEnrollmentId, summary);
    }

    const submissionIdBySourceSubmissionId = new Map();
    for (const submissionRow of sourceSnapshot.worksheetSubmissions) {
      const worksheet = sourceWorksheetById.get(submissionRow.worksheet_id);
      if (!worksheet) {
        report.submissions.skipped += 1;
        report.warnings.push(`Skipped submission ${submissionRow.id}: source worksheet missing.`);
        continue;
      }

      const targetCourse = mappedTargetCoursesByOldCourseId.get(worksheet.course_id);
      const enrollmentState = enrollmentStateBySourceKey.get(`${submissionRow.user_id}:${worksheet.course_id}`);
      if (!targetCourse || !enrollmentState) {
        report.submissions.skipped += 1;
        report.warnings.push(`Skipped submission ${submissionRow.id}: target course/enrollment missing.`);
        continue;
      }

      const targetTask = targetTaskMap.get(`${targetCourse.id}:${worksheet.order_no}`) ?? null;
      if (!targetTask) {
        report.submissions.skipped += 1;
        report.warnings.push(
          `Skipped submission ${submissionRow.id}: no target task match for ${worksheet.course_id}#${worksheet.order_no}.`,
        );
        continue;
      }

      const targetStatus = oldSubmissionStatusToNewStatus[submissionRow.status] ?? "submitted";
      const gradedBy = submissionRow.reviewer_id ? userIdMap.get(submissionRow.reviewer_id) ?? null : null;
      let targetSubmissionId = null;

      if (applyMode) {
        const [rows] = await targetConnection.execute(
          `SELECT id
           FROM learning_task_submissions
           WHERE task_id = ?
             AND enrollment_id = ?
           LIMIT 1`,
          [targetTask.id, enrollmentState.targetEnrollmentId],
        );

        if (rows.length) {
          targetSubmissionId = Number(rows[0].id);
          await targetConnection.execute(
            `UPDATE learning_task_submissions
             SET submitted_link_url = ?,
                 note = ?,
                 status = ?,
                 score = ?,
                 feedback = ?,
                 submitted_at = COALESCE(submitted_at, ?),
                 graded_at = COALESCE(graded_at, ?),
                 graded_by = COALESCE(graded_by, ?),
                 submitted_file_url = NULL,
                 submitted_file_name = NULL
             WHERE id = ?`,
            [
              submissionRow.work_url || null,
              submissionRow.note || null,
              targetStatus,
              submissionRow.score,
              submissionRow.feedback || null,
              submissionRow.submitted_at,
              submissionRow.reviewed_at,
              gradedBy,
              targetSubmissionId,
            ],
          );
          report.submissions.updated += 1;
        } else {
          const [result] = await targetConnection.execute(
            `INSERT INTO learning_task_submissions (
               task_id,
               enrollment_id,
               submission_no,
               submitted_link_url,
               note,
               status,
               score,
               feedback,
               submitted_at,
               graded_at,
               graded_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              targetTask.id,
              enrollmentState.targetEnrollmentId,
              `MODSTD-${submissionRow.id}`,
              submissionRow.work_url || null,
              submissionRow.note || null,
              targetStatus,
              submissionRow.score,
              submissionRow.feedback || null,
              submissionRow.submitted_at,
              submissionRow.reviewed_at,
              gradedBy,
            ],
          );
          targetSubmissionId = Number(result.insertId);
          report.submissions.inserted += 1;
        }
      } else {
        targetSubmissionId = -(report.submissions.inserted + report.submissions.updated + 1);
        report.submissions.inserted += 1;
      }

      submissionIdBySourceSubmissionId.set(submissionRow.id, targetSubmissionId);

      const summary = submissionSummaryByEnrollmentKey.get(enrollmentState.targetEnrollmentId) ?? {
        submittedTasks: 0,
      };
      summary.submittedTasks += 1;
      submissionSummaryByEnrollmentKey.set(enrollmentState.targetEnrollmentId, summary);
    }

    for (const evidenceRow of sourceSnapshot.submissionEvidence) {
      const worksheet = sourceWorksheetById.get(evidenceRow.worksheet_id);
      if (!worksheet || !evidenceRow.image_url) {
        report.evidences.skipped += 1;
        continue;
      }

      const targetCourse = mappedTargetCoursesByOldCourseId.get(worksheet.course_id);
      const enrollmentState = enrollmentStateBySourceKey.get(`${evidenceRow.user_id}:${worksheet.course_id}`);
      if (!targetCourse || !enrollmentState) {
        report.evidences.skipped += 1;
        continue;
      }

      const targetTask = targetTaskMap.get(`${targetCourse.id}:${worksheet.order_no}`) ?? null;
      if (!targetTask) {
        report.evidences.skipped += 1;
        continue;
      }

      const copiedUrl = applyMode
        ? await copyPublicAsset(evidenceRow.image_url, destinationPublicRoot, report)
        : evidenceRow.image_url;

      const targetSubmissionId =
        (evidenceRow.submission_id && submissionIdBySourceSubmissionId.get(evidenceRow.submission_id)) ||
        submissionIdBySourceSubmissionId.get(
          sourceSnapshot.worksheetSubmissions.find(
            (row) => row.user_id === evidenceRow.user_id && row.worksheet_id === evidenceRow.worksheet_id,
          )?.id,
        ) ||
        null;

      if (applyMode) {
        const [rows] = await targetConnection.execute(
          `SELECT id
           FROM learning_task_evidences
           WHERE task_id = ?
             AND enrollment_id = ?
             AND sort_order = ?
             AND COALESCE(evidence_url, '') = COALESCE(?, '')
           LIMIT 1`,
          [targetTask.id, enrollmentState.targetEnrollmentId, evidenceRow.evidence_no, copiedUrl || null],
        );

        if (rows.length) {
          report.evidences.skipped += 1;
          continue;
        }

        await targetConnection.execute(
          `INSERT INTO learning_task_evidences (
             submission_id,
             task_id,
             enrollment_id,
             evidence_type,
             evidence_url,
             file_name,
             sort_order
           ) VALUES (?, ?, ?, 'image', ?, ?, ?)`,
          [
            targetSubmissionId,
            targetTask.id,
            enrollmentState.targetEnrollmentId,
            copiedUrl,
            basenameFromUrl(copiedUrl),
            evidenceRow.evidence_no || 0,
          ],
        );
      }

      report.evidences.inserted += 1;
    }

    for (const enrollmentState of enrollmentStateBySourceKey.values()) {
      const lessonSummary = lessonSummaryByEnrollmentKey.get(enrollmentState.targetEnrollmentId) ?? {
        completedLessons: 0,
        inProgressLessons: 0,
      };
      const submissionSummary = submissionSummaryByEnrollmentKey.get(enrollmentState.targetEnrollmentId) ?? {
        submittedTasks: 0,
      };
      const progressPercent = deriveProgressPercent({
        totalLessons: enrollmentState.totalLessons,
        completedLessons: lessonSummary.completedLessons,
        inProgressLessons: lessonSummary.inProgressLessons,
        totalTasks: enrollmentState.totalTasks,
        submittedTasks: submissionSummary.submittedTasks,
      });

      if (applyMode) {
        await targetConnection.execute(
          `UPDATE enrollments
           SET progress_percent = GREATEST(progress_percent, ?)
           WHERE id = ?`,
          [Number(progressPercent.toFixed(2)), enrollmentState.targetEnrollmentId],
        );
      }
    }

    if (applyMode) {
      await targetConnection.commit();
    }

    await ensureDirectory(reportPath);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log(JSON.stringify(report, null, 2));
    console.log(`Report written to ${reportPath}`);
  } catch (error) {
    if (applyMode) {
      await targetConnection.rollback().catch(() => {});
    }
    throw error;
  } finally {
    await Promise.allSettled([sourceConnection.end(), targetConnection.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
