import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { headers } from "next/headers";
import {
  normalizeCertificateLayoutConfig,
  serializeCertificateLayoutConfig,
  type CertificateTemplateLayoutConfig,
} from "@/lib/certificate-layout";
import { executeQuery, queryRows } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getCertificateSignerSettings } from "@/lib/certificate-signer-settings";

export type CertificateDocumentType = "certificate" | "honor_certificate";

export interface AdminCertificateRow {
  id: number;
  certificateNo: string;
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  status: string;
  issuedAt: string;
  pdfUrl: string | null;
}

export interface CertificateCandidateRow {
  enrollmentId: number;
  courseId: number;
  courseSlug: string;
  learnerName: string;
  learnerEmail: string;
  registrationNo: string | null;
  courseTitle: string;
  durationMinutes: number;
  instructorName: string | null;
  progressPercent: number;
  status: string;
  eligible: boolean;
  eligibilityText: string;
  reasons: string[];
  completedLessons: number;
  totalLessons: number;
  passedTasks: number;
  totalTasks: number;
  postTestScore: number | null;
  postTestTotal: number;
  requiredProgressPercent: number;
  requiredPostTestScore: number;
  documentType: CertificateDocumentType;
}

interface CertificateEligibilityDbRow extends RowDataPacket {
  enrollment_id: number;
  course_id: number;
  course_slug: string;
  learner_name: string;
  learner_email: string;
  registration_no: string | null;
  course_title: string;
  duration_minutes: number;
  instructor_name: string | null;
  progress_percent: string | number;
  status: string;
  required_progress_percent: string | number;
  required_post_test_score: string | number;
  require_all_assignments: 0 | 1;
  certificate_enabled: 0 | 1;
  certificate_document_type: CertificateDocumentType | null;
  issued_certificate_id: number | null;
  total_lessons: number;
  completed_lessons: number;
  total_tasks: number;
  passed_tasks: number;
  post_test_total: number;
  post_test_score: string | number | null;
}

export interface LearnerCertificateRow {
  certificateNo: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  status: string;
  pdfUrl: string | null;
  documentType: CertificateDocumentType;
}

export interface PublicCertificateSearchRow {
  certificateNo: string;
  learnerName: string;
  learnerEmail: string;
  learnerPhone: string;
  courseTitle: string;
  issuedAt: string;
  status: string;
  pdfUrl: string | null;
  documentType: CertificateDocumentType;
}

export interface CertificateTemplateSettings {
  id: number | null;
  name: string;
  backgroundUrl: string | null;
  signatureUrl: string | null;
  issuerName: string;
  signerName: string;
  signerPosition: string;
  layoutConfig: CertificateTemplateLayoutConfig;
  status: "draft" | "active" | "archived";
  isDefault: boolean;
}

export interface SaveCertificateTemplateInput {
  id?: number | null;
  name: string;
  backgroundUrl?: string | null;
  signatureUrl?: string | null;
  issuerName: string;
  signerName?: string | null;
  signerPosition: string;
  layoutConfigJson?: string | null;
  status?: "draft" | "active" | "archived";
  userId: number;
}

function certificateDisplayUrl(certificateNo: string) {
  return `/certificates/${encodeURIComponent(certificateNo)}`;
}

function mapTemplate(row: RowDataPacket | null | undefined): CertificateTemplateSettings {
  return {
    id: row?.id ? Number(row.id) : null,
    name: row?.name || "เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย",
    backgroundUrl: row?.background_url || "/uploads/certificates/templates/spc-director-certificate-template.jpg",
    signatureUrl: row?.signature_url || null,
    issuerName: row?.issuer_name || "วิทยาลัยสารพัดช่างสุรินทร์",
    signerName: row?.signer_name || "",
    signerPosition: row?.signer_position || "ผู้อำนวยการวิทยาลัย",
    layoutConfig: normalizeCertificateLayoutConfig(row?.layout_config_json),
    status: row?.status || "active",
    isDefault: Boolean(row?.is_default ?? true),
  };
}

