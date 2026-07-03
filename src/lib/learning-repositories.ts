import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { scopedCourseFilter } from "@/lib/course-access";

export type LearningTaskType = "worksheet" | "practice";
export type LearningTaskStatus = "draft" | "published" | "archived";
export type LearningSubmissionStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "graded"
  | "passed"
  | "not_passed"
  | "needs_revision";

export type LearningAssessmentType =
  | "pre_test"
  | "quiz"
  | "post_test"
  | "assignment"
  | "final_project";

export interface LearningCourseOption {
  id: number;
  title: string;
  slug: string;
  status: string;
  categoryName: string | null;
  instructorName: string | null;
  registrationFee: number;
}

export interface LearningSection {
  id: number;
  courseId: number;
  code: string | null;
  title: string;
  description: string | null;
  status: string;
  sortOrder: number;
}

export interface LearningLesson {
  id: number;
  courseId: number;
  sectionId: number;
  sectionTitle: string;
  title: string;
  description: string | null;
  content: string | null;
  lessonType: string;
  videoUrl: string | null;
  durationMinutes: number;
  isPreview: boolean;
  status: string;
  sortOrder: number;
  resources: LearningResource[];
  progressStatus?: string | null;
  progressPercent?: number;
}

export interface LearningResource {
  id: number;
  lessonId: number;
  title: string;
  resourceType: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: string | null;
  status: string;
  sortOrder: number;
}

export interface LearningAssessmentOption {
  id: number;
  courseId: number;
  sectionId: number | null;
  lessonId: number | null;
  sharedQuestionSourceId: number | null;
  title: string;
  type: LearningAssessmentType;
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
  showAnswers: string;
  status: string;
  sortOrder: number;
  ownQuestionCount: number;
  sourceQuestionCount: number;
  attemptCount: number;
  sourceTitle: string | null;
  questions?: LearnerAssessmentQuestion[];
  bestAttempt?: LearnerAssessmentAttempt | null;
}

export interface LearningTaskAttachment {
  id: number;
  taskId: number;
  title: string;
  fileUrl: string;
  fileName: string | null;
  fileType: string;
  sortOrder: number;
}

export interface LearningTaskRubric {
  id: number;
  taskId: number;
  title: string;
  description: string | null;
  maxScore: number;
  sortOrder: number;
}

export interface LearningTask {
  id: number;
  courseId: number;
  sectionId: number | null;
  lessonId: number | null;
  assessmentId: number | null;
  sectionTitle: string | null;
  lessonTitle: string | null;
  taskType: LearningTaskType;
  title: string;
  description: string | null;
  instructionHtml: string | null;
  instructionFileUrl: string | null;
  instructionFileName: string | null;
  resourceUrl: string | null;
  submissionMode: string;
  maxScore: number;
  passingScore: number;
  weightPercent: number;
  dueDaysAfterEnrollment: number | null;
  allowResubmission: boolean;
  requireEvidence: boolean;
  evidenceRequiredCount: number;
  status: LearningTaskStatus;
  sortOrder: number;
  attachmentCount: number;
  rubricCount: number;
  submissionCount: number;
  pendingReviewCount: number;
  attachments: LearningTaskAttachment[];
  rubrics: LearningTaskRubric[];
  submission?: LearnerTaskSubmission | null;
}

export interface CourseEvaluationRule {
  id: number;
  courseId: number;
  criterion: "lesson_progress" | "pre_test" | "post_test" | "worksheet" | "practice";
  title: string;
  weightPercent: number;
  passingScore: number;
  isRequired: boolean;
  status: "active" | "inactive";
  sortOrder: number;
}

export interface LearningManagementCourse extends LearningCourseOption {
  sections: LearningSection[];
  lessons: LearningLesson[];
  assessments: LearningAssessmentOption[];
  tasks: LearningTask[];
  rules: CourseEvaluationRule[];
}

export interface LearningManagementData {
  courses: LearningManagementCourse[];
}

export interface LearningPreviewLearner {
  id: number;
  name: string;
  email: string;
  enrollmentId: number;
  enrollmentStatus: string;
  progressPercent: number;
  enrolledAt: string | null;
}

export interface LearnerAssessmentOption {
  id: number;
  questionId: number;
  optionText: string;
  sortOrder: number;
}

export interface LearnerAssessmentQuestion {
  id: number;
  questionText: string;
  questionType: string;
  score: number;
  explanation: string | null;
  sortOrder: number;
  options: LearnerAssessmentOption[];
}

export interface LearnerAssessmentAttempt {
  id: number;
  assessmentId: number;
  score: number | null;
  maxScore: number | null;
  status: string;
  submittedAt: string | null;
}

export interface LearnerTaskEvidence {
  id: number;
  evidenceType: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  fileName: string | null;
  sortOrder: number;
}

export interface LearnerTaskSubmission {
  id: number;
  taskId: number;
  status: LearningSubmissionStatus;
  score: number | null;
  feedback: string | null;
  submittedFileUrl: string | null;
  submittedFileName: string | null;
  submittedLinkUrl: string | null;
  answerText: string | null;
  note: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  evidences: LearnerTaskEvidence[];
}

