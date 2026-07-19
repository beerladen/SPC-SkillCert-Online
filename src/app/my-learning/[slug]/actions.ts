"use server";

import { revalidatePath } from "next/cache";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getPool } from "@/lib/db";
import { learningSubmissionFileEvidenceMarker } from "@/lib/learning-task-files";
import {
  deletePublicUploadFiles,
  isUploadFileEntry,
  learningSubmissionUploadPolicy,
  type SavedUpload,
  saveValidatedUpload,
} from "@/lib/upload-security";

interface ActionResult {
  ok: boolean;
  message: string;
  event?:
    | "lesson_started"
    | "lesson_completed"
    | "all_lessons_completed"
    | "task_submitted"
    | "all_tasks_submitted"
    | "pre_test_completed"
    | "post_test_completed"
    | "assessment_completed";
  nextTab?: "lessons" | "tests" | "tasks" | "result";
  scorePercent?: number;
  passed?: boolean;
  assessmentType?: string;
  completedLessons?: number;
  totalLessons?: number;
  submittedTasks?: number;
  totalTasks?: number;
}

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value)) throw new Error(`ข้อมูล ${key} ไม่ถูกต้อง`);
  return value;
}

function learnerEmailForAction(
  formData: FormData,
  user: Awaited<ReturnType<typeof requireCurrentUser>>,
) {
  const requestedLearnerEmail = text(formData, "learnerEmail");
  if (requestedLearnerEmail && user.role !== "student") {
    return requestedLearnerEmail;
  }

  return user.email;
}

function uploadEntries(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(isUploadFileEntry);
}

async function deleteReplacedSubmissionFiles(fileUrls: Array<string | null>) {
  if (fileUrls.length === 0) return;

  try {
    await deletePublicUploadFiles(fileUrls);
  } catch (error) {
    console.warn("Could not delete replaced learning task upload files", error);
  }
}

async function getEnrollment(
  connection: PoolConnection,
  slug: string,
  learnerEmail: string,
) {
  const [rows] = await connection.execute<
    Array<RowDataPacket & { id: number; user_id: number; course_id: number }>
  >(
    `SELECT e.id, e.user_id, e.course_id
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     JOIN courses c ON c.id = e.course_id
     WHERE u.email = ? AND c.slug = ?
     LIMIT 1`,
    [learnerEmail, slug],
  );

  if (!rows[0]) throw new Error("ไม่พบสิทธิ์เข้าเรียนของบัญชีผู้เรียนทดสอบ");
  return {
    id: Number(rows[0].id),
    userId: Number(rows[0].user_id),
    courseId: Number(rows[0].course_id),
  };
}

async function refreshEnrollmentProgress(connection: PoolConnection, enrollmentId: number, courseId: number) {
  const [lessonRows] = await connection.execute<Array<RowDataPacket & { total: number; completed: number }>>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM lessons l
     JOIN course_sections s ON s.id = l.section_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = ?
     WHERE s.course_id = ? AND l.status = 'published' AND l.deleted_at IS NULL`,
    [enrollmentId, courseId],
  );
  const [taskRows] = await connection.execute<Array<RowDataPacket & { total: number; passed: number }>>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN sub.status IN ('passed', 'graded') AND COALESCE(sub.score, 0) >= t.passing_score THEN 1 ELSE 0 END) AS passed
     FROM learning_tasks t
     LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id AND sub.enrollment_id = ?
     WHERE t.course_id = ? AND t.status = 'published' AND t.deleted_at IS NULL`,
    [enrollmentId, courseId],
  );
  const [postRows] = await connection.execute<Array<RowDataPacket & { score_percent: number | null }>>(
    `SELECT MAX(CASE WHEN aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 ELSE 0 END) AS score_percent
     FROM assessment_attempts aa
     JOIN assessments a ON a.id = aa.assessment_id
     WHERE aa.enrollment_id = ? AND a.course_id = ? AND a.type = 'post_test'`,
    [enrollmentId, courseId],
  );

  const lessonTotal = Number(lessonRows[0]?.total ?? 0);
  const lessonCompleted = Number(lessonRows[0]?.completed ?? 0);
  const taskTotal = Number(taskRows[0]?.total ?? 0);
  const taskPassed = Number(taskRows[0]?.passed ?? 0);
  const lessonPercent = lessonTotal > 0 ? (lessonCompleted / lessonTotal) * 100 : 100;
  const taskPercent = taskTotal > 0 ? (taskPassed / taskTotal) * 100 : 100;
  const postPercent = Number(postRows[0]?.score_percent ?? 0);
  const progress = Math.round((lessonPercent * 0.45 + taskPercent * 0.35 + postPercent * 0.2) * 10) / 10;

  await connection.execute(
    `UPDATE enrollments
     SET progress_percent = ?, status = IF(? >= 100, 'completed', status),
         completed_at = IF(? >= 100, COALESCE(completed_at, NOW()), completed_at)
     WHERE id = ?`,
    [Math.min(100, progress), progress, progress, enrollmentId],
  );
}

