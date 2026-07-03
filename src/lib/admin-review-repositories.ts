import type { RowDataPacket } from "mysql2/promise";
import type { CurrentUser } from "@/lib/auth";
import { scopedCourseFilter } from "@/lib/course-access";
import { queryRows } from "@/lib/db";

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface AdminEnrollmentProgressRow {
  id: number;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  courseSlug: string;
  enrollmentStatus: string;
  registrationStatus: string | null;
  paymentStatus: string | null;
  progressPercent: number;
  enrolledAt: string | null;
  completedAt: string | null;
  completedLessons: number;
  totalLessons: number;
  preTestScore: number | null;
  postTestScore: number | null;
  submittedTasks: number;
  totalTasks: number;
  pendingTasks: number;
  certificateStatus: string | null;
}

interface EnrollmentProgressDbRow extends RowDataPacket {
  id: number;
  learner_name: string;
  learner_email: string;
  course_title: string;
  course_slug: string;
  enrollment_status: string;
  registration_status: string | null;
  payment_status: string | null;
  progress_percent: string | number;
  enrolled_at: string | null;
  completed_at: string | null;
  completed_lessons: number;
  total_lessons: number;
  pre_test_score: string | number | null;
  post_test_score: string | number | null;
  submitted_tasks: number;
  total_tasks: number;
  pending_tasks: number;
  certificate_status: string | null;
}

export async function getAdminEnrollmentProgressRows(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<AdminEnrollmentProgressRow[]> {
  const courseScope = scopedCourseFilter(user, "c", "view");
  const rows = await queryRows<EnrollmentProgressDbRow>(
    `
    SELECT
      e.id,
      u.name AS learner_name,
      u.email AS learner_email,
      c.title AS course_title,
      c.slug AS course_slug,
      e.status AS enrollment_status,
      r.status AS registration_status,
      MAX(rp.status) AS payment_status,
      e.progress_percent,
      e.enrolled_at,
      e.completed_at,
      COUNT(DISTINCT CASE WHEN l.status = 'published' THEN l.id END) AS total_lessons,
      COUNT(DISTINCT CASE WHEN lp.status = 'completed' AND l.status = 'published' THEN l.id END) AS completed_lessons,
      MAX(CASE WHEN a.type = 'pre_test' AND aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 END) AS pre_test_score,
      MAX(CASE WHEN a.type = 'post_test' AND aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 END) AS post_test_score,
      COUNT(DISTINCT CASE WHEN t.status = 'published' THEN t.id END) AS total_tasks,
      COUNT(DISTINCT lts.id) AS submitted_tasks,
      COUNT(DISTINCT CASE WHEN lts.status IN ('submitted', 'pending_review', 'needs_revision') THEN lts.id END) AS pending_tasks,
      MAX(cert.status) AS certificate_status
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN registration_items ri ON ri.id = e.registration_item_id
    LEFT JOIN registrations r ON r.id = ri.registration_id AND r.deleted_at IS NULL
    LEFT JOIN registration_payments rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
    LEFT JOIN course_sections s ON s.course_id = c.id AND s.deleted_at IS NULL AND s.status <> 'archived'
    LEFT JOIN lessons l ON l.section_id = s.id AND l.deleted_at IS NULL AND l.status <> 'archived'
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
    LEFT JOIN assessments a ON a.course_id = c.id AND a.deleted_at IS NULL AND a.status <> 'archived'
    LEFT JOIN assessment_attempts aa ON aa.assessment_id = a.id AND aa.enrollment_id = e.id
    LEFT JOIN learning_tasks t ON t.course_id = c.id AND t.deleted_at IS NULL AND t.status <> 'archived'
    LEFT JOIN learning_task_submissions lts ON lts.task_id = t.id AND lts.enrollment_id = e.id
    LEFT JOIN certificates cert ON cert.enrollment_id = e.id
    WHERE c.deleted_at IS NULL
      AND c.status <> 'archived'
      ${courseScope.sql}
    GROUP BY e.id, u.name, u.email, c.title, c.slug, e.status, r.status,
             e.progress_percent, e.enrolled_at, e.completed_at
    ORDER BY e.enrolled_at DESC, e.id DESC
  `,
    courseScope.values,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    enrollmentStatus: row.enrollment_status,
    registrationStatus: row.registration_status,
    paymentStatus: row.payment_status,
    progressPercent: toNumber(row.progress_percent),
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    completedLessons: Number(row.completed_lessons ?? 0),
    totalLessons: Number(row.total_lessons ?? 0),
    preTestScore: row.pre_test_score === null ? null : toNumber(row.pre_test_score),
    postTestScore: row.post_test_score === null ? null : toNumber(row.post_test_score),
    submittedTasks: Number(row.submitted_tasks ?? 0),
    totalTasks: Number(row.total_tasks ?? 0),
    pendingTasks: Number(row.pending_tasks ?? 0),
    certificateStatus: row.certificate_status,
  }));
}

