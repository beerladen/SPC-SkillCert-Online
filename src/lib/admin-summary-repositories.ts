import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CurrentUser } from "@/lib/auth";
import {
  getAdminReviewSubmissions,
  type AdminReviewSubmissionRow,
} from "@/lib/admin-review-repositories";
import { scopedCourseFilter } from "@/lib/course-access";
import { executeQuery, queryRows } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PublicHomeHeroSettings, PublicSiteSettings } from "@/lib/public-repositories";
import { getPublicHomeHeroSettings, getPublicSiteSettings } from "@/lib/public-repositories";

export interface AdminDashboardData {
  stats: {
    openCourses: number;
    registrations: number;
    revenue: number;
    certificates: number;
    pendingPayments: number;
    pendingTasks: number;
    nearCompletion: number;
  };
  recentRegistrations: Array<{
    id: number;
    registrationNo: string;
    learnerName: string;
    courseTitles: string;
    totalAmount: number;
    status: string;
    submittedAt: string;
  }>;
}

export interface AdminReportData {
  totals: AdminDashboardData["stats"] & { learners: number };
  courseRows: Array<{
    courseTitle: string;
    enrollments: number;
    completed: number;
    revenue: number;
    certificates: number;
  }>;
  paymentRows: Array<{
    status: string;
    payments: number;
    registrations: number;
    amount: number;
  }>;
  exports: Array<{
    id: number;
    reportType: string;
    status: string;
    createdAt: string;
    fileUrl: string | null;
  }>;
  courseOptions: AdminReportCourseOption[];
  courseLearnerRows: AdminReportCourseLearnerRow[];
  learnerRows: AdminReportLearnerRow[];
  reviewRows: AdminReviewSubmissionRow[];
}

export interface AdminReportCourseOption {
  id: number;
  title: string;
  slug: string;
  status: string;
  durationMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
  instructorName: string | null;
  instructorPosition: string | null;
  instructorSignatureUrl: string | null;
  certificateDocumentType: "certificate" | "honor_certificate";
}

export interface AdminReportCourseLearnerRow {
  enrollmentId: number;
  userId: number;
  courseId: number;
  learnerName: string;
  learnerEmail: string;
  learnerPhone: string | null;
  courseTitle: string;
  courseSlug: string;
  registrationNo: string | null;
  registeredAt: string | null;
  enrolledAt: string | null;
  completedAt: string | null;
  registrationStatus: string | null;
  paymentStatus: string | null;
  enrollmentStatus: string;
  courseResultStatus: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  preTestScore: number | null;
  postTestScore: number | null;
  submittedTasks: number;
  totalTasks: number;
  passedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  certificateStatus: string | null;
  certificateNo: string | null;
  certificateUrl: string | null;
  certificateDocumentType: "certificate" | "honor_certificate";
}

export interface AdminReportLearnerRow {
  userId: number;
  learnerName: string;
  learnerEmail: string;
  learnerPhone: string | null;
  courseCount: number;
  activeCourses: number;
  completedCourses: number;
  pendingTasks: number;
  certificates: number;
  averageProgress: number;
}

interface ReportCourseOptionDbRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  status: string;
  duration_minutes: number;
  starts_at: string | null;
  ends_at: string | null;
  instructor_name: string | null;
  instructor_position: string | null;
  instructor_signature_url: string | null;
  certificate_document_type: "certificate" | "honor_certificate" | null;
}

interface ReportCourseLearnerDbRow extends RowDataPacket {
  enrollment_id: number;
  user_id: number;
  course_id: number;
  learner_name: string;
  learner_email: string;
  learner_phone: string | null;
  course_title: string;
  course_slug: string;
  registration_no: string | null;
  registered_at: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  registration_status: string | null;
  payment_status: string | null;
  enrollment_status: string;
  progress_percent: string | number;
  completed_lessons: number;
  total_lessons: number;
  pre_test_score: string | number | null;
  post_test_score: string | number | null;
  submitted_tasks: number;
  total_tasks: number;
  passed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
  certificate_status: string | null;
  certificate_no: string | null;
  certificate_pdf_url: string | null;
  certificate_document_type: "certificate" | "honor_certificate" | null;
}

function toReportNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toScore(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return toReportNumber(value);
}

function courseResultStatus(row: {
  enrollmentStatus: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  totalTasks: number;
  submittedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  passedTasks: number;
  certificateStatus: string | null;
}) {
  if (row.certificateStatus === "issued") return "certificate_issued";
  if (row.enrollmentStatus === "cancelled") return "cancelled";
  if (row.enrollmentStatus === "expired") return "expired";
  if (row.failedTasks > 0) return "not_passed";
  if (row.pendingTasks > 0) return "pending_review";
  if (row.totalTasks > 0 && row.submittedTasks < row.totalTasks) return "waiting_submission";
  if (row.enrollmentStatus === "completed") return "completed";
  if (row.progressPercent >= 100 || (row.totalLessons > 0 && row.completedLessons >= row.totalLessons)) {
    return row.totalTasks > 0 && row.passedTasks < row.totalTasks ? "waiting_submission" : "completed";
  }
  return "active";
}

function normalizeCourseLearnerRow(row: ReportCourseLearnerDbRow): AdminReportCourseLearnerRow {
  const progressPercent = toReportNumber(row.progress_percent);
  const completedLessons = Number(row.completed_lessons ?? 0);
  const totalLessons = Number(row.total_lessons ?? 0);
  const submittedTasks = Number(row.submitted_tasks ?? 0);
  const totalTasks = Number(row.total_tasks ?? 0);
  const passedTasks = Number(row.passed_tasks ?? 0);
  const failedTasks = Number(row.failed_tasks ?? 0);
  const pendingTasks = Number(row.pending_tasks ?? 0);
  const enrollmentStatus = row.enrollment_status;
  const certificateStatus = row.certificate_status;

  return {
    enrollmentId: Number(row.enrollment_id),
    userId: Number(row.user_id),
    courseId: Number(row.course_id),
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    learnerPhone: row.learner_phone,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    registrationNo: row.registration_no,
    registeredAt: formatDateTime(row.registered_at),
    enrolledAt: formatDateTime(row.enrolled_at),
    completedAt: row.completed_at ? formatDateTime(row.completed_at) : null,
    registrationStatus: row.registration_status,
    paymentStatus: row.payment_status,
    enrollmentStatus,
    progressPercent,
    completedLessons,
    totalLessons,
    preTestScore: toScore(row.pre_test_score),
    postTestScore: toScore(row.post_test_score),
    submittedTasks,
    totalTasks,
    passedTasks,
    failedTasks,
    pendingTasks,
    certificateStatus,
    certificateNo: row.certificate_no,
    certificateUrl: row.certificate_pdf_url || (row.certificate_no ? `/certificates/${row.certificate_no}` : null),
    certificateDocumentType: row.certificate_document_type ?? "honor_certificate",
    courseResultStatus: courseResultStatus({
      enrollmentStatus,
      progressPercent,
      completedLessons,
      totalLessons,
      totalTasks,
      submittedTasks,
      pendingTasks,
      failedTasks,
      passedTasks,
      certificateStatus,
    }),
  };
}

function buildLearnerRows(rows: AdminReportCourseLearnerRow[]): AdminReportLearnerRow[] {
  const grouped = new Map<number, AdminReportLearnerRow>();

  for (const row of rows) {
    const current =
      grouped.get(row.userId) ??
      ({
        userId: row.userId,
        learnerName: row.learnerName,
        learnerEmail: row.learnerEmail,
        learnerPhone: row.learnerPhone,
        courseCount: 0,
        activeCourses: 0,
        completedCourses: 0,
        pendingTasks: 0,
        certificates: 0,
        averageProgress: 0,
      } satisfies AdminReportLearnerRow);

    current.courseCount += 1;
    current.activeCourses += row.enrollmentStatus === "active" ? 1 : 0;
    current.completedCourses += row.enrollmentStatus === "completed" ? 1 : 0;
    current.pendingTasks += row.pendingTasks;
    current.certificates += row.certificateStatus === "issued" ? 1 : 0;
    current.averageProgress += row.progressPercent;
    grouped.set(row.userId, current);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      averageProgress: row.courseCount > 0 ? row.averageProgress / row.courseCount : 0,
    }))
    .sort((a, b) => a.learnerName.localeCompare(b.learnerName, "th"));
}

