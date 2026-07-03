import type { RowDataPacket } from "mysql2/promise";
import { formatBaht } from "@/lib/format";
import { queryRows } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { scopedCourseFilter } from "@/lib/course-access";

export interface DatabaseSummary {
  courses: number;
  users: number;
  registrations: number;
  pendingPayments: number;
  pendingAssignments: number;
  certificates: number;
  revenueAmount: number;
  revenueText: string;
}

interface SummaryRow extends RowDataPacket {
  courses: number;
  users: number;
  registrations: number;
  pending_payments: number;
  pending_assignments: number;
  certificates: number;
  revenue_amount: string | number | null;
}

export async function getDatabaseSummary(): Promise<DatabaseSummary | null> {
  try {
    const rows = await queryRows<SummaryRow>(`
      SELECT
        (SELECT COUNT(*) FROM courses WHERE status IN ('open', 'nearly_full') AND deleted_at IS NULL) AS courses,
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
        (SELECT COUNT(*) FROM registrations WHERE deleted_at IS NULL) AS registrations,
        (SELECT COUNT(*) FROM registration_payments rp JOIN registrations r ON r.id = rp.registration_id WHERE rp.status = 'pending_review' AND rp.deleted_at IS NULL AND r.deleted_at IS NULL) AS pending_payments,
        (SELECT COUNT(*) FROM assignment_submissions WHERE status = 'pending_review') AS pending_assignments,
        (SELECT COUNT(*) FROM certificates WHERE status = 'issued') AS certificates,
        (SELECT COALESCE(SUM(rp.amount), 0) FROM registration_payments rp JOIN registrations r ON r.id = rp.registration_id WHERE rp.status = 'approved' AND rp.deleted_at IS NULL AND r.deleted_at IS NULL) AS revenue_amount
    `);

    const row = rows[0];

    if (!row) {
      return null;
    }

    const revenueAmount = Number(row.revenue_amount ?? 0);

    return {
      courses: Number(row.courses ?? 0),
      users: Number(row.users ?? 0),
      registrations: Number(row.registrations ?? 0),
      pendingPayments: Number(row.pending_payments ?? 0),
      pendingAssignments: Number(row.pending_assignments ?? 0),
      certificates: Number(row.certificates ?? 0),
      revenueAmount,
      revenueText: formatBaht(revenueAmount),
    };
  } catch {
    return null;
  }
}

export interface AdminCourseRow {
  slug: string;
  title: string;
  categoryName: string;
  instructorName: string;
  status: string;
  registrationFee: number;
  registeredCount: number;
  capacity: number | null;
}

interface CourseRow extends RowDataPacket {
  slug: string;
  title: string;
  category_name: string;
  instructor_name: string;
  status: string;
  registration_fee: string | number;
  registered_count: number;
  capacity: number | null;
}

export async function getAdminCourseRows(): Promise<AdminCourseRow[]> {
  const rows = await queryRows<CourseRow>(`
    SELECT
      c.slug,
      c.title,
      cat.name AS category_name,
      i.display_name AS instructor_name,
      c.status,
      c.registration_fee,
      COUNT(e.id) AS registered_count,
      c.capacity
    FROM courses c
    JOIN categories cat ON cat.id = c.category_id
    JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, cat.name, i.display_name
    ORDER BY c.created_at DESC
  `);

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    categoryName: row.category_name,
    instructorName: row.instructor_name,
    status: row.status,
    registrationFee: Number(row.registration_fee),
    registeredCount: Number(row.registered_count),
    capacity: row.capacity === null ? null : Number(row.capacity),
  }));
}

export type CourseManagementStatus =
  | "draft"
  | "open"
  | "nearly_full"
  | "closed"
  | "archived";

export type CourseManagementFormat = "online" | "live_online" | "recorded";
export type CourseManagementLevel = "beginner" | "intermediate" | "advanced";
export type PromotionDiscountType = "amount" | "percent";
export type CertificateDocumentType = "certificate" | "honor_certificate";