async function getLessonCompletionSummary(
  connection: PoolConnection,
  enrollmentId: number,
  courseId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { total: number; completed: number }>>(
    `SELECT COUNT(DISTINCT l.id) AS total,
            COUNT(DISTINCT CASE WHEN lp.status = 'completed' THEN l.id END) AS completed
     FROM lessons l
     JOIN course_sections s ON s.id = l.section_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = ?
     WHERE s.course_id = ?
       AND s.deleted_at IS NULL
       AND l.status = 'published'
       AND l.deleted_at IS NULL`,
    [enrollmentId, courseId],
  );

  return {
    totalLessons: Number(rows[0]?.total ?? 0),
    completedLessons: Number(rows[0]?.completed ?? 0),
  };
}

async function getTaskSubmissionSummary(
  connection: PoolConnection,
  enrollmentId: number,
  courseId: number,
) {
  const [rows] = await connection.execute<Array<RowDataPacket & { total: number; submitted: number }>>(
    `SELECT COUNT(DISTINCT t.id) AS total,
            COUNT(DISTINCT CASE
              WHEN sub.id IS NOT NULL AND sub.status <> 'draft' THEN t.id
            END) AS submitted
     FROM learning_tasks t
     LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id AND sub.enrollment_id = ?
     WHERE t.course_id = ?
       AND t.task_type IN ('worksheet', 'practice')
       AND t.status = 'published'
       AND t.deleted_at IS NULL`,
    [enrollmentId, courseId],
  );

  return {
    totalTasks: Number(rows[0]?.total ?? 0),
    submittedTasks: Number(rows[0]?.submitted ?? 0),
  };
}