export interface LearnerClassroomData {
  user: {
    id: number;
    name: string;
    email: string;
  };
  course: LearningCourseOption & {
    shortDescription: string | null;
    description: string | null;
    coverImageUrl: string | null;
  };
  enrollment: {
    id: number;
    status: string;
    progressPercent: number;
    enrolledAt: string | null;
    completedAt: string | null;
  } | null;
  sections: LearningSection[];
  lessons: LearningLesson[];
  assessments: LearningAssessmentOption[];
  tasks: LearningTask[];
  rules: CourseEvaluationRule[];
  summary: LearnerClassroomSummary;
}

export interface LearnerClassroomSummary {
  lessonProgressPercent: number;
  completedLessons: number;
  totalLessons: number;
  preTestScore: number | null;
  postTestScore: number | null;
  improvementPercent: number | null;
  submittedTasks: number;
  passedTasks: number;
  totalTasks: number;
  weightedScore: number;
  totalWeight: number;
  readyForCertificate: boolean;
}

export interface LearnerCourseCard {
  courseId: number;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  status: string;
  progressPercent: number;
  enrolledAt: string | null;
  taskCount: number;
  pendingTaskCount: number;
  certificateStatus: string | null;
  certificateNo: string | null;
  certificateUrl: string | null;
}

interface CourseRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  status: string;
  category_name: string | null;
  instructor_name: string | null;
  registration_fee: string | number;
  short_description?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
}

interface SectionRow extends RowDataPacket {
  id: number;
  course_id: number;
  code: string | null;
  title: string;
  description: string | null;
  status: string;
  sort_order: number;
}

interface LessonRow extends RowDataPacket {
  id: number;
  course_id: number;
  section_id: number;
  section_title: string;
  title: string;
  description: string | null;
  content: string | null;
  lesson_type: string;
  video_url: string | null;
  duration_minutes: number;
  is_preview: 0 | 1 | boolean;
  status: string;
  sort_order: number;
  progress_status?: string | null;
  progress_percent?: string | number | null;
}

interface ResourceRow extends RowDataPacket {
  id: number;
  lesson_id: number;
  title: string;
  resource_type: string;
  file_url: string;
  file_name: string | null;
  file_size: string | null;
  status: string;
  sort_order: number;
}

interface AssessmentRow extends RowDataPacket {
  id: number;
  course_id: number;
  section_id: number | null;
  lesson_id: number | null;
  shared_question_source_id: number | null;
  title: string;
  type: LearningAssessmentType;
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
  show_answers: string;
  status: string;
  sort_order: number;
}

interface CountRow extends RowDataPacket {
  id: number;
  count_value: number;
}

interface TaskRow extends RowDataPacket {
  id: number;
  course_id: number;
  section_id: number | null;
  lesson_id: number | null;
  assessment_id: number | null;
  section_title: string | null;
  lesson_title: string | null;
  task_type: LearningTaskType;
  title: string;
  description: string | null;
  instruction_html: string | null;
  instruction_file_url: string | null;
  instruction_file_name: string | null;
  resource_url: string | null;
  submission_mode: string;
  max_score: string | number;
  passing_score: string | number;
  weight_percent: string | number;
  due_days_after_enrollment: number | null;
  allow_resubmission: 0 | 1 | boolean;
  require_evidence: 0 | 1 | boolean;
  evidence_required_count: number;
  status: LearningTaskStatus;
  sort_order: number;
  attachment_count: number;
  rubric_count: number;
  submission_count: number;
  pending_review_count: number;
}

interface AttachmentRow extends RowDataPacket {
  id: number;
  task_id: number;
  title: string;
  file_url: string;
  file_name: string | null;
  file_type: string;
  sort_order: number;
}

interface RubricRow extends RowDataPacket {
  id: number;
  task_id: number;
  title: string;
  description: string | null;
  max_score: string | number;
  sort_order: number;
}

interface RuleRow extends RowDataPacket {
  id: number;
  course_id: number;
  criterion: CourseEvaluationRule["criterion"];
  title: string;
  weight_percent: string | number;
  passing_score: string | number;
  is_required: 0 | 1 | boolean;
  status: "active" | "inactive";
  sort_order: number;
}

interface QuestionRow extends RowDataPacket {
  id: number;
  assessment_id: number;
  question_text: string;
  question_type: string;
  score: string | number;
  explanation: string | null;
  sort_order: number;
}

interface OptionRow extends RowDataPacket {
  id: number;
  question_id: number;
  option_text: string;
  sort_order: number;
}

interface AttemptRow extends RowDataPacket {
  id: number;
  assessment_id: number;
  score: string | number | null;
  max_score: string | number | null;
  status: string;
  submitted_at: string | null;
}

interface SubmissionRow extends RowDataPacket {
  id: number;
  task_id: number;
  status: LearningSubmissionStatus;
  score: string | number | null;
  feedback: string | null;
  submitted_file_url: string | null;
  submitted_file_name: string | null;
  submitted_link_url: string | null;
  answer_text: string | null;
  note: string | null;
  submitted_at: string | null;
  graded_at: string | null;
}

interface EvidenceRow extends RowDataPacket {
  id: number;
  submission_id: number | null;
  task_id: number;
  evidence_type: string;
  evidence_url: string | null;
  evidence_text: string | null;
  file_name: string | null;
  sort_order: number;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapCourse(row: CourseRow): LearningCourseOption {
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    status: row.status,
    categoryName: row.category_name,
    instructorName: row.instructor_name,
    registrationFee: toNumber(row.registration_fee),
  };
}

function mapSection(row: SectionRow): LearningSection {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    sortOrder: Number(row.sort_order),
  };
}