export interface CourseCategoryOption {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

export interface CourseInstructorOption {
  id: number;
  userId: number | null;
  displayName: string;
  email: string;
  position: string | null;
  signatureUrl: string | null;
}

export interface CourseManagementRow {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverImageUrl: string | null;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  categoryIcon: string | null;
  instructorId: number;
  instructorName: string;
  instructorEmail: string;
  coInstructors: CourseInstructorOption[];
  registrationFee: number;
  originalFee: number | null;
  durationMinutes: number;
  capacity: number | null;
  format: CourseManagementFormat;
  level: CourseManagementLevel;
  status: CourseManagementStatus;
  startsAt: string | null;
  endsAt: string | null;
  lessonsCount: number;
  registeredCount: number;
  promotionId: number | null;
  promotionName: string | null;
  promotionDescription: string | null;
  discountType: PromotionDiscountType | null;
  discountValue: number | null;
  promotionStartsAt: string | null;
  promotionEndsAt: string | null;
  promotionStatus: "active" | "inactive" | null;
  certificateDocumentType: CertificateDocumentType;
}

interface CourseManagementDbRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  cover_image_url: string | null;
  category_id: number;
  category_name: string;
  category_slug: string;
  category_icon: string | null;
  instructor_id: number;
  instructor_name: string;
  instructor_email: string;
  registration_fee: string | number;
  original_fee: string | number | null;
  duration_minutes: number;
  capacity: number | null;
  format: CourseManagementFormat;
  level: CourseManagementLevel;
  status: CourseManagementStatus;
  starts_at: string | null;
  ends_at: string | null;
  lessons_count: number;
  registered_count: number;
  promotion_id: number | null;
  promotion_name: string | null;
  promotion_description: string | null;
  discount_type: PromotionDiscountType | null;
  discount_value: string | number | null;
  promotion_starts_at: string | null;
  promotion_ends_at: string | null;
  promotion_status: "active" | "inactive" | null;
  certificate_document_type: CertificateDocumentType | null;
}

interface CategoryOptionDbRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface InstructorOptionDbRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  display_name: string;
  email: string;
  position: string | null;
  signature_url: string | null;
}

interface CourseCoInstructorDbRow extends InstructorOptionDbRow {
  course_id: number;
}

export interface CourseManagementData {
  courses: CourseManagementRow[];
  categories: CourseCategoryOption[];
  instructors: CourseInstructorOption[];
}