export interface AdminSubmissionEvidence {
  id: number;
  submissionId: number;
  evidenceType: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  fileName: string | null;
}

export interface AdminReviewSubmissionRow {
  id: number;
  learnerId: number;
  courseId: number;
  taskId: number;
  submissionNo: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  courseSlug: string;
  taskTitle: string;
  taskType: "worksheet" | "practice";
  maxScore: number;
  passingScore: number;
  answerText: string | null;
  submittedFileUrl: string | null;
  submittedFileName: string | null;
  submittedLinkUrl: string | null;
  note: string | null;
  status: string;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  gradedByName: string | null;
  evidences: AdminSubmissionEvidence[];
  rubrics: AdminSubmissionRubricScore[];
}

interface ReviewSubmissionDbRow extends RowDataPacket {
  id: number;
  learner_id: number;
  course_id: number;
  task_id: number;
  submission_no: string;
  learner_name: string;
  learner_email: string;
  course_title: string;
  course_slug: string;
  task_title: string;
  task_type: "worksheet" | "practice";
  max_score: string | number;
  passing_score: string | number;
  answer_text: string | null;
  submitted_file_url: string | null;
  submitted_file_name: string | null;
  submitted_link_url: string | null;
  note: string | null;
  status: string;
  score: string | number | null;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  graded_by_name: string | null;
}

export interface AdminSubmissionRubricScore {
  id: number;
  taskId: number;
  title: string;
  description: string | null;
  maxScore: number;
  score: number | null;
  feedback: string | null;
}

interface ReviewRubricDbRow extends RowDataPacket {
  id: number;
  task_id: number;
  title: string;
  description: string | null;
  max_score: string | number;
}

interface ReviewRubricScoreDbRow extends RowDataPacket {
  submission_id: number;
  rubric_id: number;
  score: string | number | null;
  feedback: string | null;
}

interface ReviewEvidenceDbRow extends RowDataPacket {
  id: number;
  submission_id: number;
  evidence_type: string;
  evidence_url: string | null;
  evidence_text: string | null;
  file_name: string | null;
}