function mapLesson(row: LessonRow): LearningLesson {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    sectionId: Number(row.section_id),
    sectionTitle: row.section_title,
    title: row.title,
    description: row.description,
    content: row.content,
    lessonType: row.lesson_type,
    videoUrl: row.video_url,
    durationMinutes: Number(row.duration_minutes ?? 0),
    isPreview: Boolean(row.is_preview),
    status: row.status,
    sortOrder: Number(row.sort_order),
    resources: [],
    progressStatus: row.progress_status ?? null,
    progressPercent: toNumber(row.progress_percent),
  };
}

function mapAssessment(
  row: AssessmentRow,
  questionCounts: Map<number, number>,
  attemptCounts: Map<number, number>,
  titlesByAssessmentId: Map<number, string>,
): LearningAssessmentOption {
  const sourceId = row.shared_question_source_id ? Number(row.shared_question_source_id) : Number(row.id);

  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    sectionId: row.section_id === null ? null : Number(row.section_id),
    lessonId: row.lesson_id === null ? null : Number(row.lesson_id),
    sharedQuestionSourceId: row.shared_question_source_id === null ? null : Number(row.shared_question_source_id),
    title: row.title,
    type: row.type,
    description: row.description,
    passingScore: toNumber(row.passing_score),
    maxAttempts: row.max_attempts === null ? null : Number(row.max_attempts),
    timeLimitMinutes: row.time_limit_minutes === null ? null : Number(row.time_limit_minutes),
    questionLimit: row.question_limit === null ? null : Number(row.question_limit),
    isRequired: Boolean(row.is_required),
    countsTowardCompletion: Boolean(row.counts_toward_completion),
    compareGroup: row.compare_group,
    randomizeQuestions: Boolean(row.randomize_questions),
    randomizeOptions: Boolean(row.randomize_options),
    showAnswers: row.show_answers,
    status: row.status,
    sortOrder: Number(row.sort_order),
    ownQuestionCount: questionCounts.get(Number(row.id)) ?? 0,
    sourceQuestionCount: questionCounts.get(sourceId) ?? 0,
    attemptCount: attemptCounts.get(Number(row.id)) ?? 0,
    sourceTitle: row.shared_question_source_id ? titlesByAssessmentId.get(sourceId) ?? null : null,
  };
}

function mapTask(row: TaskRow): LearningTask {
  return {
    id: Number(row.id),
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
    maxScore: toNumber(row.max_score, 100),
    passingScore: toNumber(row.passing_score, 70),
    weightPercent: toNumber(row.weight_percent),
    dueDaysAfterEnrollment: row.due_days_after_enrollment === null ? null : Number(row.due_days_after_enrollment),
    allowResubmission: Boolean(row.allow_resubmission),
    requireEvidence: Boolean(row.require_evidence),
    evidenceRequiredCount: Number(row.evidence_required_count ?? 0),
    status: row.status,
    sortOrder: Number(row.sort_order),
    attachmentCount: Number(row.attachment_count ?? 0),
    rubricCount: Number(row.rubric_count ?? 0),
    submissionCount: Number(row.submission_count ?? 0),
    pendingReviewCount: Number(row.pending_review_count ?? 0),
    attachments: [],
    rubrics: [],
  };
}

function mapRule(row: RuleRow): CourseEvaluationRule {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    criterion: row.criterion,
    title: row.title,
    weightPercent: toNumber(row.weight_percent),
    passingScore: toNumber(row.passing_score),
    isRequired: Boolean(row.is_required),
    status: row.status,
    sortOrder: Number(row.sort_order),
  };
}

function mapAttachment(row: AttachmentRow): LearningTaskAttachment {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    title: row.title,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    sortOrder: Number(row.sort_order),
  };
}

function mapRubric(row: RubricRow): LearningTaskRubric {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    title: row.title,
    description: row.description,
    maxScore: toNumber(row.max_score),
    sortOrder: Number(row.sort_order),
  };
}

function groupById<T extends { id: number }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function countsMap(rows: CountRow[]) {
  return new Map(rows.map((row) => [Number(row.id), Number(row.count_value ?? 0)]));
}

function shuffled<T>(rows: T[], enabled: boolean) {
  if (!enabled || rows.length < 2) return rows;
  return [...rows].sort(() => Math.random() - 0.5);
}