export async function getCourseManagementData(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<CourseManagementData> {
  const instructorOnly = user?.role === "instructor";
  const instructorOptionFilter = instructorOnly ? "AND u.id = ?" : "";
  const instructorValues = instructorOnly && user ? [user.id] : [];
  const courseScope = scopedCourseFilter(user, "c", "edit");

  const [courses, categories, instructors] = await Promise.all([
    queryRows<CourseManagementDbRow>(
      `
      SELECT
        c.id,
        c.slug,
        c.title,
        c.short_description,
        c.description,
        c.cover_image_url,
        c.category_id,
        cat.name AS category_name,
        cat.slug AS category_slug,
        cat.icon AS category_icon,
        c.instructor_id,
        i.display_name AS instructor_name,
        u.email AS instructor_email,
        c.registration_fee,
        c.original_fee,
        c.duration_minutes,
        c.capacity,
        c.format,
        c.level,
        c.status,
        c.starts_at,
        c.ends_at,
        COUNT(DISTINCT l.id) AS lessons_count,
        COUNT(DISTINCT e.id) AS registered_count,
        p.id AS promotion_id,
        p.name AS promotion_name,
        p.description AS promotion_description,
        p.discount_type,
        p.discount_value,
        p.starts_at AS promotion_starts_at,
        p.ends_at AS promotion_ends_at,
        p.status AS promotion_status,
        COALESCE(ccr.certificate_document_type, 'honor_certificate') AS certificate_document_type
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      JOIN instructors i ON i.id = c.instructor_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN course_sections s ON s.course_id = c.id AND s.deleted_at IS NULL AND s.status <> 'archived'
      LEFT JOIN lessons l ON l.section_id = s.id AND l.deleted_at IS NULL AND l.status <> 'archived'
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
      LEFT JOIN course_promotions cp ON cp.course_id = c.id
      LEFT JOIN promotions p ON p.id = cp.promotion_id
      LEFT JOIN course_completion_rules ccr ON ccr.course_id = c.id
      WHERE c.deleted_at IS NULL
        AND u.deleted_at IS NULL
        ${courseScope.sql}
      GROUP BY c.id, cat.id, i.id, u.id, p.id, ccr.certificate_document_type
      ORDER BY c.updated_at DESC, c.id DESC
    `,
      courseScope.values,
    ),
    queryRows<CategoryOptionDbRow>(`
      SELECT id, name, slug, icon, description
      FROM categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC
    `),
    queryRows<InstructorOptionDbRow>(
      `
      SELECT i.id, i.user_id, i.display_name, u.email, i.position, i.signature_url
      FROM instructors i
      JOIN users u ON u.id = i.user_id
      WHERE i.status = 'active'
        AND u.status = 'active'
        AND u.deleted_at IS NULL
        ${instructorOptionFilter}
      ORDER BY i.display_name ASC
    `,
      instructorValues,
    ),
  ]);

  const courseIds = courses.map((row) => Number(row.id));
  const coInstructorRows = courseIds.length
    ? await queryRows<CourseCoInstructorDbRow>(
        `
        SELECT ci.course_id, i.id, i.user_id, i.display_name, u.email, i.position, i.signature_url
        FROM course_instructors ci
        JOIN instructors i ON i.id = ci.instructor_id
        JOIN users u ON u.id = i.user_id
        WHERE ci.course_id IN (${courseIds.map(() => "?").join(",")})
          AND ci.role = 'co_instructor'
          AND ci.can_edit = 1
          AND i.status = 'active'
          AND u.status = 'active'
          AND u.deleted_at IS NULL
        ORDER BY ci.course_id, ci.sort_order, i.display_name
      `,
        courseIds,
      )
    : [];
  const coInstructorsByCourseId = new Map<number, CourseInstructorOption[]>();
  for (const row of coInstructorRows) {
    const courseId = Number(row.course_id);
    const rows = coInstructorsByCourseId.get(courseId) ?? [];
    rows.push({
      id: Number(row.id),
      userId: row.user_id === null ? null : Number(row.user_id),
      displayName: row.display_name,
      email: row.email,
      position: row.position,
      signatureUrl: row.signature_url,
    });
    coInstructorsByCourseId.set(courseId, rows);
  }

  return {
    courses: courses.map((row) => ({
      id: Number(row.id),
      slug: row.slug,
      title: row.title,
      shortDescription: row.short_description,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      categoryId: Number(row.category_id),
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      categoryIcon: row.category_icon,
      instructorId: Number(row.instructor_id),
      instructorName: row.instructor_name,
      instructorEmail: row.instructor_email,
      coInstructors: coInstructorsByCourseId.get(Number(row.id)) ?? [],
      registrationFee: Number(row.registration_fee),
      originalFee: row.original_fee === null ? null : Number(row.original_fee),
      durationMinutes: Number(row.duration_minutes ?? 0),
      capacity: row.capacity === null ? null : Number(row.capacity),
      format: row.format,
      level: row.level,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      lessonsCount: Number(row.lessons_count ?? 0),
      registeredCount: Number(row.registered_count ?? 0),
      promotionId: row.promotion_id === null ? null : Number(row.promotion_id),
      promotionName: row.promotion_name,
      promotionDescription: row.promotion_description,
      discountType: row.discount_type,
      discountValue: row.discount_value === null ? null : Number(row.discount_value),
      promotionStartsAt: row.promotion_starts_at,
      promotionEndsAt: row.promotion_ends_at,
      promotionStatus: row.promotion_status,
      certificateDocumentType: row.certificate_document_type ?? "honor_certificate",
    })),
    categories: categories.map((row) => ({
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      description: row.description,
    })),
    instructors: instructors.map((row) => ({
      id: Number(row.id),
      userId: row.user_id === null ? null : Number(row.user_id),
      displayName: row.display_name,
      email: row.email,
      position: row.position,
      signatureUrl: row.signature_url,
    })),
  };
}

export type CourseSectionLearningMode = "online" | "live_online" | "blended";
export type BuilderPublishStatus = "draft" | "published" | "archived";
export type CourseSectionStatus = BuilderPublishStatus;
export type CourseBuilderLessonType = "video" | "document" | "practice";
export type CourseBuilderResourceType =
  | "pdf"
  | "doc"
  | "link"
  | "worksheet"
  | "video"
  | "image"
  | "other";
export type CourseBuilderAssessmentType =
  | "pre_test"
  | "quiz"
  | "post_test"
  | "assignment"
  | "final_project";
export type CourseBuilderQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay"
  | "file_upload";
export type CourseBuilderQuestionStatus = "active" | "inactive" | "archived";
export type CourseBuilderShowAnswers = "immediate" | "after_close" | "never";

export interface CourseBuilderCourse {
  id: number;
  slug: string;
  title: string;
  categoryName: string;
  instructorName: string;
  status: CourseManagementStatus;
  durationMinutes: number;
}

export interface CourseBuilderResource {
  id: number;
  lessonId: number;
  title: string;
  resourceType: CourseBuilderResourceType;
  fileUrl: string;
  fileName: string | null;
  fileSize: string | null;
  status: BuilderPublishStatus;
  sortOrder: number;
}

export interface CourseBuilderQuestionOption {
  id: number;
  questionId: number;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface CourseBuilderQuestion {
  id: number;
  assessmentId: number;
  questionText: string;
  questionType: CourseBuilderQuestionType;
  score: number;
  explanation: string | null;
  status: CourseBuilderQuestionStatus;
  sortOrder: number;
  options: CourseBuilderQuestionOption[];
}

export interface CourseBuilderAssessment {
  id: number;
  courseId: number;
  sectionId: number | null;
  lessonId: number | null;
  sharedQuestionSourceId: number | null;
  questionSourceAssessmentId: number;
  title: string;
  type: CourseBuilderAssessmentType;
  description: string | null;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  questionLimit: number | null;
  isRequired: boolean;
  countsTowardCompletion: boolean;
  compareGroup: string | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showAnswers: CourseBuilderShowAnswers;
  status: BuilderPublishStatus;
  sortOrder: number;
  questionCount: number;
  submissionCount: number;
  questions: CourseBuilderQuestion[];
}

export type CourseBuilderTaskType = "worksheet" | "practice";
export type CourseBuilderSubmissionMode = "file" | "link" | "file_or_link" | "text";

export interface CourseBuilderTaskAttachment {
  id: number;
  taskId: number;
  title: string;
  fileUrl: string;
  fileName: string | null;
  fileType: string;
  sortOrder: number;
}

export interface CourseBuilderTaskRubric {
  id: number;
  taskId: number;
  title: string;
  description: string | null;
  maxScore: number;
  sortOrder: number;
}

export interface CourseBuilderTask {
  id: number;
  courseId: number;
  sectionId: number | null;
  lessonId: number | null;
  assessmentId: number | null;
  sectionTitle: string | null;
  lessonTitle: string | null;
  taskType: CourseBuilderTaskType;
  title: string;
  description: string | null;
  instructionHtml: string | null;
  instructionFileUrl: string | null;
  instructionFileName: string | null;
  resourceUrl: string | null;
  submissionMode: CourseBuilderSubmissionMode;
  maxScore: number;
  passingScore: number;
  weightPercent: number;
  dueDaysAfterEnrollment: number | null;
  allowResubmission: boolean;
  requireEvidence: boolean;
  evidenceRequiredCount: number;
  status: BuilderPublishStatus;
  sortOrder: number;
  attachmentCount: number;
  rubricCount: number;
  submissionCount: number;
  pendingReviewCount: number;
  attachments: CourseBuilderTaskAttachment[];
  rubrics: CourseBuilderTaskRubric[];
}

export interface CourseBuilderLesson {
  id: number;
  sectionId: number;
  title: string;
  description: string | null;
  content: string | null;
  lessonType: CourseBuilderLessonType;
  videoUrl: string | null;
  durationMinutes: number;
  isPreview: boolean;
  status: BuilderPublishStatus;
  sortOrder: number;
  resources: CourseBuilderResource[];
  assessments: CourseBuilderAssessment[];
}

export interface CourseBuilderSection {
  id: number;
  courseId: number;
  code: string | null;
  title: string;
  description: string | null;
  objectives: string | null;
  competency: string | null;
  hours: number;
  learningMode: CourseSectionLearningMode;
  passingScore: number;
  unlockRule: string;
  status: CourseSectionStatus;
  sortOrder: number;
  lessons: CourseBuilderLesson[];
  assessments: CourseBuilderAssessment[];
}

export interface CourseBuilderData {
  course: CourseBuilderCourse;
  sections: CourseBuilderSection[];
  courseAssessments: CourseBuilderAssessment[];
  tasks: CourseBuilderTask[];
}

interface CourseBuilderCourseDbRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  category_name: string;
  instructor_name: string;
  status: CourseManagementStatus;
  duration_minutes: number;
}

interface CourseBuilderSectionDbRow extends RowDataPacket {
  id: number;
  course_id: number;
  code: string | null;
  title: string;
  description: string | null;
  objectives: string | null;
  competency: string | null;
  hours: number;
  learning_mode: CourseSectionLearningMode;
  passing_score: string | number;
  unlock_rule: string;
  status: CourseSectionStatus;
  sort_order: number;
}

interface CourseBuilderLessonDbRow extends RowDataPacket {
  id: number;
  section_id: number;
  title: string;
  description: string | null;
  content: string | null;
  lesson_type: CourseBuilderLessonType;
  video_url: string | null;
  duration_minutes: number;
  is_preview: 0 | 1 | boolean;
  status: BuilderPublishStatus;
  sort_order: number;
}

interface CourseBuilderResourceDbRow extends RowDataPacket {
  id: number;
  lesson_id: number;
  title: string;
  resource_type: CourseBuilderResourceType;
  file_url: string;
  file_name: string | null;
  file_size: string | null;
  status: BuilderPublishStatus;
  sort_order: number;
}

interface CourseBuilderAssessmentDbRow extends RowDataPacket {
  id: number;
  course_id: number;
  section_id: number | null;
  lesson_id: number | null;
  shared_question_source_id: number | null;
  title: string;
  type: CourseBuilderAssessmentType;
  description: string | null;
  passing_score: string | number;
  max_attempts: number | null;
  time_limit_minutes: number | null;
  question_limit: number | null;
  is_required: 0 | 1 | boolean;
  counts_toward_completion: 0 | 1 | boolean;
  compare_group: string | null;
  randomize_questions: 0 | 1 | boolean;
  randomize_options: 0 | 1 | boolean;
  show_answers: CourseBuilderShowAnswers;
  status: BuilderPublishStatus;
  sort_order: number;
  question_count: number;
  submission_count: number;
}

interface CourseBuilderQuestionDbRow extends RowDataPacket {
  id: number;
  assessment_id: number;
  question_text: string;
  question_type: CourseBuilderQuestionType;
  score: string | number;
  explanation: string | null;
  status: CourseBuilderQuestionStatus;
  sort_order: number;
}

interface CourseBuilderQuestionOptionDbRow extends RowDataPacket {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: 0 | 1 | boolean;
  sort_order: number;
}

interface CourseBuilderTaskDbRow extends RowDataPacket {
  id: number;
  course_id: number;
  section_id: number | null;
  lesson_id: number | null;
  assessment_id: number | null;
  section_title: string | null;
  lesson_title: string | null;
  task_type: CourseBuilderTaskType;
  title: string;
  description: string | null;
  instruction_html: string | null;
  instruction_file_url: string | null;
  instruction_file_name: string | null;
  resource_url: string | null;
  submission_mode: CourseBuilderSubmissionMode;
  max_score: string | number;
  passing_score: string | number;
  weight_percent: string | number;
  due_days_after_enrollment: number | null;
  allow_resubmission: 0 | 1 | boolean;
  require_evidence: 0 | 1 | boolean;
  evidence_required_count: number;
  status: BuilderPublishStatus;
  sort_order: number;
  attachment_count: number;
  rubric_count: number;
  submission_count: number;
  pending_review_count: number | null;
}

interface CourseBuilderTaskAttachmentDbRow extends RowDataPacket {
  id: number;
  task_id: number;
  title: string;
  file_url: string;
  file_name: string | null;
  file_type: string;
  sort_order: number;
}

interface CourseBuilderTaskRubricDbRow extends RowDataPacket {
  id: number;
  task_id: number;
  title: string;
  description: string | null;
  max_score: string | number;
  sort_order: number;
}

function mapAssessment(
  row: CourseBuilderAssessmentDbRow,
  questions: CourseBuilderQuestion[] = [],
): CourseBuilderAssessment {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    sectionId: row.section_id === null ? null : Number(row.section_id),
    lessonId: row.lesson_id === null ? null : Number(row.lesson_id),
    sharedQuestionSourceId:
      row.shared_question_source_id === null ? null : Number(row.shared_question_source_id),
    questionSourceAssessmentId:
      row.shared_question_source_id === null ? Number(row.id) : Number(row.shared_question_source_id),
    title: row.title,
    type: row.type,
    description: row.description,
    passingScore: Number(row.passing_score),
    maxAttempts: row.max_attempts === null ? null : Number(row.max_attempts),
    timeLimitMinutes:
      row.time_limit_minutes === null ? null : Number(row.time_limit_minutes),
    questionLimit: row.question_limit === null ? null : Number(row.question_limit),
    isRequired: Boolean(row.is_required),
    countsTowardCompletion: Boolean(row.counts_toward_completion),
    compareGroup: row.compare_group,
    randomizeQuestions: Boolean(row.randomize_questions),
    randomizeOptions: Boolean(row.randomize_options),
    showAnswers: row.show_answers,
    status: row.status,
    sortOrder: Number(row.sort_order),
    questionCount: Number(row.question_count ?? 0),
    submissionCount: Number(row.submission_count ?? 0),
    questions,
  };
}