export async function getDefaultCertificateTemplate(): Promise<CertificateTemplateSettings> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT id, name, background_url, signature_url, issuer_name, signer_name,
            signer_position, layout_config_json, status, is_default
     FROM certificate_templates
     WHERE status <> 'archived'
     ORDER BY is_default DESC, FIELD(status, 'active', 'draft'), id DESC
     LIMIT 1`,
  ).catch(() => []);

  return mapTemplate(rows[0]);
}

export async function saveDefaultCertificateTemplate(input: SaveCertificateTemplateInput) {
  const status = input.status ?? "active";
  const templateName = input.name || "เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย";
  const layoutConfigJson = serializeCertificateLayoutConfig(input.layoutConfigJson);

  await executeQuery<ResultSetHeader>("UPDATE certificate_templates SET is_default = FALSE WHERE is_default = TRUE");

  if (input.id) {
    await executeQuery<ResultSetHeader>(
      `UPDATE certificate_templates
       SET name = ?, background_url = ?, signature_url = ?, issuer_name = ?,
           signer_name = ?, signer_position = ?, layout_config_json = ?, status = ?, is_default = TRUE
       WHERE id = ?`,
      [
        templateName,
        input.backgroundUrl || null,
        input.signatureUrl || null,
        input.issuerName,
        input.signerName || null,
        input.signerPosition,
        layoutConfigJson,
        status,
        input.id,
      ],
    );
    return;
  }

  await executeQuery<ResultSetHeader>(
    `INSERT INTO certificate_templates
       (name, background_url, signature_url, issuer_name, signer_name, signer_position,
        layout_config_json, status, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE
       background_url = VALUES(background_url),
       signature_url = VALUES(signature_url),
       issuer_name = VALUES(issuer_name),
       signer_name = VALUES(signer_name),
       signer_position = VALUES(signer_position),
       layout_config_json = VALUES(layout_config_json),
       status = VALUES(status),
       is_default = TRUE`,
    [
      templateName,
      input.backgroundUrl || null,
      input.signatureUrl || null,
      input.issuerName,
      input.signerName || null,
      input.signerPosition,
      layoutConfigJson,
      status,
    ],
  );
}

export async function getAdminCertificateRows(): Promise<AdminCertificateRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT cert.id, cert.certificate_no, cert.learner_name, cert.course_title,
            cert.status, cert.issued_at, cert.pdf_url, u.email AS learner_email
     FROM certificates cert
     JOIN enrollments e ON e.id = cert.enrollment_id
     JOIN users u ON u.id = e.user_id
     ORDER BY cert.issued_at DESC, cert.id DESC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    certificateNo: row.certificate_no,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    courseTitle: row.course_title,
    status: row.status,
    issuedAt: formatDateTime(row.issued_at),
    pdfUrl: certificateDisplayUrl(row.certificate_no),
  }));
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDocumentType(value: unknown): CertificateDocumentType {
  return value === "certificate" ? "certificate" : "honor_certificate";
}

export function certificateDocumentTypeLabel(documentType: CertificateDocumentType) {
  return documentType === "certificate" ? "ใบประกาศนียบัตร" : "เกียรติบัตร";
}

function mapCertificateEligibility(row: CertificateEligibilityDbRow): CertificateCandidateRow {
  const progressPercent = toNumber(row.progress_percent);
  const requiredProgressPercent = toNumber(row.required_progress_percent, 80);
  const requiredPostTestScore = toNumber(row.required_post_test_score, 70);
  const totalLessons = Number(row.total_lessons ?? 0);
  const completedLessons = Number(row.completed_lessons ?? 0);
  const totalTasks = Number(row.total_tasks ?? 0);
  const passedTasks = Number(row.passed_tasks ?? 0);
  const postTestTotal = Number(row.post_test_total ?? 0);
  const postTestScore = row.post_test_score === null ? null : toNumber(row.post_test_score);
  const documentType = normalizeDocumentType(row.certificate_document_type);
  const reasons: string[] = [];

  if (!Boolean(row.certificate_enabled)) reasons.push("หลักสูตรยังไม่เปิดออกใบประกาศ");
  if (row.issued_certificate_id) reasons.push("ออกใบประกาศแล้ว");
  if (["cancelled", "expired"].includes(row.status)) reasons.push("สถานะผู้เข้าอบรมไม่พร้อม");
  if (progressPercent < requiredProgressPercent) {
    reasons.push(`ความคืบหน้ายังไม่ถึง ${requiredProgressPercent}%`);
  }
  if (totalLessons > 0 && completedLessons < totalLessons) {
    reasons.push(`เรียนออนไลน์ครบ ${completedLessons}/${totalLessons} บท`);
  }
  if (Boolean(row.require_all_assignments) && totalTasks > 0 && passedTasks < totalTasks) {
    reasons.push(`ใบงาน/แบบฝึกผ่าน ${passedTasks}/${totalTasks} งาน`);
  }
  if (postTestTotal > 0 && (postTestScore ?? 0) < requiredPostTestScore) {
    reasons.push(`คะแนนหลังเรียนยังไม่ถึง ${requiredPostTestScore}%`);
  }

  return {
    enrollmentId: Number(row.enrollment_id),
    courseId: Number(row.course_id),
    courseSlug: row.course_slug,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    registrationNo: row.registration_no,
    courseTitle: row.course_title,
    durationMinutes: Number(row.duration_minutes ?? 0),
    instructorName: row.instructor_name,
    progressPercent,
    status: row.status,
    eligible: reasons.length === 0,
    eligibilityText: reasons.length === 0 ? "พร้อมออกใบประกาศ" : reasons.join(" • "),
    reasons,
    completedLessons,
    totalLessons,
    passedTasks,
    totalTasks,
    postTestScore,
    postTestTotal,
    requiredProgressPercent,
    requiredPostTestScore,
    documentType,
  };
}

async function getCertificateEligibilityRows(whereSql = "", params: Array<string | number> = []) {
  return queryRows<CertificateEligibilityDbRow>(
    `SELECT
        e.id AS enrollment_id,
        e.course_id,
        c.slug AS course_slug,
        u.name AS learner_name,
        u.email AS learner_email,
        r.registration_no,
        c.title AS course_title,
        c.duration_minutes,
        i.display_name AS instructor_name,
        e.progress_percent,
        e.status,
        COALESCE(ccr.required_progress_percent, 80) AS required_progress_percent,
        COALESCE(ccr.required_post_test_score, 70) AS required_post_test_score,
        COALESCE(ccr.require_all_assignments, TRUE) AS require_all_assignments,
        COALESCE(ccr.certificate_enabled, TRUE) AS certificate_enabled,
        COALESCE(ccr.certificate_document_type, 'honor_certificate') AS certificate_document_type,
        cert.id AS issued_certificate_id,
        (
          SELECT COUNT(DISTINCT l.id)
          FROM course_sections s
          JOIN lessons l ON l.section_id = s.id
          WHERE s.course_id = e.course_id
            AND s.deleted_at IS NULL
            AND s.status <> 'archived'
            AND l.status = 'published'
            AND l.deleted_at IS NULL
        ) AS total_lessons,
        (
          SELECT COUNT(DISTINCT lp.lesson_id)
          FROM course_sections s
          JOIN lessons l ON l.section_id = s.id
          JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
          WHERE s.course_id = e.course_id
            AND s.deleted_at IS NULL
            AND s.status <> 'archived'
            AND l.status = 'published'
            AND l.deleted_at IS NULL
            AND lp.status = 'completed'
        ) AS completed_lessons,
        (
          SELECT COUNT(DISTINCT t.id)
          FROM learning_tasks t
          LEFT JOIN course_sections s ON s.id = t.section_id
          LEFT JOIN lessons l ON l.id = t.lesson_id
          WHERE t.course_id = e.course_id
            AND t.status = 'published'
            AND t.deleted_at IS NULL
            AND (t.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (t.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
        ) AS total_tasks,
        (
          SELECT COUNT(DISTINCT t.id)
          FROM learning_tasks t
          JOIN learning_task_submissions sub ON sub.task_id = t.id AND sub.enrollment_id = e.id
          LEFT JOIN course_sections s ON s.id = t.section_id
          LEFT JOIN lessons l ON l.id = t.lesson_id
          WHERE t.course_id = e.course_id
            AND t.status = 'published'
            AND t.deleted_at IS NULL
            AND (t.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (t.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
            AND sub.status IN ('passed', 'graded')
            AND COALESCE(sub.score, 0) >= t.passing_score
        ) AS passed_tasks,
        (
          SELECT COUNT(DISTINCT a.id)
          FROM assessments a
          LEFT JOIN course_sections s ON s.id = a.section_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE a.course_id = e.course_id
            AND a.type = 'post_test'
            AND a.status = 'published'
            AND a.deleted_at IS NULL
            AND a.counts_toward_completion = TRUE
            AND (a.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (a.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
        ) AS post_test_total,
        (
          SELECT MAX(CASE WHEN aa.max_score > 0 THEN (aa.score / aa.max_score) * 100 ELSE 0 END)
          FROM assessment_attempts aa
          JOIN assessments a ON a.id = aa.assessment_id
          LEFT JOIN course_sections s ON s.id = a.section_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE aa.enrollment_id = e.id
            AND a.course_id = e.course_id
            AND a.type = 'post_test'
            AND a.status = 'published'
            AND a.deleted_at IS NULL
            AND aa.status <> 'in_progress'
            AND (a.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (a.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
        ) AS post_test_score
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN courses c ON c.id = e.course_id
      JOIN instructors i ON i.id = c.instructor_id
      LEFT JOIN registration_items ri ON ri.id = e.registration_item_id
      LEFT JOIN registrations r ON r.id = ri.registration_id
      LEFT JOIN course_completion_rules ccr ON ccr.course_id = c.id
      LEFT JOIN certificates cert ON cert.enrollment_id = e.id AND cert.status = 'issued'
      WHERE c.deleted_at IS NULL
      ${whereSql}
      ORDER BY e.progress_percent DESC, e.enrolled_at DESC`,
    params,
  );
}

export async function getCertificateEligibility(enrollmentId: number): Promise<CertificateCandidateRow | null> {
  const rows = await getCertificateEligibilityRows("AND e.id = ?", [enrollmentId]);
  return rows[0] ? mapCertificateEligibility(rows[0]) : null;
}

export async function getCertificateCandidates(): Promise<CertificateCandidateRow[]> {
  const rows = await getCertificateEligibilityRows("AND cert.id IS NULL");
  return rows.map(mapCertificateEligibility);
}

export async function getEligibleCertificateCandidatesForCourse(
  courseId: number,
): Promise<CertificateCandidateRow[]> {
  const rows = await getCertificateEligibilityRows("AND e.course_id = ? AND cert.id IS NULL", [
    courseId,
  ]);
  return rows.map(mapCertificateEligibility).filter((candidate) => candidate.eligible);
}

export async function getLearnerCertificates(userId: number): Promise<LearnerCertificateRow[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT cert.certificate_no, cert.learner_name, cert.course_title,
            cert.issued_at, cert.status, cert.pdf_url, cert.document_type
     FROM certificates cert
     JOIN enrollments e ON e.id = cert.enrollment_id
     WHERE e.user_id = ?
     ORDER BY cert.issued_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    certificateNo: row.certificate_no,
    learnerName: row.learner_name,
    courseTitle: row.course_title,
    issuedAt: formatDateTime(row.issued_at),
    status: row.status,
    pdfUrl: certificateDisplayUrl(row.certificate_no),
    documentType: normalizeDocumentType(row.document_type),
  }));
}

async function nextCertificateNo() {
  const year = new Date().getFullYear() + 543;
  const rows = await queryRows<RowDataPacket & { total: number }>(
    "SELECT COUNT(*) AS total FROM certificates WHERE certificate_no LIKE ?",
    [`SPC-CERT-${year}-%`],
  );
  return `SPC-CERT-${year}-${String(Number(rows[0]?.total ?? 0) + 1).padStart(5, "0")}`;
}

export async function issueCertificate(enrollmentId: number) {
  const [eligibility, templateRows] = await Promise.all([
    getCertificateEligibility(enrollmentId),
    queryRows<RowDataPacket>(
      "SELECT id FROM certificate_templates WHERE status = 'active' ORDER BY is_default DESC, id LIMIT 1",
    ),
  ]);

  if (!eligibility) throw new Error("ไม่พบข้อมูลผู้เข้าอบรม");
  if (!eligibility.eligible) {
    throw new Error(`ยังไม่พร้อมออกใบประกาศ: ${eligibility.eligibilityText}`);
  }

  const certificateNo = await nextCertificateNo();
  await executeQuery<ResultSetHeader>(
    `INSERT INTO certificates
       (certificate_no, enrollment_id, template_id, document_type, learner_name, course_title, issued_at, status, pdf_url, qr_payload)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 'issued', ?, ?)`,
    [
      certificateNo,
      enrollmentId,
      templateRows[0]?.id ?? null,
      eligibility.documentType,
      eligibility.learnerName,
      eligibility.courseTitle,
      certificateDisplayUrl(certificateNo),
      certificateNo,
    ],
  );
  return certificateNo;
}

export async function revokeCertificate(certificateId: number, userId: number) {
  await executeQuery<ResultSetHeader>(
    `UPDATE certificates
     SET status = 'revoked', revoked_at = NOW(), revoked_by = ?
     WHERE id = ?`,
    [userId, certificateId],
  );
}

export async function searchCertificates(searchTerm: string): Promise<PublicCertificateSearchRow[]> {
  const keyword = searchTerm.trim();

  if (!keyword) {
    return [];
  }

  const normalizedPhone = keyword.replace(/[^\d]/g, "");
  const likeKeyword = `%${keyword}%`;
  const phoneKeyword = `%${normalizedPhone || keyword}%`;

  const rows = await queryRows<RowDataPacket>(
    `SELECT cert.certificate_no, cert.learner_name, cert.course_title,
            cert.issued_at, cert.status, cert.pdf_url,
            cert.document_type,
            u.email AS learner_email, COALESCE(p.phone, '') AS learner_phone
     FROM certificates cert
     JOIN enrollments e ON e.id = cert.enrollment_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE cert.certificate_no = ?
        OR cert.certificate_no LIKE ?
        OR cert.learner_name LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
        OR p.phone LIKE ?
        OR REPLACE(REPLACE(REPLACE(COALESCE(p.phone, ''), '-', ''), ' ', ''), '.', '') LIKE ?
     ORDER BY cert.issued_at DESC, cert.id DESC
     LIMIT 50`,
    [keyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, phoneKeyword],
  );

  return rows.map((row) => ({
    certificateNo: row.certificate_no,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email ?? "",
    learnerPhone: row.learner_phone ?? "",
    courseTitle: row.course_title,
    issuedAt: formatDateTime(row.issued_at),
    status: row.status,
    pdfUrl: certificateDisplayUrl(row.certificate_no),
    documentType: normalizeDocumentType(row.document_type),
  }));
}

export async function verifyCertificate(certificateNo: string) {
  const rows = await queryRows<RowDataPacket>(
    `SELECT cert.id, cert.certificate_no, cert.learner_name, cert.course_title,
            cert.issued_at, cert.status, cert.pdf_url, cert.document_type,
            tpl.background_url, tpl.signature_url, tpl.issuer_name, tpl.signer_name, tpl.signer_position,
            tpl.layout_config_json
     FROM certificates cert
     LEFT JOIN certificate_templates tpl ON tpl.id = cert.template_id
     WHERE cert.certificate_no = ?
     LIMIT 1`,
    [certificateNo],
  );

  const certificate = rows[0] ?? null;
  const headerStore = await headers();
  await executeQuery<ResultSetHeader>(
    `INSERT INTO certificate_verification_logs (certificate_id, certificate_no, ip_address, user_agent)
     VALUES (?, ?, ?, ?)`,
    [
      certificate?.id ?? null,
      certificateNo,
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      headerStore.get("user-agent")?.slice(0, 500) ?? null,
    ],
  ).catch(() => {});

  if (!certificate) return null;
  const signerSettings = await getCertificateSignerSettings().catch(() => null);
  const documentType = normalizeDocumentType(certificate.document_type);
  const director = signerSettings?.director;
  const registrar = signerSettings?.registrar;
  const directorName = director?.name || certificate.signer_name || "";
  const directorPosition =
    director?.position || certificate.signer_position || "ผู้อำนวยการวิทยาลัย";
  const directorSignatureUrl = director?.signatureUrl || certificate.signature_url || null;
  const registrarName = registrar?.name || "";
  const registrarPosition = registrar?.position || "นายทะเบียน";
  const registrarSignatureUrl = registrar?.signatureUrl || null;

  return {
    certificateNo: certificate.certificate_no,
    learnerName: certificate.learner_name,
    courseTitle: certificate.course_title,
    issuedAt: formatDateTime(certificate.issued_at),
    status: certificate.status,
    pdfUrl: certificateDisplayUrl(certificate.certificate_no),
    documentType,
    documentTypeLabel: certificateDocumentTypeLabel(documentType),
    backgroundUrl:
      certificate.background_url || "/uploads/certificates/templates/spc-director-certificate-template.jpg",
    layoutConfig: normalizeCertificateLayoutConfig(certificate.layout_config_json),
    signatureUrl: directorSignatureUrl,
    issuerName: certificate.issuer_name || "วิทยาลัยสารพัดช่างสุรินทร์",
    signerName: directorName,
    signerPosition: directorPosition,
    directorName,
    directorPosition,
    directorSignatureUrl,
    registrarName,
    registrarPosition,
    registrarSignatureUrl,
  };
}
