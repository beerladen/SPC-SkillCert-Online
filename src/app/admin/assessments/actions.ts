"use server";

import { revalidatePath } from "next/cache";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertCanAccessCourse } from "@/lib/course-access";
import { getPool } from "@/lib/db";

interface ActionResult {
  ok: boolean;
  message: string;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function requiredNumber(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value)) {
    throw new Error(`ข้อมูล ${key} ไม่ถูกต้อง`);
  }
  return value;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`ข้อมูล ${key} ไม่ถูกต้อง`);
  }
  return value;
}

function optionalBatchNumber(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("คะแนนที่กรอกไม่ถูกต้อง");
  }

  return value;
}

async function refreshEnrollmentProgress(
  connection: PoolConnection,
  enrollmentId: number,
  courseId: number,
) {
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
  const lessonPercent = lessonTotal > 0 ? (Number(lessonRows[0]?.completed ?? 0) / lessonTotal) * 100 : 100;
  const taskTotal = Number(taskRows[0]?.total ?? 0);
  const taskPercent = taskTotal > 0 ? (Number(taskRows[0]?.passed ?? 0) / taskTotal) * 100 : 100;
  const postPercent = Number(postRows[0]?.score_percent ?? 0);
  const progress = Math.round((lessonPercent * 0.45 + taskPercent * 0.35 + postPercent * 0.2) * 10) / 10;

  await connection.execute(
    `UPDATE enrollments
     SET progress_percent = ?,
         status = CASE WHEN ? >= 100 THEN 'completed' ELSE status END,
         completed_at = CASE WHEN ? >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END
     WHERE id = ?`,
    [Math.min(100, progress), progress, progress, enrollmentId],
  );
}

export async function gradeLearningTaskSubmissionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const submissionId = requiredNumber(formData, "submissionId");
    const feedback = text(formData, "feedback") || null;
    const decision = text(formData, "decision") || "graded";

    const [rows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          enrollment_id: number;
          course_id: number;
          course_slug: string;
          passing_score: string | number;
          max_score: string | number;
        }
      >
    >(
      `SELECT sub.id, sub.enrollment_id, t.course_id, c.slug AS course_slug,
              t.passing_score, t.max_score
       FROM learning_task_submissions sub
       JOIN learning_tasks t ON t.id = sub.task_id
       JOIN courses c ON c.id = t.course_id
       WHERE sub.id = ?
       LIMIT 1`,
      [submissionId],
    );

    const submission = rows[0];
    if (!submission) {
      throw new Error("ไม่พบงานส่งที่ต้องการตรวจ");
    }

    await assertCanAccessCourse(
      connection,
      Number(submission.course_id),
      user,
      "grade",
      "คุณไม่มีสิทธิ์ตรวจงานในหลักสูตรนี้",
    );

    const maxScore = Number(submission.max_score ?? 0);
    const [rubricRows] = await connection.execute<
      Array<RowDataPacket & { id: number; max_score: string | number }>
    >(
      `SELECT id, max_score
       FROM learning_task_rubrics
       WHERE task_id = (
         SELECT task_id FROM learning_task_submissions WHERE id = ? LIMIT 1
       )
       ORDER BY sort_order, id`,
      [submissionId],
    );

    let score = optionalNumber(formData, "score");
    if (rubricRows.length) {
      let rubricTotal = 0;
      for (const rubric of rubricRows) {
        const rubricId = Number(rubric.id);
        const rubricMaxScore = Number(rubric.max_score ?? 0);
        const rubricScore = optionalNumber(formData, `rubricScore_${rubricId}`);
        if (rubricScore === null) {
          throw new Error("กรุณาให้คะแนน rubric ให้ครบทุกข้อ");
        }
        if (rubricScore < 0 || rubricScore > rubricMaxScore) {
          throw new Error(`คะแนน rubric ต้องอยู่ระหว่าง 0 ถึง ${rubricMaxScore}`);
        }
        rubricTotal += rubricScore;
      }
      score = Math.round(rubricTotal * 100) / 100;
    } else if (score === null) {
      throw new Error("กรุณาระบุคะแนน");
    }

    if (score < 0 || score > maxScore) {
      throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxScore}`);
    }

    const passingScore = Number(submission.passing_score ?? 0);
    const status =
      decision === "needs_revision"
        ? "needs_revision"
        : score >= passingScore
          ? "passed"
          : "not_passed";

    await connection.execute(
      `UPDATE learning_task_submissions
       SET score = ?,
           feedback = ?,
           status = ?,
           graded_at = NOW(),
           graded_by = ?
       WHERE id = ?`,
      [score, feedback, status, user.id, submissionId],
    );

    for (const rubric of rubricRows) {
      const rubricId = Number(rubric.id);
      const rubricScore = optionalNumber(formData, `rubricScore_${rubricId}`);
      const rubricFeedback = text(formData, `rubricFeedback_${rubricId}`) || null;
      await connection.execute(
        `INSERT INTO learning_task_rubric_scores (submission_id, rubric_id, score, feedback)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), feedback = VALUES(feedback)`,
        [submissionId, rubricId, rubricScore, rubricFeedback],
      );
    }

    await refreshEnrollmentProgress(
      connection,
      Number(submission.enrollment_id),
      Number(submission.course_id),
    );

    await connection.commit();
    await logAudit({
      userId: user.id,
      action: "learning_task.graded",
      entityType: "learning_task_submission",
      entityId: submissionId,
      detail: { score, status, decision, rubricCount: rubricRows.length },
    });
    revalidatePath("/admin/assessments");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/learning");
    revalidatePath(`/my-learning/${submission.course_slug}`);
    revalidatePath("/my-learning");

    return {
      ok: true,
      message: status === "needs_revision" ? "ส่งกลับให้ผู้เรียนแก้ไขแล้ว" : "บันทึกผลตรวจงานแล้ว",
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกผลตรวจงานไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}

export async function gradeLearningTaskSubmissionsBatchAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const submissionIds = formData
    .getAll("submissionId")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (submissionIds.length === 0) {
    return { ok: false, message: "ไม่พบใบงานที่ต้องการตรวจ" };
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const placeholders = submissionIds.map(() => "?").join(",");
    const [rows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          enrollment_id: number;
          course_id: number;
          course_slug: string;
          passing_score: string | number;
          max_score: string | number;
          status: string;
        }
      >
    >(
      `SELECT sub.id, sub.enrollment_id, t.course_id, c.slug AS course_slug,
              t.passing_score, t.max_score, sub.status
       FROM learning_task_submissions sub
       JOIN learning_tasks t ON t.id = sub.task_id
       JOIN courses c ON c.id = t.course_id
       WHERE sub.id IN (${placeholders})`,
      submissionIds,
    );

    if (rows.length !== submissionIds.length) {
      throw new Error("พบใบงานบางรายการไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่");
    }

    const rowsById = new Map(rows.map((row) => [Number(row.id), row]));
    const courseIds = Array.from(new Set(rows.map((row) => Number(row.course_id))));
    for (const courseId of courseIds) {
      await assertCanAccessCourse(
        connection,
        courseId,
        user,
        "grade",
        "คุณไม่มีสิทธิ์ตรวจงานในหลักสูตรนี้",
      );
    }

    const refreshKeys = new Set<string>();
    const slugs = new Set<string>();
    const auditRows: Array<{ id: number; score: number; status: string; decision: string }> = [];

    for (const submissionId of submissionIds) {
      const submission = rowsById.get(submissionId);
      if (!submission) continue;

      if (!["submitted", "pending_review"].includes(submission.status)) {
        throw new Error("มีใบงานบางรายการไม่ได้อยู่ในสถานะรอตรวจ กรุณารีเฟรชหน้าแล้วตรวจสอบอีกครั้ง");
      }

      const maxScore = Number(submission.max_score ?? 0);
      const passingScore = Number(submission.passing_score ?? 0);
      const score = optionalBatchNumber(formData, `score_${submissionId}`);
      if (score === null) {
        continue;
      }
      const feedback = text(formData, `feedback_${submissionId}`) || null;
      const decision = text(formData, `decision_${submissionId}`) || "graded";

      if (score < 0 || score > maxScore) {
        throw new Error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxScore}`);
      }

      const status =
        decision === "needs_revision"
          ? "needs_revision"
          : score >= passingScore
            ? "passed"
            : "not_passed";

      await connection.execute(
        `UPDATE learning_task_submissions
         SET score = ?,
             feedback = ?,
             status = ?,
             graded_at = NOW(),
             graded_by = ?
         WHERE id = ?
           AND status IN ('submitted', 'pending_review')`,
        [score, feedback, status, user.id, submissionId],
      );

      refreshKeys.add(`${Number(submission.enrollment_id)}:${Number(submission.course_id)}`);
      slugs.add(submission.course_slug);
      auditRows.push({ id: submissionId, score, status, decision });
    }

    if (auditRows.length === 0) {
      throw new Error("กรุณากรอกคะแนนอย่างน้อย 1 ใบงานก่อนบันทึก");
    }

    for (const key of refreshKeys) {
      const [enrollmentId, courseId] = key.split(":").map(Number);
      await refreshEnrollmentProgress(connection, enrollmentId, courseId);
    }

    await connection.commit();

    await Promise.all(
      auditRows.map((row) =>
        logAudit({
          userId: user.id,
          action: "learning_task.batch_graded",
          entityType: "learning_task_submission",
          entityId: row.id,
          detail: { score: row.score, status: row.status, decision: row.decision },
        }),
      ),
    );

    revalidatePath("/admin/assessments");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/learning");
    revalidatePath("/my-learning");
    for (const slug of slugs) {
      revalidatePath(`/my-learning/${slug}`);
    }

    return {
      ok: true,
      message: `บันทึกผลตรวจ ${auditRows.length} รายการเรียบร้อยแล้ว`,
    };
  } catch (error) {
    await connection.rollback();
    return {
      ok: false,
      message: error instanceof Error ? error.message : "บันทึกผลตรวจรายวิชาไม่สำเร็จ",
    };
  } finally {
    connection.release();
  }
}