async function loadBaseLearningRows(
  courseSlug?: string,
  user?: Pick<CurrentUser, "id" | "role">,
) {
  const filters = ["c.deleted_at IS NULL"];
  const values: Array<string | number | null> = [];

  if (courseSlug) {
    filters.push("c.slug = ?");
    values.push(courseSlug);
  }

  const courseScope = scopedCourseFilter(user, "c", "edit");
  if (courseScope.sql) {
    filters.push(courseScope.sql.replace(/^AND\s+/, ""));
    values.push(...courseScope.values);
  }

  const courseWhere = `WHERE ${filters.join(" AND ")}`;
  const courseAndWhere = `AND ${filters.join(" AND ")}`;
  const activeSectionWhere = "s.deleted_at IS NULL AND s.status <> 'archived'";
  const activeLessonWhere = "l.deleted_at IS NULL AND l.status <> 'archived'";
  const activeTaskWhere = "t.deleted_at IS NULL AND t.status <> 'archived'";
  const activeAssessmentWhere = "a.deleted_at IS NULL AND a.status <> 'archived'";

  const [
    courseRows,
    sectionRows,
    lessonRows,
    resourceRows,
    assessmentRows,
    questionCountRows,
    attemptCountRows,
    taskRows,
    attachmentRows,
    rubricRows,
    ruleRows,
  ] = await Promise.all([
    queryRows<CourseRow>(
      `SELECT c.id, c.title, c.slug, c.status, c.registration_fee,
              c.short_description, c.description, c.cover_image_url,
              cat.name AS category_name, i.display_name AS instructor_name
       FROM courses c
       JOIN categories cat ON cat.id = c.category_id
       JOIN instructors i ON i.id = c.instructor_id
       ${courseWhere}
       ORDER BY c.status = 'open' DESC, c.updated_at DESC, c.id DESC`,
      values,
    ),
    queryRows<SectionRow>(
      `SELECT s.id, s.course_id, s.code, s.title, s.description, s.status, s.sort_order
       FROM course_sections s
       JOIN courses c ON c.id = s.course_id
       WHERE ${activeSectionWhere} ${courseAndWhere}
       ORDER BY s.course_id, s.sort_order, s.id`,
      values,
    ),
    queryRows<LessonRow>(
      `SELECT l.id, s.course_id, l.section_id, s.title AS section_title,
              l.title, l.description, l.content, l.lesson_type, l.video_url,
              l.duration_minutes, l.is_preview, l.status, l.sort_order
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
       WHERE ${activeSectionWhere}
         AND ${activeLessonWhere}
         ${courseAndWhere}
       ORDER BY s.course_id, s.sort_order, l.sort_order, l.id`,
      values,
    ),
    queryRows<ResourceRow>(
      `SELECT r.id, r.lesson_id, r.title, r.resource_type, r.file_url,
              r.file_name, r.file_size, r.status, r.sort_order
       FROM lesson_resources r
       JOIN lessons l ON l.id = r.lesson_id
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
       WHERE ${activeSectionWhere}
         AND ${activeLessonWhere}
         AND r.deleted_at IS NULL
         AND r.status <> 'archived'
         ${courseAndWhere}
       ORDER BY r.lesson_id, r.sort_order, r.id`,
      values,
    ),
    queryRows<AssessmentRow>(
      `SELECT a.id, a.course_id, a.section_id, a.lesson_id, a.shared_question_source_id,
              a.title, a.type, a.description, a.passing_score, a.max_attempts,
              a.time_limit_minutes, a.question_limit, a.is_required, a.counts_toward_completion,
              a.compare_group, a.randomize_questions, a.randomize_options,
              a.show_answers, a.status, a.sort_order
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_sections s ON s.id = a.section_id
       LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE ${activeAssessmentWhere}
         AND (a.section_id IS NULL OR (${activeSectionWhere}))
         AND (a.lesson_id IS NULL OR (${activeLessonWhere}))
         ${courseAndWhere}
       ORDER BY a.course_id, a.type, a.sort_order, a.id`,
      values,
    ),
    queryRows<CountRow>(
      `SELECT q.assessment_id AS id, COUNT(*) AS count_value
       FROM questions q
       JOIN assessments a ON a.id = q.assessment_id
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_sections s ON s.id = a.section_id
       LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE q.status <> 'archived'
         AND ${activeAssessmentWhere}
         AND (a.section_id IS NULL OR (${activeSectionWhere}))
         AND (a.lesson_id IS NULL OR (${activeLessonWhere}))
         ${courseAndWhere}
       GROUP BY q.assessment_id`,
      values,
    ),
    queryRows<CountRow>(
      `SELECT aa.assessment_id AS id, COUNT(*) AS count_value
       FROM assessment_attempts aa
       JOIN assessments a ON a.id = aa.assessment_id
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_sections s ON s.id = a.section_id
       LEFT JOIN lessons l ON l.id = a.lesson_id
       ${courseWhere}
         AND ${activeAssessmentWhere}
         AND (a.section_id IS NULL OR (${activeSectionWhere}))
         AND (a.lesson_id IS NULL OR (${activeLessonWhere}))
       GROUP BY aa.assessment_id`,
      values,
    ),
    queryRows<TaskRow>(
      `SELECT t.id, t.course_id, t.section_id, t.lesson_id, t.assessment_id,
              s.title AS section_title, l.title AS lesson_title,
              t.task_type, t.title, t.description, t.instruction_html,
              t.instruction_file_url, t.instruction_file_name, t.resource_url,
              t.submission_mode, t.max_score, t.passing_score, t.weight_percent,
              t.due_days_after_enrollment, t.allow_resubmission, t.require_evidence,
              t.evidence_required_count, t.status, t.sort_order,
              COUNT(DISTINCT att.id) AS attachment_count,
              COUNT(DISTINCT rb.id) AS rubric_count,
              COUNT(DISTINCT sub.id) AS submission_count,
              SUM(CASE WHEN sub.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count
       FROM learning_tasks t
       JOIN courses c ON c.id = t.course_id
       LEFT JOIN course_sections s ON s.id = t.section_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
       LEFT JOIN learning_task_attachments att ON att.task_id = t.id
       LEFT JOIN learning_task_rubrics rb ON rb.task_id = t.id
       LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id
       WHERE ${activeTaskWhere}
         AND (t.section_id IS NULL OR (${activeSectionWhere}))
         AND (t.lesson_id IS NULL OR (${activeLessonWhere}))
         ${courseAndWhere}
       GROUP BY t.id, t.course_id, t.section_id, t.lesson_id, t.assessment_id,
                s.title, l.title, t.task_type, t.title, t.description,
                t.instruction_html, t.instruction_file_url, t.instruction_file_name,
                t.resource_url, t.submission_mode, t.max_score, t.passing_score,
                t.weight_percent, t.due_days_after_enrollment, t.allow_resubmission,
                t.require_evidence, t.evidence_required_count, t.status, t.sort_order
       ORDER BY t.course_id, t.task_type, t.sort_order, t.id`,
      values,
    ),
    queryRows<AttachmentRow>(
      `SELECT att.id, att.task_id, att.title, att.file_url, att.file_name, att.file_type, att.sort_order
       FROM learning_task_attachments att
       JOIN learning_tasks t ON t.id = att.task_id
       JOIN courses c ON c.id = t.course_id
       LEFT JOIN course_sections s ON s.id = t.section_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
       ${courseWhere}
         AND ${activeTaskWhere}
         AND (t.section_id IS NULL OR (${activeSectionWhere}))
         AND (t.lesson_id IS NULL OR (${activeLessonWhere}))
       ORDER BY att.task_id, att.sort_order, att.id`,
      values,
    ),
    queryRows<RubricRow>(
      `SELECT rb.id, rb.task_id, rb.title, rb.description, rb.max_score, rb.sort_order
       FROM learning_task_rubrics rb
       JOIN learning_tasks t ON t.id = rb.task_id
       JOIN courses c ON c.id = t.course_id
       LEFT JOIN course_sections s ON s.id = t.section_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
       ${courseWhere}
         AND ${activeTaskWhere}
         AND (t.section_id IS NULL OR (${activeSectionWhere}))
         AND (t.lesson_id IS NULL OR (${activeLessonWhere}))
       ORDER BY rb.task_id, rb.sort_order, rb.id`,
      values,
    ),
    queryRows<RuleRow>(
      `SELECT er.id, er.course_id, er.criterion, er.title, er.weight_percent,
              er.passing_score, er.is_required, er.status, er.sort_order
       FROM course_evaluation_rules er
       JOIN courses c ON c.id = er.course_id
       ${courseWhere}
         AND er.status <> 'archived'
       ORDER BY er.course_id, er.sort_order, er.id`,
      values,
    ),
  ]);

  return {
    courseRows,
    sectionRows,
    lessonRows,
    resourceRows,
    assessmentRows,
    questionCountRows,
    attemptCountRows,
    taskRows,
    attachmentRows,
    rubricRows,
    ruleRows,
  };
}