export async function getAdminDashboardData(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<AdminDashboardData> {
  const courseScope = scopedCourseFilter(user, "c", "view");
  const statValues = [
    ...courseScope.values,
    ...courseScope.values,
    ...courseScope.values,
    ...courseScope.values,
    ...courseScope.values,
    ...courseScope.values,
    ...courseScope.values,
  ];
  const [statRows, registrationRows] = await Promise.all([
    queryRows<RowDataPacket>(
      `SELECT
        (SELECT COUNT(*) FROM courses c WHERE c.status IN ('open', 'nearly_full') AND c.deleted_at IS NULL ${courseScope.sql}) AS open_courses,
        (
          SELECT COUNT(DISTINCT r.id)
          FROM registrations r
          JOIN registration_items ri ON ri.registration_id = r.id
          JOIN courses c ON c.id = ri.course_id
          WHERE r.deleted_at IS NULL ${courseScope.sql}
        ) AS registrations,
        (
          SELECT COALESCE(SUM(rp.amount), 0)
          FROM registration_payments rp
          JOIN registrations r ON r.id = rp.registration_id
          JOIN registration_items ri ON ri.registration_id = r.id
          JOIN courses c ON c.id = ri.course_id
          WHERE rp.status = 'approved'
            AND rp.deleted_at IS NULL
            AND r.deleted_at IS NULL
            ${courseScope.sql}
        ) AS revenue,
        (
          SELECT COUNT(DISTINCT cert.id)
          FROM certificates cert
          JOIN enrollments e ON e.id = cert.enrollment_id
          JOIN courses c ON c.id = e.course_id
          WHERE cert.status = 'issued'
            ${courseScope.sql}
        ) AS certificates,
        (
          SELECT COUNT(DISTINCT rp.id)
          FROM registration_payments rp
          JOIN registrations r ON r.id = rp.registration_id
          JOIN registration_items ri ON ri.registration_id = r.id
          JOIN courses c ON c.id = ri.course_id
          WHERE rp.status = 'pending_review'
            AND rp.deleted_at IS NULL
            AND r.deleted_at IS NULL
            ${courseScope.sql}
        ) AS pending_payments,
        (
          SELECT COUNT(*)
          FROM learning_task_submissions sub
          JOIN learning_tasks t ON t.id = sub.task_id
          JOIN courses c ON c.id = t.course_id
          WHERE sub.status IN ('submitted', 'pending_review')
            AND t.deleted_at IS NULL
            AND t.status <> 'archived'
            AND c.deleted_at IS NULL
            AND c.status <> 'archived'
            ${courseScope.sql}
        ) AS pending_tasks,
        (
          SELECT COUNT(*)
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE e.progress_percent >= 80
            AND e.status = 'active'
            AND c.deleted_at IS NULL
            AND c.status <> 'archived'
            ${courseScope.sql}
        ) AS near_completion`,
      statValues,
    ),
    queryRows<RowDataPacket>(
      `SELECT r.id, r.registration_no, r.total_amount, r.status, r.submitted_at,
              u.name AS learner_name,
              GROUP_CONCAT(c.title ORDER BY c.title SEPARATOR ', ') AS course_titles
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       JOIN registration_items ri ON ri.registration_id = r.id
       JOIN courses c ON c.id = ri.course_id
       WHERE r.deleted_at IS NULL
         ${courseScope.sql}
       GROUP BY r.id
       ORDER BY r.submitted_at DESC, r.id DESC
       LIMIT 8`,
      courseScope.values,
    ),
  ]);

  const stat = statRows[0] ?? {};
  return {
    stats: {
      openCourses: Number(stat.open_courses ?? 0),
      registrations: Number(stat.registrations ?? 0),
      revenue: Number(stat.revenue ?? 0),
      certificates: Number(stat.certificates ?? 0),
      pendingPayments: Number(stat.pending_payments ?? 0),
      pendingTasks: Number(stat.pending_tasks ?? 0),
      nearCompletion: Number(stat.near_completion ?? 0),
    },
    recentRegistrations: registrationRows.map((row) => ({
      id: Number(row.id),
      registrationNo: row.registration_no,
      learnerName: row.learner_name,
      courseTitles: row.course_titles ?? "-",
      totalAmount: Number(row.total_amount ?? 0),
      status: row.status,
      submittedAt: formatDateTime(row.submitted_at),
    })),
  };
}

export async function getAdminReportData(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<AdminReportData> {
  const courseScope = scopedCourseFilter(user, "c", "view");
  const exportScope =
    user?.role === "instructor"
      ? { sql: "WHERE user_id = ?", values: [user.id] }
      : { sql: "", values: [] };
  const [
    dashboard,
    learnerRows,
    courseRows,
    paymentRows,
    exportRows,
    courseOptionRows,
    courseLearnerDbRows,
    reviewRows,
  ] = await Promise.all([
    getAdminDashboardData(user),
    queryRows<RowDataPacket>(
      user?.role === "instructor"
        ? `SELECT COUNT(DISTINCT u.id) AS total
           FROM users u
           JOIN enrollments e ON e.user_id = u.id
           JOIN courses c ON c.id = e.course_id
           WHERE u.role = 'student'
             AND u.deleted_at IS NULL
             ${courseScope.sql}`
        : "SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND deleted_at IS NULL",
      courseScope.values,
    ),
    queryRows<RowDataPacket>(
      `SELECT c.title AS course_title,
              COUNT(DISTINCT e.id) AS enrollments,
              SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completed,
              COALESCE(SUM(CASE WHEN rp.status = 'approved' THEN rp.amount ELSE 0 END), 0) AS revenue,
              COUNT(DISTINCT cert.id) AS certificates
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN registration_items ri ON ri.id = e.registration_item_id
       LEFT JOIN registrations r ON r.id = ri.registration_id AND r.deleted_at IS NULL
       LEFT JOIN registration_payments rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
       LEFT JOIN certificates cert ON cert.enrollment_id = e.id AND cert.status = 'issued'
       WHERE c.deleted_at IS NULL
         AND c.status <> 'archived'
         ${courseScope.sql}
       GROUP BY c.id
       ORDER BY enrollments DESC, c.title`,
      courseScope.values,
    ),
    queryRows<RowDataPacket>(
      `SELECT rp.status,
              COUNT(DISTINCT rp.id) AS payments,
              COUNT(DISTINCT r.id) AS registrations,
              COALESCE(SUM(rp.amount), 0) AS amount
       FROM registration_payments rp
       JOIN registrations r ON r.id = rp.registration_id
       JOIN registration_items ri ON ri.registration_id = r.id
       JOIN courses c ON c.id = ri.course_id
       WHERE rp.deleted_at IS NULL
         AND r.deleted_at IS NULL
         ${courseScope.sql}
       GROUP BY rp.status
       ORDER BY FIELD(rp.status, 'pending_review', 'pending', 'approved', 'rejected', 'refunded'), rp.status`,
      courseScope.values,
    ),
    queryRows<RowDataPacket>(
      `SELECT id, report_type, status, file_url, created_at
       FROM report_exports
       ${exportScope.sql}
       ORDER BY created_at DESC
       LIMIT 20`,
      exportScope.values,
    ),
    queryRows<ReportCourseOptionDbRow>(
      `SELECT c.id,
              c.title,
              c.slug,
              c.status,
              c.duration_minutes,
              c.starts_at,
              c.ends_at,
              i.display_name AS instructor_name,
              i.position AS instructor_position,
              i.signature_url AS instructor_signature_url,
              COALESCE(ccr.certificate_document_type, 'honor_certificate') AS certificate_document_type
       FROM courses c
       JOIN instructors i ON i.id = c.instructor_id
       LEFT JOIN course_completion_rules ccr ON ccr.course_id = c.id
       WHERE c.deleted_at IS NULL
         AND c.status <> 'archived'
         ${courseScope.sql}
       ORDER BY c.updated_at DESC, c.id DESC`,
      courseScope.values,
    ),
    queryRows<ReportCourseLearnerDbRow>(
      `SELECT
         e.id AS enrollment_id,
         u.id AS user_id,
         c.id AS course_id,
         u.name AS learner_name,
         u.email AS learner_email,
         p.phone AS learner_phone,
         c.title AS course_title,
         c.slug AS course_slug,
         r.registration_no,
         COALESCE(r.submitted_at, e.enrolled_at) AS registered_at,
         e.enrolled_at,
         e.completed_at,
         r.status AS registration_status,
         pay.payment_status,
         e.status AS enrollment_status,
         e.progress_percent,
         COALESCE(lesson_stats.total_lessons, 0) AS total_lessons,
         COALESCE(lesson_stats.completed_lessons, 0) AS completed_lessons,
         assessment_stats.pre_test_score,
         assessment_stats.post_test_score,
         COALESCE(task_stats.total_tasks, 0) AS total_tasks,
         COALESCE(task_stats.submitted_tasks, 0) AS submitted_tasks,
         COALESCE(task_stats.pending_tasks, 0) AS pending_tasks,
         COALESCE(task_stats.passed_tasks, 0) AS passed_tasks,
         COALESCE(task_stats.failed_tasks, 0) AS failed_tasks,
         cert_stats.certificate_status,
         cert_stats.certificate_no,
         cert_stats.certificate_pdf_url,
         COALESCE(
           cert_stats.certificate_document_type,
           ccr.certificate_document_type,
           'honor_certificate'
         ) AS certificate_document_type
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN registration_items ri ON ri.id = e.registration_item_id
       LEFT JOIN registrations r ON r.id = ri.registration_id AND r.deleted_at IS NULL
       LEFT JOIN course_completion_rules ccr ON ccr.course_id = c.id
       LEFT JOIN (
         SELECT
           registration_id,
           SUBSTRING_INDEX(
             GROUP_CONCAT(status ORDER BY FIELD(status, 'approved', 'pending_review', 'pending', 'rejected', 'refunded') SEPARATOR ','),
             ',',
             1
           ) AS payment_status
         FROM registration_payments
         WHERE deleted_at IS NULL
         GROUP BY registration_id
       ) pay ON pay.registration_id = r.id
       LEFT JOIN (
         SELECT
           e2.id AS enrollment_id,
           COUNT(DISTINCT l.id) AS total_lessons,
           COUNT(DISTINCT CASE WHEN lp.status = 'completed' THEN l.id END) AS completed_lessons
         FROM enrollments e2
         JOIN course_sections s ON s.course_id = e2.course_id
           AND s.deleted_at IS NULL
           AND s.status <> 'archived'
         JOIN lessons l ON l.section_id = s.id
           AND l.deleted_at IS NULL
           AND l.status = 'published'
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
           AND lp.enrollment_id = e2.id
         GROUP BY e2.id
       ) lesson_stats ON lesson_stats.enrollment_id = e.id
       LEFT JOIN (
         SELECT
           e2.id AS enrollment_id,
           MAX(CASE WHEN a.type = 'pre_test' AND aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 END) AS pre_test_score,
           MAX(CASE WHEN a.type = 'post_test' AND aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 END) AS post_test_score
         FROM enrollments e2
         JOIN assessments a ON a.course_id = e2.course_id
           AND a.deleted_at IS NULL
           AND a.status <> 'archived'
         LEFT JOIN assessment_attempts aa ON aa.assessment_id = a.id
           AND aa.enrollment_id = e2.id
         GROUP BY e2.id
       ) assessment_stats ON assessment_stats.enrollment_id = e.id
       LEFT JOIN (
         SELECT
           e2.id AS enrollment_id,
           COUNT(DISTINCT t.id) AS total_tasks,
           COUNT(DISTINCT CASE WHEN sub.id IS NOT NULL THEN t.id END) AS submitted_tasks,
           COUNT(DISTINCT CASE WHEN sub.status IN ('submitted', 'pending_review', 'needs_revision') THEN t.id END) AS pending_tasks,
           COUNT(DISTINCT CASE
             WHEN sub.status IN ('passed', 'graded')
              AND COALESCE(sub.score, 0) >= t.passing_score
             THEN t.id
           END) AS passed_tasks,
           COUNT(DISTINCT CASE
             WHEN sub.status = 'not_passed'
              OR (sub.status IN ('passed', 'graded') AND COALESCE(sub.score, 0) < t.passing_score)
             THEN t.id
           END) AS failed_tasks
         FROM enrollments e2
         JOIN learning_tasks t ON t.course_id = e2.course_id
           AND t.deleted_at IS NULL
           AND t.status = 'published'
         LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id
           AND sub.enrollment_id = e2.id
         GROUP BY e2.id
       ) task_stats ON task_stats.enrollment_id = e.id
       LEFT JOIN (
         SELECT
           enrollment_id,
           MAX(CASE WHEN status = 'issued' THEN status END) AS certificate_status,
           MAX(CASE WHEN status = 'issued' THEN certificate_no END) AS certificate_no,
           MAX(CASE WHEN status = 'issued' THEN pdf_url END) AS certificate_pdf_url,
           MAX(CASE WHEN status = 'issued' THEN document_type END) AS certificate_document_type
         FROM certificates
         GROUP BY enrollment_id
       ) cert_stats ON cert_stats.enrollment_id = e.id
       WHERE c.deleted_at IS NULL
         AND c.status <> 'archived'
         AND u.deleted_at IS NULL
         ${courseScope.sql}
       ORDER BY c.title ASC, u.name ASC, e.enrolled_at DESC`,
      courseScope.values,
    ),
    getAdminReviewSubmissions(user),
  ]);

  const courseLearnerRows = courseLearnerDbRows.map(normalizeCourseLearnerRow);

  return {
    totals: {
      ...dashboard.stats,
      learners: Number(learnerRows[0]?.total ?? 0),
    },
    courseRows: courseRows.map((row) => ({
      courseTitle: row.course_title,
      enrollments: Number(row.enrollments ?? 0),
      completed: Number(row.completed ?? 0),
      revenue: Number(row.revenue ?? 0),
      certificates: Number(row.certificates ?? 0),
    })),
    paymentRows: paymentRows.map((row) => ({
      status: row.status,
      payments: Number(row.payments ?? 0),
      registrations: Number(row.registrations ?? 0),
      amount: Number(row.amount ?? 0),
    })),
    exports: exportRows.map((row) => ({
      id: Number(row.id),
      reportType: row.report_type,
      status: row.status,
      createdAt: formatDateTime(row.created_at),
      fileUrl: row.file_url,
    })),
    courseOptions: courseOptionRows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      slug: row.slug,
      status: row.status,
      durationMinutes: Number(row.duration_minutes ?? 0),
      startsAt: row.starts_at ? formatDate(row.starts_at) : null,
      endsAt: row.ends_at ? formatDate(row.ends_at) : null,
      instructorName: row.instructor_name,
      instructorPosition: row.instructor_position,
      instructorSignatureUrl: row.instructor_signature_url,
      certificateDocumentType: row.certificate_document_type ?? "honor_certificate",
    })),
    courseLearnerRows,
    learnerRows: buildLearnerRows(courseLearnerRows),
    reviewRows,
  };
}