export async function getCourseBuilderData(
  slug: string,
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<CourseBuilderData | null> {
  const instructorFilter = user?.role === "instructor" ? "AND i.user_id = ?" : "";
  const courseRows = await queryRows<CourseBuilderCourseDbRow>(
    `
      SELECT
        c.id,
        c.slug,
        c.title,
        cat.name AS category_name,
        i.display_name AS instructor_name,
        c.status,
        c.duration_minutes
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      JOIN instructors i ON i.id = c.instructor_id
      WHERE c.slug = ? AND c.deleted_at IS NULL
        ${instructorFilter}
      LIMIT 1
    `,
    user?.role === "instructor" ? [slug, user.id] : [slug],
  );
  const courseRow = courseRows[0];

  if (!courseRow) {
    return null;
  }

  const courseId = Number(courseRow.id);
  const [
    sectionRows,
    lessonRows,
    resourceRows,
    assessmentRows,
    taskRows,
    taskAttachmentRows,
    taskRubricRows,
  ] = await Promise.all([
    queryRows<CourseBuilderSectionDbRow>(
      `
        SELECT
          id,
          course_id,
          code,
          title,
          description,
          objectives,
          competency,
          hours,
          learning_mode,
          passing_score,
          unlock_rule,
          status,
          sort_order
        FROM course_sections
        WHERE course_id = ?
          AND status <> 'archived'
          AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderLessonDbRow>(
      `
        SELECT
          l.id,
          l.section_id,
          l.title,
          l.description,
          l.content,
          l.lesson_type,
          l.video_url,
          l.duration_minutes,
          l.is_preview,
          l.status,
          l.sort_order
        FROM lessons l
        JOIN course_sections s ON s.id = l.section_id
        WHERE s.course_id = ?
          AND s.status <> 'archived'
          AND s.deleted_at IS NULL
          AND l.status <> 'archived'
          AND l.deleted_at IS NULL
        ORDER BY s.sort_order ASC, l.sort_order ASC, l.id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderResourceDbRow>(
      `
        SELECT
          r.id,
          r.lesson_id,
          r.title,
          r.resource_type,
          r.file_url,
          r.file_name,
          r.file_size,
          r.status,
          r.sort_order
        FROM lesson_resources r
        JOIN lessons l ON l.id = r.lesson_id
        JOIN course_sections s ON s.id = l.section_id
        WHERE s.course_id = ?
          AND s.status <> 'archived'
          AND s.deleted_at IS NULL
          AND l.status <> 'archived'
          AND l.deleted_at IS NULL
          AND r.status <> 'archived'
          AND r.deleted_at IS NULL
        ORDER BY s.sort_order ASC, l.sort_order ASC, r.sort_order ASC, r.id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderAssessmentDbRow>(
      `
        SELECT
          a.id,
          a.course_id,
          a.section_id,
          a.lesson_id,
          a.shared_question_source_id,
          a.title,
          a.type,
          a.description,
          a.passing_score,
          a.max_attempts,
          a.time_limit_minutes,
          a.question_limit,
          a.is_required,
          a.counts_toward_completion,
          a.compare_group,
          a.randomize_questions,
          a.randomize_options,
          a.show_answers,
          a.status,
          a.sort_order,
          COUNT(DISTINCT q.id) AS question_count,
          COUNT(DISTINCT sub.id) AS submission_count
        FROM assessments a
        LEFT JOIN questions q
          ON q.assessment_id = COALESCE(a.shared_question_source_id, a.id)
         AND q.status <> 'archived'
        LEFT JOIN assignment_submissions sub ON sub.assessment_id = a.id
        WHERE a.course_id = ?
          AND a.status <> 'archived'
          AND a.deleted_at IS NULL
        GROUP BY a.id
        ORDER BY a.section_id IS NULL DESC, a.lesson_id IS NULL DESC, a.type ASC, a.sort_order ASC, a.id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderTaskDbRow>(
      `
        SELECT
          t.id,
          t.course_id,
          t.section_id,
          t.lesson_id,
          t.assessment_id,
          s.title AS section_title,
          l.title AS lesson_title,
          t.task_type,
          t.title,
          t.description,
          t.instruction_html,
          t.instruction_file_url,
          t.instruction_file_name,
          t.resource_url,
          t.submission_mode,
          t.max_score,
          t.passing_score,
          t.weight_percent,
          t.due_days_after_enrollment,
          t.allow_resubmission,
          t.require_evidence,
          t.evidence_required_count,
          t.status,
          t.sort_order,
          COUNT(DISTINCT att.id) AS attachment_count,
          COUNT(DISTINCT rb.id) AS rubric_count,
          COUNT(DISTINCT sub.id) AS submission_count,
          SUM(CASE WHEN sub.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count
        FROM learning_tasks t
        LEFT JOIN course_sections s ON s.id = t.section_id
        LEFT JOIN lessons l ON l.id = t.lesson_id
        LEFT JOIN learning_task_attachments att ON att.task_id = t.id
        LEFT JOIN learning_task_rubrics rb ON rb.task_id = t.id
        LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id
        WHERE t.course_id = ?
          AND t.status <> 'archived'
          AND t.deleted_at IS NULL
        GROUP BY t.id, t.course_id, t.section_id, t.lesson_id, t.assessment_id,
                 s.title, l.title, t.task_type, t.title, t.description,
                 t.instruction_html, t.instruction_file_url, t.instruction_file_name,
                 t.resource_url, t.submission_mode, t.max_score, t.passing_score,
                 t.weight_percent, t.due_days_after_enrollment, t.allow_resubmission,
                 t.require_evidence, t.evidence_required_count, t.status, t.sort_order
        ORDER BY t.task_type ASC, t.sort_order ASC, t.id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderTaskAttachmentDbRow>(
      `
        SELECT att.id, att.task_id, att.title, att.file_url, att.file_name,
               att.file_type, att.sort_order
        FROM learning_task_attachments att
        JOIN learning_tasks t ON t.id = att.task_id
        WHERE t.course_id = ?
          AND t.deleted_at IS NULL
        ORDER BY att.task_id ASC, att.sort_order ASC, att.id ASC
      `,
      [courseId],
    ),
    queryRows<CourseBuilderTaskRubricDbRow>(
      `
        SELECT rb.id, rb.task_id, rb.title, rb.description, rb.max_score,
               rb.sort_order
        FROM learning_task_rubrics rb
        JOIN learning_tasks t ON t.id = rb.task_id
        WHERE t.course_id = ?
          AND t.deleted_at IS NULL
        ORDER BY rb.task_id ASC, rb.sort_order ASC, rb.id ASC
      `,
      [courseId],
    ),
  ]);

  const questionSourceIds = [
    ...new Set(
      assessmentRows.map((row) =>
        row.shared_question_source_id === null
          ? Number(row.id)
          : Number(row.shared_question_source_id),
      ),
    ),
  ];
  const questionRows = questionSourceIds.length
    ? await queryRows<CourseBuilderQuestionDbRow>(
        `
          SELECT
            id,
            assessment_id,
            question_text,
            question_type,
            score,
            explanation,
            status,
            sort_order
          FROM questions
          WHERE assessment_id IN (${questionSourceIds.map(() => "?").join(",")})
            AND status <> 'archived'
          ORDER BY assessment_id ASC, sort_order ASC, id ASC
        `,
        questionSourceIds,
      )
    : [];
  const questionIds = questionRows.map((row) => Number(row.id));
  const optionRows = questionIds.length
    ? await queryRows<CourseBuilderQuestionOptionDbRow>(
        `
          SELECT id, question_id, option_text, is_correct, sort_order
          FROM question_options
          WHERE question_id IN (${questionIds.map(() => "?").join(",")})
          ORDER BY question_id ASC, sort_order ASC, id ASC
        `,
        questionIds,
      )
    : [];

  const optionsByQuestionId = new Map<number, CourseBuilderQuestionOption[]>();
  for (const row of optionRows) {
    const questionId = Number(row.question_id);
    const options = optionsByQuestionId.get(questionId) ?? [];
    options.push({
      id: Number(row.id),
      questionId,
      optionText: row.option_text,
      isCorrect: Boolean(row.is_correct),
      sortOrder: Number(row.sort_order),
    });
    optionsByQuestionId.set(questionId, options);
  }

  const questionsByAssessmentId = new Map<number, CourseBuilderQuestion[]>();
  for (const row of questionRows) {
    const assessmentId = Number(row.assessment_id);
    const questions = questionsByAssessmentId.get(assessmentId) ?? [];
    questions.push({
      id: Number(row.id),
      assessmentId,
      questionText: row.question_text,
      questionType: row.question_type,
      score: Number(row.score),
      explanation: row.explanation,
      status: row.status,
      sortOrder: Number(row.sort_order),
      options: optionsByQuestionId.get(Number(row.id)) ?? [],
    });
    questionsByAssessmentId.set(assessmentId, questions);
  }

  const resourcesByLessonId = new Map<number, CourseBuilderResource[]>();
  for (const row of resourceRows) {
    const lessonId = Number(row.lesson_id);
    const resources = resourcesByLessonId.get(lessonId) ?? [];
    resources.push({
      id: Number(row.id),
      lessonId,
      title: row.title,
      resourceType: row.resource_type,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileSize: row.file_size,
      status: row.status,
      sortOrder: Number(row.sort_order),
    });
    resourcesByLessonId.set(lessonId, resources);
  }

  const taskAttachmentsByTaskId = new Map<number, CourseBuilderTaskAttachment[]>();
  for (const row of taskAttachmentRows) {
    const taskId = Number(row.task_id);
    const attachments = taskAttachmentsByTaskId.get(taskId) ?? [];
    attachments.push({
      id: Number(row.id),
      taskId,
      title: row.title,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileType: row.file_type,
      sortOrder: Number(row.sort_order),
    });
    taskAttachmentsByTaskId.set(taskId, attachments);
  }

  const taskRubricsByTaskId = new Map<number, CourseBuilderTaskRubric[]>();
  for (const row of taskRubricRows) {
    const taskId = Number(row.task_id);
    const rubrics = taskRubricsByTaskId.get(taskId) ?? [];
    rubrics.push({
      id: Number(row.id),
      taskId,
      title: row.title,
      description: row.description,
      maxScore: Number(row.max_score),
      sortOrder: Number(row.sort_order),
    });
    taskRubricsByTaskId.set(taskId, rubrics);
  }

  const tasks = taskRows.map((row): CourseBuilderTask => {
    const taskId = Number(row.id);
    return {
      id: taskId,
      courseId: Number(row.course_id),
      sectionId: row.section_id === null ? null : Number(row.section_id),
      lessonId: row.lesson_id === null ? null : Number(row.lesson_id),
      assessmentId: row.assessment_id === null ? null : Number(row.assessment_id),
      sectionTitle: row.section_title,
      lessonTitle: row.lesson_title,
      taskType: row.task_type,
      title: row.title,
      description: row.description,
      instructionHtml: row.instruction_html,
      instructionFileUrl: row.instruction_file_url,
      instructionFileName: row.instruction_file_name,
      resourceUrl: row.resource_url,
      submissionMode: row.submission_mode,
      maxScore: Number(row.max_score),
      passingScore: Number(row.passing_score),
      weightPercent: Number(row.weight_percent),
      dueDaysAfterEnrollment:
        row.due_days_after_enrollment === null ? null : Number(row.due_days_after_enrollment),
      allowResubmission: Boolean(row.allow_resubmission),
      requireEvidence: Boolean(row.require_evidence),
      evidenceRequiredCount: Number(row.evidence_required_count ?? 0),
      status: row.status,
      sortOrder: Number(row.sort_order),
      attachmentCount: Number(row.attachment_count ?? 0),
      rubricCount: Number(row.rubric_count ?? 0),
      submissionCount: Number(row.submission_count ?? 0),
      pendingReviewCount: Number(row.pending_review_count ?? 0),
      attachments: taskAttachmentsByTaskId.get(taskId) ?? [],
      rubrics: taskRubricsByTaskId.get(taskId) ?? [],
    };
  });

  const assessmentsByLessonId = new Map<number, CourseBuilderAssessment[]>();
  const assessmentsBySectionId = new Map<number, CourseBuilderAssessment[]>();
  const courseAssessments: CourseBuilderAssessment[] = [];
  for (const row of assessmentRows) {
    const questionSourceId =
      row.shared_question_source_id === null ? Number(row.id) : Number(row.shared_question_source_id);
    const assessment = mapAssessment(row, questionsByAssessmentId.get(questionSourceId) ?? []);

    if (assessment.lessonId === null && assessment.sectionId === null) {
      courseAssessments.push(assessment);
      continue;
    }

    if (assessment.lessonId === null && assessment.sectionId !== null) {
      const assessments = assessmentsBySectionId.get(assessment.sectionId) ?? [];
      assessments.push(assessment);
      assessmentsBySectionId.set(assessment.sectionId, assessments);
      continue;
    }

    if (assessment.lessonId !== null) {
      const assessments = assessmentsByLessonId.get(assessment.lessonId) ?? [];
      assessments.push(assessment);
      assessmentsByLessonId.set(assessment.lessonId, assessments);
    }
  }

  const lessonsBySectionId = new Map<number, CourseBuilderLesson[]>();
  for (const row of lessonRows) {
    const sectionId = Number(row.section_id);
    const lessonId = Number(row.id);
    const lessons = lessonsBySectionId.get(sectionId) ?? [];
    lessons.push({
      id: lessonId,
      sectionId,
      title: row.title,
      description: row.description,
      content: row.content,
      lessonType: row.lesson_type,
      videoUrl: row.video_url,
      durationMinutes: Number(row.duration_minutes ?? 0),
      isPreview: Boolean(row.is_preview),
      status: row.status,
      sortOrder: Number(row.sort_order),
      resources: resourcesByLessonId.get(lessonId) ?? [],
      assessments: assessmentsByLessonId.get(lessonId) ?? [],
    });
    lessonsBySectionId.set(sectionId, lessons);
  }

  return {
    course: {
      id: courseId,
      slug: courseRow.slug,
      title: courseRow.title,
      categoryName: courseRow.category_name,
      instructorName: courseRow.instructor_name,
      status: courseRow.status,
      durationMinutes: Number(courseRow.duration_minutes ?? 0),
    },
    sections: sectionRows.map((row) => ({
      id: Number(row.id),
      courseId: Number(row.course_id),
      code: row.code,
      title: row.title,
      description: row.description,
      objectives: row.objectives,
      competency: row.competency,
      hours: Number(row.hours ?? 0),
      learningMode: row.learning_mode,
      passingScore: Number(row.passing_score),
      unlockRule: row.unlock_rule,
      status: row.status,
      sortOrder: Number(row.sort_order),
      lessons: lessonsBySectionId.get(Number(row.id)) ?? [],
      assessments: assessmentsBySectionId.get(Number(row.id)) ?? [],
    })),
    courseAssessments,
    tasks,
  };
}