function buildManagementCourses(rows: Awaited<ReturnType<typeof loadBaseLearningRows>>) {
  const questionCounts = countsMap(rows.questionCountRows);
  const attemptCounts = countsMap(rows.attemptCountRows);
  const titlesByAssessmentId = new Map(rows.assessmentRows.map((row) => [Number(row.id), row.title]));
  const courseMap = groupById(
    rows.courseRows.map((row) => ({
      ...mapCourse(row),
      sections: [] as LearningSection[],
      lessons: [] as LearningLesson[],
      assessments: [] as LearningAssessmentOption[],
      tasks: [] as LearningTask[],
      rules: [] as CourseEvaluationRule[],
    })),
  );

  const lessonMap = groupById(rows.lessonRows.map(mapLesson));
  for (const row of rows.resourceRows) {
    lessonMap.get(Number(row.lesson_id))?.resources.push({
      id: Number(row.id),
      lessonId: Number(row.lesson_id),
      title: row.title,
      resourceType: row.resource_type,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileSize: row.file_size,
      status: row.status,
      sortOrder: Number(row.sort_order),
    });
  }

  for (const row of rows.sectionRows) {
    courseMap.get(Number(row.course_id))?.sections.push(mapSection(row));
  }

  for (const lesson of lessonMap.values()) {
    courseMap.get(lesson.courseId)?.lessons.push(lesson);
  }

  for (const row of rows.assessmentRows) {
    const assessment = mapAssessment(row, questionCounts, attemptCounts, titlesByAssessmentId);
    courseMap.get(assessment.courseId)?.assessments.push(assessment);
  }

  const taskMap = groupById(rows.taskRows.map(mapTask));
  for (const row of rows.attachmentRows) {
    taskMap.get(Number(row.task_id))?.attachments.push(mapAttachment(row));
  }
  for (const row of rows.rubricRows) {
    taskMap.get(Number(row.task_id))?.rubrics.push(mapRubric(row));
  }
  for (const task of taskMap.values()) {
    courseMap.get(task.courseId)?.tasks.push(task);
  }

  for (const row of rows.ruleRows) {
    const rule = mapRule(row);
    courseMap.get(rule.courseId)?.rules.push(rule);
  }

  return [...courseMap.values()];
}

