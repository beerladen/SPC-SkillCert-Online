import "server-only";

import { randomBytes } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, getPool, queryRows } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  certificateDocumentTypeLabel,
  getCertificateCandidates,
  getEligibleCertificateCandidatesForCourse,
  issueCertificate,
  type CertificateDocumentType,
} from "@/lib/certificate-repositories";
import {
  getCertificateSignerSetting,
  getCertificateSignerSettings,
  type CertificateSignerSettings,
} from "@/lib/certificate-signer-settings";

export type CertificateApprovalStatus =
  | "pending_academic"
  | "academic_returned"
  | "pending_registrar"
  | "registrar_returned"
  | "pending_director"
  | "director_returned"
  | "approved"
  | "issued"
  | "cancelled";

export type CertificateApprovalStepKey = "academic" | "registrar" | "director";
export type CertificateApprovalStepStatus = "waiting" | "pending" | "approved" | "returned";

export interface CertificateApprovalCourseOption {
  courseId: number;
  courseTitle: string;
  durationMinutes: number;
  instructorName: string | null;
  eligibleCount: number;
  sampleLearners: string[];
  documentType: CertificateDocumentType;
}

export interface CertificateApprovalReportRow {
  id: number;
  reportNo: string;
  courseId: number;
  courseTitle: string;
  durationMinutes: number;
  ownerName: string | null;
  criteriaSummary: string;
  totalLearners: number;
  documentType: CertificateDocumentType;
  status: CertificateApprovalStatus;
  verificationToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateApprovalItemRow {
  id: number;
  enrollmentId: number;
  learnerName: string;
  learnerEmail: string | null;
  registrationNo: string | null;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  postTestScore: number | null;
  passedTasks: number;
  totalTasks: number;
  evaluationStatus: string;
  certificateNo: string | null;
  sortOrder: number;
}

export interface CertificateApprovalStepRow {
  id: number;
  stepKey: CertificateApprovalStepKey;
  roleLabel: string;
  status: CertificateApprovalStepStatus;
  token: string;
  actedName: string | null;
  signerName: string | null;
  signerPosition: string | null;
  signatureUrl: string | null;
  actedAt: string | null;
  note: string | null;
  sortOrder: number;
}

export interface CertificateApprovalReportDetail {
  report: CertificateApprovalReportRow;
  items: CertificateApprovalItemRow[];
  steps: CertificateApprovalStepRow[];
}

export interface CertificateApprovalTokenView extends CertificateApprovalReportDetail {
  tokenKind: "report" | "step";
  currentStep: CertificateApprovalStepRow | null;
}

export interface LearnerCertificateApprovalStatusRow {
  reportNo: string;
  courseTitle: string;
  status: CertificateApprovalStatus;
  certificateNo: string | null;
  createdAt: string;
}

const activeReportStatuses: CertificateApprovalStatus[] = [
  "pending_academic",
  "pending_registrar",
  "pending_director",
  "approved",
];

const stepDefinitions: Array<{
  key: CertificateApprovalStepKey;
  roleLabel: string;
  sortOrder: number;
  initialStatus: CertificateApprovalStepStatus;
}> = [
  {
    key: "academic",
    roleLabel: "รองผู้อำนวยการฝ่ายวิชาการ",
    sortOrder: 1,
    initialStatus: "pending",
  },
  {
    key: "registrar",
    roleLabel: "นายทะเบียน",
    sortOrder: 2,
    initialStatus: "waiting",
  },
  {
    key: "director",
    roleLabel: "ผู้อำนวยการ",
    sortOrder: 3,
    initialStatus: "waiting",
  },
];

function token() {
  return randomBytes(32).toString("base64url");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "-";
  if (minutes % 60 === 0) return `${minutes / 60} ชั่วโมง`;
  return `${Math.floor(minutes / 60)} ชั่วโมง ${minutes % 60} นาที`;
}

function criteriaSummary(input: {
  requiredProgressPercent: number;
  requiredPostTestScore: number;
  totalTasks: number;
}) {
  const parts = [
    `เรียนครบไม่น้อยกว่า ${input.requiredProgressPercent}%`,
    `คะแนนหลังเรียนไม่น้อยกว่า ${input.requiredPostTestScore}%`,
  ];

  if (input.totalTasks > 0) {
    parts.push("ใบงาน/แบบฝึกผ่านครบทุกชิ้น");
  }

  return parts.join(" / ");
}

function mapReport(row: RowDataPacket): CertificateApprovalReportRow {
  const documentType: CertificateDocumentType =
    row.document_type === "honor_certificate" ? "honor_certificate" : "certificate";

  return {
    id: Number(row.id),
    reportNo: row.report_no,
    courseId: Number(row.course_id),
    courseTitle: row.course_title,
    durationMinutes: Number(row.duration_minutes ?? 0),
    ownerName: row.owner_name,
    criteriaSummary: row.criteria_summary ?? "",
    totalLearners: Number(row.total_learners ?? 0),
    documentType,
    status: row.status,
    verificationToken: row.verification_token,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

function mapItem(row: RowDataPacket): CertificateApprovalItemRow {
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    registrationNo: row.registration_no,
    progressPercent: toNumber(row.progress_percent),
    completedLessons: Number(row.completed_lessons ?? 0),
    totalLessons: Number(row.total_lessons ?? 0),
    postTestScore: row.post_test_score === null ? null : toNumber(row.post_test_score),
    passedTasks: Number(row.passed_tasks ?? 0),
    totalTasks: Number(row.total_tasks ?? 0),
    evaluationStatus: row.evaluation_status,
    certificateNo: row.certificate_no,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapStep(
  row: RowDataPacket,
  signerSettings?: CertificateSignerSettings,
): CertificateApprovalStepRow {
  const stepKey = row.step_key as CertificateApprovalStepKey;
  const fallbackSigner = signerSettings ? getCertificateSignerSetting(signerSettings, stepKey) : null;

  return {
    id: Number(row.id),
    stepKey,
    roleLabel: row.role_label,
    status: row.status,
    token: row.token,
    actedName: row.acted_name,
    signerName: row.signer_name || fallbackSigner?.name || null,
    signerPosition: row.signer_position || fallbackSigner?.position || row.role_label,
    signatureUrl: row.signature_url || fallbackSigner?.signatureUrl || null,
    actedAt: row.acted_at ? formatDateTime(row.acted_at) : null,
    note: row.note,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

async function nextReportNo(connection: PoolConnection) {
  const year = new Date().getFullYear() + 543;
  const [rows] = await connection.execute<Array<RowDataPacket & { total: number }>>(
    "SELECT COUNT(*) AS total FROM certificate_approval_reports WHERE report_no LIKE ?",
    [`SPC-CERT-REQ-${year}-%`],
  );
  return `SPC-CERT-REQ-${year}-${String(Number(rows[0]?.total ?? 0) + 1).padStart(4, "0")}`;
}

export function certificateApprovalStatusLabel(status: CertificateApprovalStatus) {
  const labels: Record<CertificateApprovalStatus, string> = {
    pending_academic: "รอรองฝ่ายวิชาการเห็นชอบ",
    academic_returned: "รองฝ่ายวิชาการส่งกลับแก้ไข",
    pending_registrar: "รอนายทะเบียนตรวจสอบ",
    registrar_returned: "นายทะเบียนส่งกลับแก้ไข",
    pending_director: "รอผู้อำนวยการอนุมัติ",
    director_returned: "ผู้อำนวยการส่งกลับแก้ไข",
    approved: "อนุมัติครบแล้ว",
    issued: "ออกใบประกาศแล้ว",
    cancelled: "ยกเลิก",
  };
  return labels[status] ?? status;
}

export function certificateApprovalStepStatusLabel(status: CertificateApprovalStepStatus) {
  const labels: Record<CertificateApprovalStepStatus, string> = {
    waiting: "รอลำดับ",
    pending: "รอดำเนินการ",
    approved: "ผ่าน",
    returned: "ส่งกลับแก้ไข",
  };
  return labels[status] ?? status;
}

export function formatCertificateReportDuration(minutes: number) {
  return formatMinutes(minutes);
}

export async function getCertificateApprovalCourseOptions(): Promise<
  CertificateApprovalCourseOption[]
> {
  const [candidates, activeReports] = await Promise.all([
    getCertificateCandidates(),
    queryRows<RowDataPacket & { course_id: number }>(
      `SELECT DISTINCT course_id
       FROM certificate_approval_reports
       WHERE status IN (${activeReportStatuses.map(() => "?").join(",")})`,
      activeReportStatuses,
    ).catch(() => []),
  ]);

  const activeCourseIds = new Set(activeReports.map((row) => Number(row.course_id)));
  const grouped = new Map<number, CertificateApprovalCourseOption>();

  for (const candidate of candidates) {
    if (
      !candidate.eligible ||
      candidate.documentType !== "certificate" ||
      activeCourseIds.has(candidate.courseId)
    ) {
      continue;
    }

    const current = grouped.get(candidate.courseId);
    if (current) {
      current.eligibleCount += 1;
      if (current.sampleLearners.length < 3) current.sampleLearners.push(candidate.learnerName);
      continue;
    }

    grouped.set(candidate.courseId, {
      courseId: candidate.courseId,
      courseTitle: candidate.courseTitle,
      durationMinutes: candidate.durationMinutes,
      instructorName: candidate.instructorName,
      eligibleCount: 1,
      sampleLearners: [candidate.learnerName],
      documentType: candidate.documentType,
    });
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.courseTitle.localeCompare(b.courseTitle, "th"),
  );
}

export async function getCertificateApprovalReports(): Promise<CertificateApprovalReportRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT id, report_no, course_id, course_title, duration_minutes, owner_name,
            criteria_summary, total_learners, document_type, status, verification_token, created_at, updated_at
     FROM certificate_approval_reports
     ORDER BY created_at DESC, id DESC`,
  ).catch(() => []);

  return rows.map(mapReport);
}

export async function getLearnerCertificateApprovalStatuses(
  userId: number,
): Promise<LearnerCertificateApprovalStatusRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT r.report_no, r.course_title, r.status, r.created_at, i.certificate_no
     FROM certificate_approval_items i
     JOIN certificate_approval_reports r ON r.id = i.report_id
     JOIN enrollments e ON e.id = i.enrollment_id
     WHERE e.user_id = ?
       AND r.status <> 'cancelled'
     ORDER BY r.created_at DESC, r.id DESC`,
    [userId],
  ).catch(() => []);

  return rows.map((row) => ({
    reportNo: row.report_no,
    courseTitle: row.course_title,
    status: row.status,
    certificateNo: row.certificate_no,
    createdAt: formatDateTime(row.created_at),
  }));
}

export async function getCertificateApprovalReportDetail(
  reportId: number,
): Promise<CertificateApprovalReportDetail | null> {
  const reportRows = await queryRows<RowDataPacket>(
    `SELECT id, report_no, course_id, course_title, duration_minutes, owner_name,
            criteria_summary, total_learners, document_type, status, verification_token, created_at, updated_at
     FROM certificate_approval_reports
     WHERE id = ?
     LIMIT 1`,
    [reportId],
  );

  const report = reportRows[0] ? mapReport(reportRows[0]) : null;
  if (!report) return null;

  const [itemRows, stepRows, signerSettings] = await Promise.all([
    queryRows<RowDataPacket>(
      `SELECT id, enrollment_id, learner_name, learner_email, registration_no,
              progress_percent, completed_lessons, total_lessons, post_test_score,
              passed_tasks, total_tasks, evaluation_status, certificate_no, sort_order
       FROM certificate_approval_items
       WHERE report_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [reportId],
    ),
    queryRows<RowDataPacket>(
      `SELECT id, step_key, role_label, status, token, acted_name,
              signer_name, signer_position, signature_url, acted_at, note, sort_order
       FROM certificate_approval_steps
       WHERE report_id = ?
       ORDER BY sort_order ASC`,
      [reportId],
    ),
    getCertificateSignerSettings(),
  ]);

  return {
    report,
    items: itemRows.map(mapItem),
    steps: stepRows.map((row) => mapStep(row, signerSettings)),
  };
}

export async function createCertificateApprovalReport(input: {
  courseId: number;
  createdBy: number;
}) {
  const allCandidates = await getEligibleCertificateCandidatesForCourse(input.courseId);
  const candidates = allCandidates.filter((candidate) => candidate.documentType === "certificate");
  if (candidates.length === 0) {
    const honorCandidates = allCandidates.filter(
      (candidate) => candidate.documentType === "honor_certificate",
    );
    if (honorCandidates.length > 0) {
      throw new Error(
        `หลักสูตรนี้ตั้งค่าเป็น${certificateDocumentTypeLabel("honor_certificate")} จึงไม่ต้องสร้างรายงานเสนออนุมัติใบประกาศนียบัตร`,
      );
    }
    throw new Error("ยังไม่มีผู้ผ่านเกณฑ์ที่พร้อมสร้างรายงานเสนออนุมัติในหลักสูตรนี้");
  }

  const signerSettings = await getCertificateSignerSettings();
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [activeRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id
       FROM certificate_approval_reports
       WHERE course_id = ?
         AND status IN (${activeReportStatuses.map(() => "?").join(",")})
       LIMIT 1`,
      [input.courseId, ...activeReportStatuses],
    );

    if (activeRows.length > 0) {
      throw new Error("หลักสูตรนี้มีรายงานเสนออนุมัติที่กำลังดำเนินการอยู่แล้ว");
    }

    const first = candidates[0];
    const reportNo = await nextReportNo(connection);
    const [reportResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO certificate_approval_reports
         (report_no, course_id, document_type, course_title, duration_minutes,
          owner_name, criteria_summary, total_learners, status, verification_token, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_academic', ?, ?)`,
      [
        reportNo,
        input.courseId,
        first.documentType,
        first.courseTitle,
        first.durationMinutes,
        first.instructorName,
        criteriaSummary({
          requiredProgressPercent: first.requiredProgressPercent,
          requiredPostTestScore: first.requiredPostTestScore,
          totalTasks: first.totalTasks,
        }),
        candidates.length,
        token(),
        input.createdBy,
      ],
    );

    const reportId = reportResult.insertId;
    for (const [index, candidate] of candidates.entries()) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO certificate_approval_items
           (report_id, enrollment_id, learner_name, learner_email, registration_no,
            progress_percent, completed_lessons, total_lessons, post_test_score,
            passed_tasks, total_tasks, evaluation_status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'passed', ?)`,
        [
          reportId,
          candidate.enrollmentId,
          candidate.learnerName,
          candidate.learnerEmail,
          candidate.registrationNo,
          candidate.progressPercent,
          candidate.completedLessons,
          candidate.totalLessons,
          candidate.postTestScore,
          candidate.passedTasks,
          candidate.totalTasks,
          index + 1,
        ],
      );
    }

    for (const step of stepDefinitions) {
      const signer = getCertificateSignerSetting(signerSettings, step.key);
      await connection.execute<ResultSetHeader>(
        `INSERT INTO certificate_approval_steps
           (report_id, step_key, role_label, status, token,
            signer_name, signer_position, signature_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          step.key,
          step.roleLabel,
          step.initialStatus,
          token(),
          signer.name || null,
          signer.position,
          signer.signatureUrl,
          step.sortOrder,
        ],
      );
    }

    await connection.commit();
    return reportId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCertificateApprovalTokenView(
  tokenValue: string,
): Promise<CertificateApprovalTokenView | null> {
  const stepRows = await queryRows<RowDataPacket & { report_id: number }>(
    "SELECT report_id FROM certificate_approval_steps WHERE token = ? LIMIT 1",
    [tokenValue],
  );

  if (stepRows[0]) {
    const detail = await getCertificateApprovalReportDetail(Number(stepRows[0].report_id));
    if (!detail) return null;
    return {
      ...detail,
      tokenKind: "step",
      currentStep: detail.steps.find((step) => step.token === tokenValue) ?? null,
    };
  }

  const reportRows = await queryRows<RowDataPacket & { id: number }>(
    "SELECT id FROM certificate_approval_reports WHERE verification_token = ? LIMIT 1",
    [tokenValue],
  );

  if (!reportRows[0]) return null;
  const detail = await getCertificateApprovalReportDetail(Number(reportRows[0].id));
  if (!detail) return null;
  return {
    ...detail,
    tokenKind: "report",
    currentStep: detail.steps.find((step) => step.status === "pending") ?? null,
  };
}

function returnedStatusForStep(stepKey: CertificateApprovalStepKey): CertificateApprovalStatus {
  if (stepKey === "academic") return "academic_returned";
  if (stepKey === "registrar") return "registrar_returned";
  return "director_returned";
}

function nextStatusForApprovedStep(
  stepKey: CertificateApprovalStepKey,
): CertificateApprovalStatus {
  if (stepKey === "academic") return "pending_registrar";
  if (stepKey === "registrar") return "pending_director";
  return "approved";
}

function nextStepForApprovedStep(stepKey: CertificateApprovalStepKey) {
  if (stepKey === "academic") return "registrar";
  if (stepKey === "registrar") return "director";
  return null;
}

async function issueCertificatesForApprovedReport(reportId: number) {
  const detail = await getCertificateApprovalReportDetail(reportId);
  if (!detail || detail.report.status !== "approved") return;

  for (const item of detail.items) {
    if (item.certificateNo) continue;

    const existingRows = await queryRows<
      RowDataPacket & { id: number; certificate_no: string }
    >(
      `SELECT id, certificate_no
       FROM certificates
       WHERE enrollment_id = ? AND status = 'issued'
       ORDER BY issued_at DESC, id DESC
       LIMIT 1`,
      [item.enrollmentId],
    );
    const existingCertificate = existingRows[0];
    const certificateNo = existingCertificate?.certificate_no ?? (await issueCertificate(item.enrollmentId));

    const rows = existingCertificate
      ? existingRows
      : await queryRows<RowDataPacket & { id: number }>(
          "SELECT id FROM certificates WHERE certificate_no = ? LIMIT 1",
          [certificateNo],
        );

    await executeQuery<ResultSetHeader>(
      `UPDATE certificate_approval_items
       SET certificate_id = ?, certificate_no = ?
       WHERE id = ?`,
      [rows[0]?.id ?? null, certificateNo, item.id],
    );
  }

  await executeQuery<ResultSetHeader>(
    "UPDATE certificate_approval_reports SET status = 'issued' WHERE id = ?",
    [reportId],
  );
}

export async function actOnCertificateApprovalStep(input: {
  token: string;
  decision: "approve" | "return";
  actorName: string;
  note?: string;
}) {
  const signerSettings = await getCertificateSignerSettings();
  const connection = await getPool().getConnection();
  let approvedDirectorReportId: number | null = null;

  try {
    await connection.beginTransaction();

    const [stepRows] = await connection.execute<
      Array<
        RowDataPacket & {
          id: number;
          report_id: number;
          step_key: CertificateApprovalStepKey;
          status: CertificateApprovalStepStatus;
        }
      >
    >(
      `SELECT id, report_id, step_key, status
       FROM certificate_approval_steps
       WHERE token = ?
       LIMIT 1
       FOR UPDATE`,
      [input.token],
    );

    const step = stepRows[0];
    if (!step) throw new Error("ไม่พบลิงก์อนุมัติ หรือ token ไม่ถูกต้อง");
    if (step.status !== "pending") {
      throw new Error("ขั้นตอนนี้ยังไม่เปิดให้ดำเนินการ หรือเคยดำเนินการแล้ว");
    }

    const status: CertificateApprovalStepStatus =
      input.decision === "approve" ? "approved" : "returned";
    const configuredSigner = getCertificateSignerSetting(signerSettings, step.step_key);
    const actedName = input.actorName.trim() || configuredSigner.name || configuredSigner.position;
    const signedName = input.decision === "approve" ? configuredSigner.name || actedName : null;
    const signedPosition = input.decision === "approve" ? configuredSigner.position : null;
    const signedSignatureUrl = input.decision === "approve" ? configuredSigner.signatureUrl : null;

    await connection.execute<ResultSetHeader>(
      `UPDATE certificate_approval_steps
       SET status = ?, acted_name = ?, signer_name = ?, signer_position = ?,
           signature_url = ?, acted_at = NOW(), note = ?
       WHERE id = ?`,
      [
        status,
        actedName || null,
        signedName,
        signedPosition,
        signedSignatureUrl,
        input.note?.trim() || null,
        step.id,
      ],
    );

    if (input.decision === "return") {
      await connection.execute<ResultSetHeader>(
        "UPDATE certificate_approval_reports SET status = ? WHERE id = ?",
        [returnedStatusForStep(step.step_key), step.report_id],
      );
    } else {
      const nextStep = nextStepForApprovedStep(step.step_key);
      await connection.execute<ResultSetHeader>(
        "UPDATE certificate_approval_reports SET status = ? WHERE id = ?",
        [nextStatusForApprovedStep(step.step_key), step.report_id],
      );
      if (nextStep) {
        await connection.execute<ResultSetHeader>(
          "UPDATE certificate_approval_steps SET status = 'pending' WHERE report_id = ? AND step_key = ?",
          [step.report_id, nextStep],
        );
      } else {
        approvedDirectorReportId = Number(step.report_id);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (approvedDirectorReportId !== null) {
    await issueCertificatesForApprovedReport(approvedDirectorReportId);
  }
}