export async function getAdminReviewSubmissions(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<AdminReviewSubmissionRow[]> {
  const courseScope = scopedCourseFilter(user, "c", "grade");
  const [submissionRows, evidenceRows, rubricRows, rubricScoreRows] = await Promise.all([
    queryRows<ReviewSubmissionDbRow>(
      `
      SELECT
        sub.id,
        u.id AS learner_id,
        c.id AS course_id,
        t.id AS task_id,
        sub.submission_no,
        u.name AS learner_name,
        u.email AS learner_email,
        c.title AS course_title,
        c.slug AS course_slug,
        t.title AS task_title,
        t.task_type,
        t.max_score,
        t.passing_score,
        sub.answer_text,
        sub.submitted_file_url,
        sub.submitted_file_name,
        sub.submitted_link_url,
        sub.note,
        sub.status,
        sub.score,
        sub.feedback,
        sub.submitted_at,
        sub.graded_at,
        grader.name AS graded_by_name
      FROM learning_task_submissions sub
      JOIN learning_tasks t ON t.id = sub.task_id
      JOIN enrollments e ON e.id = sub.enrollment_id
      JOIN users u ON u.id = e.user_id
      JOIN courses c ON c.id = t.course_id
      LEFT JOIN users grader ON grader.id = sub.graded_by
      LEFT JOIN course_sections s ON s.id = t.section_id
      LEFT JOIN lessons l ON l.id = t.lesson_id
      WHERE c.deleted_at IS NULL
        AND c.status <> 'archived'
        AND t.deleted_at IS NULL
        AND t.status <> 'archived'
        AND (t.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
        AND (t.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
        ${courseScope.sql}
      ORDER BY
        CASE sub.status
          WHEN 'pending_review' THEN 1
          WHEN 'submitted' THEN 2
          WHEN 'needs_revision' THEN 3
          ELSE 4
        END,
        sub.submitted_at DESC,
        sub.id DESC
    `,
      courseScope.values,
    ),
    queryRows<ReviewEvidenceDbRow>(`
      SELECT id, submission_id, evidence_type, evidence_url, evidence_text, file_name
      FROM learning_task_evidences
      WHERE submission_id IS NOT NULL
      ORDER BY submission_id, sort_order, id
    `),
    queryRows<ReviewRubricDbRow>(`
      SELECT rb.id, rb.task_id, rb.title, rb.description, rb.max_score
      FROM learning_task_rubrics rb
      ORDER BY rb.task_id, rb.sort_order, rb.id
    `),
    queryRows<ReviewRubricScoreDbRow>(`
      SELECT submission_id, rubric_id, score, feedback
      FROM learning_task_rubric_scores
    `),
  ]);

  const evidencesBySubmissionId = new Map<number, AdminSubmissionEvidence[]>();
  for (const row of evidenceRows) {
    const submissionId = Number(row.submission_id);
    const evidences = evidencesBySubmissionId.get(submissionId) ?? [];
    evidences.push({
      id: Number(row.id),
      submissionId,
      evidenceType: row.evidence_type,
      evidenceUrl: row.evidence_url,
      evidenceText: row.evidence_text,
      fileName: row.file_name,
    });
    evidencesBySubmissionId.set(submissionId, evidences);
  }

  const rubricsByTaskId = new Map<number, ReviewRubricDbRow[]>();
  for (const row of rubricRows) {
    const taskId = Number(row.task_id);
    const rubrics = rubricsByTaskId.get(taskId) ?? [];
    rubrics.push(row);
    rubricsByTaskId.set(taskId, rubrics);
  }

  const rubricScoreBySubmissionRubric = new Map<string, ReviewRubricScoreDbRow>();
  for (const row of rubricScoreRows) {
    rubricScoreBySubmissionRubric.set(`${Number(row.submission_id)}:${Number(row.rubric_id)}`, row);
  }

  return submissionRows.map((row) => ({
    id: Number(row.id),
    learnerId: Number(row.learner_id),
    courseId: Number(row.course_id),
    taskId: Number(row.task_id),
    submissionNo: row.submission_no,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    taskTitle: row.task_title,
    taskType: row.task_type,
    maxScore: toNumber(row.max_score),
    passingScore: toNumber(row.passing_score),
    answerText: row.answer_text,
    submittedFileUrl: row.submitted_file_url,
    submittedFileName: row.submitted_file_name,
    submittedLinkUrl: row.submitted_link_url,
    note: row.note,
    status: row.status,
    score: row.score === null ? null : toNumber(row.score),
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    gradedByName: row.graded_by_name,
    evidences: evidencesBySubmissionId.get(Number(row.id)) ?? [],
    rubrics: (rubricsByTaskId.get(Number(row.task_id)) ?? [])
      .map((rubric) => {
        const rubricScore = rubricScoreBySubmissionRubric.get(`${Number(row.id)}:${Number(rubric.id)}`);
        return {
        id: Number(rubric.id),
        taskId: Number(rubric.task_id),
        title: rubric.title,
        description: rubric.description,
        maxScore: toNumber(rubric.max_score),
        score: rubricScore?.score === null || rubricScore?.score === undefined ? null : toNumber(rubricScore.score),
        feedback: rubricScore?.feedback ?? null,
      };
      }),
  }));
}