export async function getLearningManagementData(
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<LearningManagementData> {
  const rows = await loadBaseLearningRows(undefined, user);
  return {
    courses: buildManagementCourses(rows),
  };
}

export async function getLearningPreviewLearners(
  slug: string,
  user?: Pick<CurrentUser, "id" | "role">,
): Promise<LearningPreviewLearner[]> {
  const courseScope = scopedCourseFilter(user, "c", "edit");
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      name: string;
      email: string;
      enrollment_id: number;
      enrollment_status: string;
      progress_percent: string | number;
      enrolled_at: string | null;
    }
  >(
    `SELECT u.id, u.name, u.email, e.id AS enrollment_id,
            e.status AS enrollment_status, e.progress_percent, e.enrolled_at
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     JOIN courses c ON c.id = e.course_id
     WHERE c.slug = ?
       AND c.deleted_at IS NULL
       AND c.status <> 'archived'
       ${courseScope.sql}
       AND u.role = 'student'
       AND u.status = 'active'
     ORDER BY FIELD(u.email, 'learner@spc.ac.th') DESC, e.enrolled_at DESC, u.name ASC`,
    [slug, ...courseScope.values],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    enrollmentId: Number(row.enrollment_id),
    enrollmentStatus: row.enrollment_status,
    progressPercent: toNumber(row.progress_percent),
    enrolledAt: row.enrolled_at,
  }));
}

export async function getLearnerCourseCards(email = "learner@spc.ac.th"): Promise<LearnerCourseCard[]> {
  const rows = await queryRows<
    RowDataPacket & {
      course_id: number;
      slug: string;
      title: string;
      cover_image_url: string | null;
      status: string;
      progress_percent: string | number;
      enrolled_at: string | null;
      task_count: number;
      pending_task_count: number;
      certificate_status: string | null;
      certificate_no: string | null;
    }
  >(
    `SELECT c.id AS course_id, c.slug, c.title, c.cover_image_url, e.status,
            e.progress_percent, e.enrolled_at,
            COUNT(DISTINCT t.id) AS task_count,
            COUNT(DISTINCT CASE WHEN sub.status IN ('submitted', 'pending_review', 'needs_revision') THEN sub.id END) AS pending_task_count,
            MAX(cert.status) AS certificate_status,
            MAX(cert.certificate_no) AS certificate_no
     FROM users u
     JOIN enrollments e ON e.user_id = u.id
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN learning_tasks t ON t.course_id = c.id AND t.status = 'published' AND t.deleted_at IS NULL
     LEFT JOIN learning_task_submissions sub ON sub.task_id = t.id AND sub.enrollment_id = e.id
     LEFT JOIN certificates cert ON cert.enrollment_id = e.id AND cert.status = 'issued'
     WHERE u.email = ? AND u.deleted_at IS NULL AND c.deleted_at IS NULL AND c.status <> 'archived'
     GROUP BY c.id, c.slug, c.title, c.cover_image_url, e.status, e.progress_percent, e.enrolled_at
     ORDER BY e.enrolled_at DESC, c.title ASC`,
    [email],
  );

  return rows.map((row) => ({
    courseId: Number(row.course_id),
    slug: row.slug,
    title: row.title,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    progressPercent: toNumber(row.progress_percent),
    enrolledAt: row.enrolled_at,
    taskCount: Number(row.task_count ?? 0),
    pendingTaskCount: Number(row.pending_task_count ?? 0),
    certificateStatus: row.certificate_status,
    certificateNo: row.certificate_no,
    certificateUrl: row.certificate_no ? `/certificates/${encodeURIComponent(row.certificate_no)}` : null,
  }));
}