export async function updateLessonProgressAction(formData: FormData): Promise<ActionResult> {
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const slug = text(formData, "slug");
    const lessonId = numberValue(formData, "lessonId");
    const intent = text(formData, "intent", "start");
    const learnerEmail = learnerEmailForAction(formData, user);
    const enrollment = await getEnrollment(connection, slug, learnerEmail);
    const status = intent === "complete" ? "completed" : "in_progress";
    const progressPercent = intent === "complete" ? 100 : 30;
    const [previousRows] = await connection.execute<Array<RowDataPacket & { status: string | null }>>(
      "SELECT status FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ? LIMIT 1",
      [enrollment.id, lessonId],
    );
    const wasCompleted = previousRows[0]?.status === "completed";

    await connection.execute(
      `INSERT INTO lesson_progress
         (enrollment_id, lesson_id, status, progress_percent, completed_at)
       VALUES (?, ?, ?, ?, IF(? = 'completed', NOW(), NULL))
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         progress_percent = GREATEST(progress_percent, VALUES(progress_percent)),
         completed_at = IF(VALUES(status) = 'completed', COALESCE(completed_at, NOW()), completed_at)`,
      [enrollment.id, lessonId, status, progressPercent, status],
    );

    await refreshEnrollmentProgress(connection, enrollment.id, enrollment.courseId);
    const lessonSummary = await getLessonCompletionSummary(connection, enrollment.id, enrollment.courseId);
    const allLessonsCompleted =
      lessonSummary.totalLessons > 0 &&
      lessonSummary.completedLessons >= lessonSummary.totalLessons;
    revalidatePath(`/my-learning/${slug}`);
    revalidatePath(`/admin/learning/${slug}/preview`);
    revalidatePath("/my-learning");

    if (status === "completed" && allLessonsCompleted && !wasCompleted) {
      return {
        ok: true,
        message: "ยินดีด้วย คุณเรียนออนไลน์ครบทุกบทแล้ว ต่อไปสามารถทำใบงาน/แบบฝึกได้เลย",
        event: "all_lessons_completed",
        nextTab: "tasks",
        ...lessonSummary,
      };
    }

    return {
      ok: true,
      message: status === "completed" ? "บันทึกว่าเรียนจบบทนี้แล้ว" : "บันทึกความคืบหน้าบทเรียนแล้ว",
      event: status === "completed" && !wasCompleted ? "lesson_completed" : "lesson_started",
      nextTab: "lessons",
      ...lessonSummary,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกความคืบหน้าไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function submitLearningTaskAction(formData: FormData): Promise<ActionResult> {
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();
  let replacedFileUrls: Array<string | null> = [];

  try {
    await connection.beginTransaction();
    const slug = text(formData, "slug");
    const taskId = numberValue(formData, "taskId");
    const learnerEmail = learnerEmailForAction(formData, user);
    const enrollment = await getEnrollment(connection, slug, learnerEmail);
    const [existingSubmissionRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          status: string;
          submitted_file_url: string | null;
        }
      >
    >(
      `SELECT id, status, submitted_file_url
       FROM learning_task_submissions
       WHERE task_id = ? AND enrollment_id = ?
       LIMIT 1`,
      [taskId, enrollment.id],
    );
    const existingSubmission = existingSubmissionRows[0] ?? null;
    const replacePreviousSubmission = existingSubmission?.status === "needs_revision";

    if (replacePreviousSubmission) {
      const [oldEvidenceRows] = await connection.execute<
        Array<RowDataPacket & { evidence_url: string | null }>
      >(
        `SELECT evidence_url
         FROM learning_task_evidences
         WHERE submission_id = ? AND task_id = ? AND enrollment_id = ?`,
        [existingSubmission.id, taskId, enrollment.id],
      );
      replacedFileUrls = [
        existingSubmission.submitted_file_url,
        ...oldEvidenceRows.map((row) => row.evidence_url),
      ];
    }

    const uploaded = await saveValidatedUpload(formData.get("submissionFile"), {
      ...learningSubmissionUploadPolicy,
      rootFolder: "learning-submissions",
      publicBasePath: "/uploads/learning-submissions",
      ownerSegment: enrollment.id,
      fallbackName: "submission",
      label: "ไฟล์งาน",
    });
    const submittedFileUploads: SavedUpload[] = uploaded ? [uploaded] : [];
    for (const [index, file] of uploadEntries(formData, "submissionFile").slice(uploaded ? 1 : 0).entries()) {
      const extraUpload = await saveValidatedUpload(file, {
        ...learningSubmissionUploadPolicy,
        rootFolder: "learning-submissions",
        publicBasePath: "/uploads/learning-submissions",
        ownerSegment: enrollment.id,
        fallbackName: `submission-extra-${index + 1}`,
        label: "ไฟล์งานเพิ่มเติม",
      });
      if (extraUpload) submittedFileUploads.push(extraUpload);
    }
    const evidenceFileUploads: SavedUpload[] = [];
    for (const [index, file] of uploadEntries(formData, "evidenceFiles").entries()) {
      const evidenceUpload = await saveValidatedUpload(file, {
        ...learningSubmissionUploadPolicy,
        rootFolder: "learning-submissions",
        publicBasePath: "/uploads/learning-submissions",
        ownerSegment: enrollment.id,
        fallbackName: `evidence-${index + 1}`,
        label: "ไฟล์หลักฐาน",
      });
      if (evidenceUpload) evidenceFileUploads.push(evidenceUpload);
    }
    const submittedLink = text(formData, "submittedLinkUrl");
    const answerText = text(formData, "answerText");
    const note = text(formData, "note");
    const evidenceText = text(formData, "evidenceText");
    const evidenceUrl = text(formData, "evidenceUrl");

    if (!submittedFileUploads.length && !evidenceFileUploads.length && !submittedLink && !answerText && !evidenceText && !evidenceUrl) {
      throw new Error("กรุณาแนบไฟล์ วางลิงก์ หรือกรอกคำตอบก่อนส่งงาน");
    }

    const submissionNo = `TASK-${Date.now()}-${taskId}-${enrollment.id}`.slice(0, 60);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO learning_task_submissions (
         task_id, enrollment_id, submission_no, answer_text, submitted_file_url,
         submitted_file_name, submitted_link_url, note, status, submitted_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', NOW())
       ON DUPLICATE KEY UPDATE
         answer_text = VALUES(answer_text),
         submitted_file_url = IF(? = 1, VALUES(submitted_file_url), COALESCE(VALUES(submitted_file_url), submitted_file_url)),
         submitted_file_name = IF(? = 1, VALUES(submitted_file_name), COALESCE(VALUES(submitted_file_name), submitted_file_name)),
         submitted_link_url = VALUES(submitted_link_url),
         note = VALUES(note),
         status = 'pending_review',
         score = NULL,
         feedback = NULL,
         submitted_at = NOW(),
         graded_at = NULL,
         graded_by = NULL`,
      [
        taskId,
        enrollment.id,
        submissionNo,
        answerText || null,
        uploaded?.fileUrl ?? null,
        uploaded?.fileName ?? null,
        submittedLink || null,
        note || null,
        replacePreviousSubmission ? 1 : 0,
        replacePreviousSubmission ? 1 : 0,
      ],
    );

    const [submissionRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM learning_task_submissions WHERE task_id = ? AND enrollment_id = ? LIMIT 1",
      [taskId, enrollment.id],
    );
    const submissionId = Number(submissionRows[0]?.id ?? result.insertId);
    if (replacePreviousSubmission) {
      await connection.execute(
        `DELETE FROM learning_task_evidences
         WHERE submission_id = ? AND task_id = ? AND enrollment_id = ?`,
        [submissionId, taskId, enrollment.id],
      );
      await connection.execute("DELETE FROM learning_task_rubric_scores WHERE submission_id = ?", [submissionId]);
    }

    const [sortRows] = await connection.execute<Array<RowDataPacket & { max_sort: number | null }>>(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
       FROM learning_task_evidences
       WHERE submission_id = ? AND task_id = ? AND enrollment_id = ?`,
      [submissionId, taskId, enrollment.id],
    );
    let sortOrder = Number(sortRows[0]?.max_sort ?? 0) + 1;

    for (const extraUpload of submittedFileUploads.slice(1)) {
      await connection.execute(
        `INSERT INTO learning_task_evidences
           (submission_id, task_id, enrollment_id, evidence_type, evidence_url, evidence_text, file_name, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          submissionId,
          taskId,
          enrollment.id,
          extraUpload.mimeType?.startsWith("image/") ? "image" : "file",
          extraUpload.fileUrl,
          learningSubmissionFileEvidenceMarker,
          extraUpload.fileName,
          sortOrder++,
        ],
      );
    }

    for (const evidenceUpload of evidenceFileUploads) {
      await connection.execute(
        `INSERT INTO learning_task_evidences
           (submission_id, task_id, enrollment_id, evidence_type, evidence_url, evidence_text, file_name, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          submissionId,
          taskId,
          enrollment.id,
          evidenceUpload.mimeType?.startsWith("image/") ? "image" : "file",
          evidenceUpload.fileUrl,
          evidenceText || null,
          evidenceUpload.fileName,
          sortOrder++,
        ],
      );
    }

    if (evidenceText || evidenceUrl) {
      await connection.execute(
        `INSERT INTO learning_task_evidences
           (submission_id, task_id, enrollment_id, evidence_type, evidence_url, evidence_text, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [submissionId, taskId, enrollment.id, evidenceUrl ? "link" : "text", evidenceUrl || null, evidenceText || null, sortOrder++],
      );
    }

    await refreshEnrollmentProgress(connection, enrollment.id, enrollment.courseId);
    const taskSummary = await getTaskSubmissionSummary(connection, enrollment.id, enrollment.courseId);
    const allTasksSubmitted =
      taskSummary.totalTasks > 0 &&
      taskSummary.submittedTasks >= taskSummary.totalTasks;
    await connection.commit();
    await deleteReplacedSubmissionFiles(replacedFileUrls);

    await logAudit({
      userId: user.id,
      action: "learning_task.submitted",
      entityType: "learning_task_submission",
      entityId: submissionId,
      detail: {
        taskId,
        enrollmentId: enrollment.id,
        submissionFileCount: submittedFileUploads.length,
        evidenceFileCount: evidenceFileUploads.length,
        hasLink: Boolean(submittedLink),
      },
    });
    revalidatePath(`/my-learning/${slug}`);
    revalidatePath(`/admin/learning/${slug}/preview`);
    revalidatePath("/my-learning");
    revalidatePath("/admin/learning");

    if (allTasksSubmitted) {
      return {
        ok: true,
        message: "ส่งใบงาน/แบบฝึกครบแล้ว ระบบพร้อมพาคุณไปทำแบบทดสอบหลังเรียน",
        event: "all_tasks_submitted",
        nextTab: "tests",
        ...taskSummary,
      };
    }

    return {
      ok: true,
      message: "ส่งงานแล้ว รอครูตรวจและให้ข้อเสนอแนะ",
      event: "task_submitted",
      nextTab: "tasks",
      ...taskSummary,
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "ส่งงานไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function submitAssessmentAttemptAction(formData: FormData): Promise<ActionResult> {
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const slug = text(formData, "slug");
    const assessmentId = numberValue(formData, "assessmentId");
    const learnerEmail = learnerEmailForAction(formData, user);
    const enrollment = await getEnrollment(connection, slug, learnerEmail);

    const [assessmentRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          course_id: number;
          shared_question_source_id: number | null;
          title: string;
          type: string;
          passing_score: string | number;
          max_attempts: number | null;
          question_limit: number | null;
          counts_toward_completion: 0 | 1 | boolean;
        }
      >
    >(
      `SELECT a.id, a.course_id, a.shared_question_source_id, a.title, a.type,
              a.passing_score, a.max_attempts, a.question_limit, a.counts_toward_completion
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = ? AND c.slug = ? AND a.status = 'published'
       LIMIT 1`,
      [assessmentId, slug],
    );
    const assessment = assessmentRows[0];
    if (!assessment) throw new Error("ไม่พบแบบทดสอบที่ต้องการส่งคำตอบ");

    const [attemptRows] = await connection.execute<Array<RowDataPacket & { attempt_count: number }>>(
      "SELECT COUNT(*) AS attempt_count FROM assessment_attempts WHERE assessment_id = ? AND enrollment_id = ?",
      [assessmentId, enrollment.id],
    );
    const attemptCount = Number(attemptRows[0]?.attempt_count ?? 0);
    if (assessment.max_attempts && attemptCount >= assessment.max_attempts) {
      throw new Error("ทำแบบทดสอบครบจำนวนครั้งที่กำหนดแล้ว");
    }

    const sourceId = Number(assessment.shared_question_source_id ?? assessment.id);
    const [questionRows] = await connection.execute<
      Array<RowDataPacket & { id: number; question_type: string; score: string | number }>
    >(
      `SELECT id, question_type, score
       FROM questions
       WHERE assessment_id = ? AND status = 'active'
       ORDER BY sort_order, id`,
      [sourceId],
    );
    if (!questionRows.length) throw new Error("ยังไม่มีคำถามในชุดแบบทดสอบนี้");

    const visibleQuestionIds = formData
      .getAll("visibleQuestionId")
      .map((value) => Number(value))
      .filter(Number.isFinite);
    const visibleQuestionIdSet = new Set(visibleQuestionIds);
    const limit = assessment.question_limit === null ? 0 : Number(assessment.question_limit);
    const scoredQuestionRows = visibleQuestionIds.length
      ? questionRows.filter((row) => visibleQuestionIdSet.has(Number(row.id)))
      : limit > 0
        ? questionRows.slice(0, limit)
        : questionRows;

    if (!scoredQuestionRows.length) {
      throw new Error("ไม่พบข้อสอบที่ต้องตรวจคะแนน กรุณาเปิดแบบทดสอบใหม่อีกครั้ง");
    }

    const questionIds = scoredQuestionRows.map((row) => Number(row.id));
    const [optionRows] = await connection.execute<
      Array<RowDataPacket & { id: number; question_id: number; is_correct: 0 | 1 | boolean }>
    >(
      `SELECT id, question_id, is_correct
       FROM question_options
       WHERE question_id IN (${questionIds.map(() => "?").join(",")})`,
      questionIds,
    );
    const correctOptionsByQuestion = new Map<number, Set<number>>();
    for (const option of optionRows) {
      if (!option.is_correct) continue;
      const questionId = Number(option.question_id);
      const set = correctOptionsByQuestion.get(questionId) ?? new Set<number>();
      set.add(Number(option.id));
      correctOptionsByQuestion.set(questionId, set);
    }

    let score = 0;
    let maxScore = 0;
    const answers: Array<{ questionId: number; selectedOptionId: number | null; answerText: string | null; score: number }> = [];

    for (const question of scoredQuestionRows) {
      const questionId = Number(question.id);
      const questionScore = Number(question.score ?? 1);
      maxScore += questionScore;
      const selected = formData.getAll(`question_${questionId}`).map((value) => Number(value)).filter(Number.isFinite);
      const answerText = text(formData, `answer_text_${questionId}`) || null;
      const correctSet = correctOptionsByQuestion.get(questionId) ?? new Set<number>();
      const selectedSet = new Set(selected);
      const isCorrect =
        selectedSet.size > 0 &&
        selectedSet.size === correctSet.size &&
        [...selectedSet].every((optionId) => correctSet.has(optionId));
      const earned = isCorrect ? questionScore : 0;
      score += earned;
      answers.push({
        questionId,
        selectedOptionId: selected[0] ?? null,
        answerText,
        score: earned,
      });
    }

    const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const countsToward = Boolean(assessment.counts_toward_completion);
    const passed = percent >= Number(assessment.passing_score ?? 0);
    const status = countsToward ? (passed ? "passed" : "failed") : "submitted";

    const [attemptResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO assessment_attempts (
         assessment_id, enrollment_id, attempt_no, score, max_score,
         status, submitted_at, graded_at
       )
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [assessmentId, enrollment.id, attemptCount + 1, score, maxScore, status],
    );

    for (const answer of answers) {
      await connection.execute(
        `INSERT INTO assessment_answers
           (attempt_id, question_id, answer_text, selected_option_id, score)
         VALUES (?, ?, ?, ?, ?)`,
        [attemptResult.insertId, answer.questionId, answer.answerText, answer.selectedOptionId, answer.score],
      );
    }

    await refreshEnrollmentProgress(connection, enrollment.id, enrollment.courseId);
    await connection.commit();
    revalidatePath(`/my-learning/${slug}`);
    revalidatePath(`/admin/learning/${slug}/preview`);
    revalidatePath("/my-learning");
    revalidatePath("/admin/learning");

    const message = countsToward
      ? `ส่งคำตอบแล้ว ได้ ${Math.round(percent)}% (${passed ? "ผ่าน" : "ยังไม่ผ่าน"})`
      : `บันทึกคะแนนก่อนเรียนแล้ว ได้ ${Math.round(percent)}% ใช้สำหรับเทียบความก้าวหน้า`;
    return {
      ok: true,
      message,
      event:
        assessment.type === "pre_test"
          ? "pre_test_completed"
          : assessment.type === "post_test"
            ? "post_test_completed"
            : "assessment_completed",
      nextTab:
        assessment.type === "pre_test"
          ? "lessons"
          : assessment.type === "post_test"
            ? "result"
            : "tests",
      scorePercent: Math.round(percent),
      passed,
      assessmentType: assessment.type,
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "ส่งคำตอบไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