export async function createReportExport(input: {
  userId: number;
  reportType: string;
  user?: Pick<CurrentUser, "id" | "role">;
}) {
  const data = await getAdminReportData(input.user);
  const payload = {
    generatedAt: new Date().toISOString(),
    reportType: input.reportType,
    scope: input.user?.role === "instructor" ? "instructor_courses" : "all_courses",
    totals: data.totals,
    courseRows: data.courseRows,
    paymentRows: data.paymentRows,
    rows: input.reportType === "registration_payment" ? data.paymentRows : data.courseRows,
  };

  const [result] = await executeQuery<ResultSetHeader>(
    `INSERT INTO report_exports (user_id, report_type, filters_json, status)
     VALUES (?, ?, ?, 'completed')`,
    [input.userId, input.reportType, JSON.stringify(payload)],
  );

  const fileUrl = `/admin/reports/exports/${result.insertId}`;
  await executeQuery<ResultSetHeader>(
    "UPDATE report_exports SET file_url = ? WHERE id = ?",
    [fileUrl, result.insertId],
  );

  await executeQuery<ResultSetHeader>(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
     VALUES (?, 'reports.export_created', 'report_export', ?, JSON_OBJECT('reportType', ?))`,
    [input.userId, result.insertId, input.reportType],
  ).catch(() => {});

  return result.insertId;
}

export async function getReportExportPayload(
  exportId: number,
  user?: Pick<CurrentUser, "id" | "role">,
) {
  const accessScope =
    user?.role === "instructor"
      ? { sql: "AND user_id = ?", values: [user.id] }
      : { sql: "", values: [] };
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      report_type: string;
      filters_json: string | Record<string, unknown> | null;
      created_at: string;
    }
  >(
    `SELECT id, report_type, filters_json, created_at
     FROM report_exports
     WHERE id = ?
       AND status = 'completed'
       ${accessScope.sql}
     LIMIT 1`,
    [exportId, ...accessScope.values],
  );

  const row = rows[0];
  if (!row) return null;

  const payload =
    typeof row.filters_json === "string"
      ? JSON.parse(row.filters_json || "{}")
      : (row.filters_json ?? {});

  return {
    id: Number(row.id),
    reportType: row.report_type,
    createdAt: row.created_at,
    payload,
  };
}

export async function saveSiteSettings(input: PublicSiteSettings & { userId: number }) {
  const settings = [
    ["site.name", input.name],
    ["site.short_name", input.shortName],
    ["site.phone", input.phone],
    ["site.email", input.email],
    ["site.address", input.address],
  ];

  for (const [key, value] of settings) {
    await executeQuery<ResultSetHeader>(
      `INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by)
       VALUES (?, ?, 'text', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, input.userId],
    );
  }
}

export async function getAdminSiteSettings() {
  return getPublicSiteSettings();
}

export async function saveHomeHeroSettings(input: PublicHomeHeroSettings & { userId: number }) {
  const settings = [
    ["home.hero.enabled", input.enabled ? "true" : "false"],
    ["home.hero.title", input.title],
    ["home.hero.subtitle", input.subtitle],
    ["home.hero.description", input.description],
    ["home.hero.image_url", input.imageUrl],
    ["home.hero.primary_label", input.primaryLabel],
    ["home.hero.primary_url", input.primaryUrl],
    ["home.hero.secondary_label", input.secondaryLabel],
    ["home.hero.secondary_url", input.secondaryUrl],
  ];

  for (const [key, value] of settings) {
    await executeQuery<ResultSetHeader>(
      `INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by)
       VALUES (?, ?, 'text', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, input.userId],
    );
  }
}

export async function getAdminHomeHeroSettings() {
  return getPublicHomeHeroSettings();
}