export async function getLearnerClassroomData(
  slug: string,
  email = "learner@spc.ac.th",
): Promise<LearnerClassroomData | null> {
  const [userRows, enrollmentRows, baseRows] = await Promise.all([
    queryRows<RowDataPacket & { id: number; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
      [email],
    ),
    queryRows<
      RowDataPacket & {
        id: number;
        course_id: number;
        status: string;
        progress_percent: string | number;
        enrolled_at: string | null;
        completed_at: string | null;
      }
    >(
      `SELECT e.id, e.course_id, e.status, e.progress_percent, e.enrolled_at, e.completed_at
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       WHERE u.email = ? AND c.slug = ? AND c.deleted_at IS NULL AND c.status <> 'archived'
       LIMIT 1`,
      [email, slug],
    ),
    loadBaseLearningRows(slug),
  ]);

  const user = userRows[0];
  const courseRow = baseRows.courseRows[0];
  if (!user || !courseRow) return null;

  const enrollmentRow = enrollmentRows[0] ?? null;
  const enrollmentId = enrollmentRow ? Number(enrollmentRow.id) : null;

  const lessonProgressRows = enrollmentId
    ? await queryRows<
        RowDataPacket & {
          lesson_id: number;
          status: string;
          progress_percent: string | number;
        }
      >(
        `SELECT lesson_id, status, progress_percent
         FROM lesson_progress
         WHERE enrollment_id = ?`,
        [enrollmentId],
      )
    : [];
  const progressByLessonId = new Map(
    lessonProgressRows.map((row) => [
      Number(row.lesson_id),
      { status: row.status, progressPercent: toNumber(row.progress_percent) },
    ]),
  );

  const courses = buildManagementCourses(baseRows);
  const course = courses[0];
  if (!course) return null;

  for (const lesson of course.lessons) {
    const progress = progressByLessonId.get(lesson.id);
    lesson.progressStatus = progress?.status ?? null;
    lesson.progressPercent = progress?.progressPercent ?? 0;
  }

  const assessmentIds = course.assessments.map((assessment) => assessment.id);
  const sourceIds = course.assessments.map((assessment) => assessment.sharedQuestionSourceId ?? assessment.id);
  const uniqueSourceIds = [...new Set(sourceIds)];

  const [questionRows, optionRows, attemptRows, submissionRows, evidenceRows] = await Promise.all([
    uniqueSourceIds.length
      ? queryRows<QuestionRow>(
          `SELECT id, assessment_id, question_text, question_type, score, explanation, sort_order
           FROM questions
           WHERE assessment_id IN (${uniqueSourceIds.map(() => "?").join(",")})
             AND status = 'active'
           ORDER BY assessment_id, sort_order, id`,
          uniqueSourceIds,
        )
      : Promise.resolve([]),
    uniqueSourceIds.length
      ? queryRows<OptionRow>(
          `SELECT qo.id, qo.question_id, qo.option_text, qo.sort_order
           FROM question_options qo
           JOIN questions q ON q.id = qo.question_id
           WHERE q.assessment_id IN (${uniqueSourceIds.map(() => "?").join(",")})
             AND q.status = 'active'
           ORDER BY qo.question_id, qo.sort_order, qo.id`,
          uniqueSourceIds,
        )
      : Promise.resolve([]),
    enrollmentId && assessmentIds.length
      ? queryRows<AttemptRow>(
          `SELECT id, assessment_id, score, max_score, status, submitted_at
           FROM assessment_attempts
           WHERE enrollment_id = ?
             AND assessment_id IN (${assessmentIds.map(() => "?").join(",")})
           ORDER BY score DESC, submitted_at DESC, id DESC`,
          [enrollmentId, ...assessmentIds],
        )
      : Promise.resolve([]),
    enrollmentId
      ? queryRows<SubmissionRow>(
          `SELECT id, task_id, status, score, feedback, submitted_file_url,
                  submitted_file_name, submitted_link_url, answer_text, note,
                  submitted_at, graded_at
           FROM learning_task_submissions
           WHERE enrollment_id = ?
           ORDER BY submitted_at DESC, id DESC`,
          [enrollmentId],
        )
      : Promise.resolve([]),
    enrollmentId
      ? queryRows<EvidenceRow>(
          `SELECT id, submission_id, task_id, evidence_type, evidence_url,
                  evidence_text, file_name, sort_order
           FROM learning_task_evidences
           WHERE enrollment_id = ?
           ORDER BY task_id, sort_order, id`,
          [enrollmentId],
        )
      : Promise.resolve([]),
  ]);

  const optionsByQuestionId = new Map<number, LearnerAssessmentOption[]>();
  for (const row of optionRows) {
    const questionId = Number(row.question_id);
    const options = optionsByQuestionId.get(questionId) ?? [];
    options.push({
      id: Number(row.id),
      questionId,
      optionText: row.option_text,
      sortOrder: Number(row.sort_order),
    });
    optionsByQuestionId.set(questionId, options);
  }

  const questionsByAssessmentId = new Map<number, LearnerAssessmentQuestion[]>();
  for (const row of questionRows) {
    const assessmentId = Number(row.assessment_id);
    const questions = questionsByAssessmentId.get(assessmentId) ?? [];
    questions.push({
      id: Number(row.id),
      questionText: row.question_text,
      questionType: row.question_type,
      score: toNumber(row.score, 1),
      explanation: row.explanation,
      sortOrder: Number(row.sort_order),
      options: optionsByQuestionId.get(Number(row.id)) ?? [],
    });
    questionsByAssessmentId.set(assessmentId, questions);
  }

  const attemptsByAssessmentId = new Map<number, LearnerAssessmentAttempt[]>();
  for (const row of attemptRows) {
    const assessmentId = Number(row.assessment_id);
    const attempts = attemptsByAssessmentId.get(assessmentId) ?? [];
    attempts.push({
      id: Number(row.id),
      assessmentId,
      score: row.score === null ? null : toNumber(row.score),
      maxScore: row.max_score === null ? null : toNumber(row.max_score),
      status: row.status,
      submittedAt: row.submitted_at,
    });
    attemptsByAssessmentId.set(assessmentId, attempts);
  }

  for (const assessment of course.assessments) {
    const sourceId = assessment.sharedQuestionSourceId ?? assessment.id;
    const questions = questionsByAssessmentId.get(sourceId) ?? [];
    const preparedQuestions = shuffled(
      questions.map((question) => ({
        ...question,
        options: shuffled(question.options, assessment.randomizeOptions),
      })),
      assessment.randomizeQuestions,
    );
    assessment.questions =
      assessment.questionLimit && assessment.questionLimit > 0
        ? preparedQuestions.slice(0, assessment.questionLimit)
        : preparedQuestions;
    assessment.bestAttempt = attemptsByAssessmentId.get(assessment.id)?.[0] ?? null;
  }

  const evidencesBySubmissionId = new Map<number, LearnerTaskEvidence[]>();
  for (const row of evidenceRows) {
    if (!row.submission_id) continue;
    const submissionId = Number(row.submission_id);
    const evidences = evidencesBySubmissionId.get(submissionId) ?? [];
    evidences.push({
      id: Number(row.id),
      evidenceType: row.evidence_type,
      evidenceUrl: row.evidence_url,
      evidenceText: row.evidence_text,
      fileName: row.file_name,
      sortOrder: Number(row.sort_order),
    });
    evidencesBySubmissionId.set(submissionId, evidences);
  }

  const submissionByTaskId = new Map<number, LearnerTaskSubmission>();
  for (const row of submissionRows) {
    const submission = {
      id: Number(row.id),
      taskId: Number(row.task_id),
      status: row.status,
      score: row.score === null ? null : toNumber(row.score),
      feedback: row.feedback,
      submittedFileUrl: row.submitted_file_url,
      submittedFileName: row.submitted_file_name,
      submittedLinkUrl: row.submitted_link_url,
      answerText: row.answer_text,
      note: row.note,
      submittedAt: row.submitted_at,
      gradedAt: row.graded_at,
      evidences: evidencesBySubmissionId.get(Number(row.id)) ?? [],
    };
    if (!submissionByTaskId.has(submission.taskId)) {
      submissionByTaskId.set(submission.taskId, submission);
    }
  }

  for (const task of course.tasks) {
    task.submission = submissionByTaskId.get(task.id) ?? null;
  }

  const summary = computeLearnerSummary(course.lessons, course.assessments, course.tasks, course.rules);
  const mappedCourse = mapCourse(courseRow);

  return {
    user: {
      id: Number(user.id),
      name: user.name,
      email: user.email,
    },
    course: {
      ...mappedCourse,
      shortDescription: courseRow.short_description ?? null,
      description: courseRow.description ?? null,
      coverImageUrl: courseRow.cover_image_url ?? null,
    },
    enrollment: enrollmentRow
      ? {
          id: Number(enrollmentRow.id),
          status: enrollmentRow.status,
          progressPercent: toNumber(enrollmentRow.progress_percent),
          enrolledAt: enrollmentRow.enrolled_at,
          completedAt: enrollmentRow.completed_at,
        }
      : null,
    sections: course.sections,
    lessons: course.lessons,
    assessments: course.assessments,
    tasks: course.tasks,
    rules: course.rules,
    summary,
  };
}

function percentFromAttempt(attempt: LearnerAssessmentAttempt | null | undefined) {
  if (!attempt || attempt.score === null || !attempt.maxScore) return null;
  return Math.round((attempt.score / attempt.maxScore) * 1000) / 10;
}

function averageTaskPercent(tasks: LearningTask[], taskType: LearningTaskType) {
  const filtered = tasks.filter((task) => task.taskType === taskType && task.status === "published");
  if (!filtered.length) return 100;
  const total = filtered.reduce((sum, task) => sum + task.maxScore, 0);
  const earned = filtered.reduce((sum, task) => sum + Math.min(task.maxScore, task.submission?.score ?? 0), 0);
  return total > 0 ? (earned / total) * 100 : 0;
}

function computeLearnerSummary(
  lessons: LearningLesson[],
  assessments: LearningAssessmentOption[],
  tasks: LearningTask[],
  rules: CourseEvaluationRule[],
): LearnerClassroomSummary {
  const publishedLessons = lessons.filter((lesson) => lesson.status === "published");
  const completedLessons = publishedLessons.filter((lesson) => lesson.progressStatus === "completed").length;
  const lessonProgressPercent = publishedLessons.length
    ? Math.round((completedLessons / publishedLessons.length) * 100)
    : 100;
  const preTest = assessments.find((assessment) => assessment.type === "pre_test");
  const postTest = assessments.find((assessment) => assessment.type === "post_test");
  const preTestScore = percentFromAttempt(preTest?.bestAttempt);
  const postTestScore = percentFromAttempt(postTest?.bestAttempt);
  const improvementPercent =
    preTestScore !== null && postTestScore !== null
      ? Math.round((postTestScore - preTestScore) * 10) / 10
      : null;
  const publishedTasks = tasks.filter((task) => task.status === "published");
  const submittedTasks = publishedTasks.filter((task) => task.submission).length;
  const passedTasks = publishedTasks.filter((task) => {
    const submission = task.submission;
    if (!submission) return false;
    if (submission.status === "passed") return true;
    return submission.score !== null && submission.score >= task.passingScore;
  }).length;

  let totalWeight = 0;
  let weightedScore = 0;
  for (const rule of rules.filter((item) => item.status === "active")) {
    totalWeight += rule.weightPercent;
    let rawPercent = 0;
    if (rule.criterion === "lesson_progress") rawPercent = lessonProgressPercent;
    if (rule.criterion === "pre_test") rawPercent = preTestScore ?? 0;
    if (rule.criterion === "post_test") rawPercent = postTestScore ?? 0;
    if (rule.criterion === "worksheet") rawPercent = averageTaskPercent(tasks, "worksheet");
    if (rule.criterion === "practice") rawPercent = averageTaskPercent(tasks, "practice");
    weightedScore += (rawPercent * rule.weightPercent) / 100;
  }

  const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
  const requiredRulesMet = rules
    .filter((item) => item.status === "active" && item.isRequired)
    .every((rule) => {
      if (rule.criterion === "lesson_progress") return lessonProgressPercent >= rule.passingScore;
      if (rule.criterion === "pre_test") return true;
      if (rule.criterion === "post_test") return (postTestScore ?? 0) >= rule.passingScore;
      if (rule.criterion === "worksheet") return averageTaskPercent(tasks, "worksheet") >= rule.passingScore;
      if (rule.criterion === "practice") return averageTaskPercent(tasks, "practice") >= rule.passingScore;
      return true;
    });

  return {
    lessonProgressPercent,
    completedLessons,
    totalLessons: publishedLessons.length,
    preTestScore,
    postTestScore,
    improvementPercent,
    submittedTasks,
    passedTasks,
    totalTasks: publishedTasks.length,
    weightedScore: Math.round(normalizedScore * 10) / 10,
    totalWeight,
    readyForCertificate: requiredRulesMet && normalizedScore >= 70,
  };
}
