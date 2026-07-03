"use client";

import { type FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Ban,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import {
  createCertificateApprovalReportResultAction,
  issueCertificateAction,
  revokeCertificateAction,
} from "@/app/admin/certificates/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CertificateApprovalCourseOption,
  CertificateApprovalReportRow,
  CertificateApprovalStatus,
} from "@/lib/certificate-approval-repositories";
import type { AdminCertificateRow, CertificateCandidateRow } from "@/lib/certificate-repositories";
import { certificateStatusLabel } from "@/lib/certificate-status";

const approvalStatusLabels: Record<CertificateApprovalStatus, string> = {
  pending_academic: "รอรองฝ่ายวิชาการ",
  academic_returned: "รองฝ่ายวิชาการส่งกลับ",
  pending_registrar: "รอนายทะเบียน",
  registrar_returned: "นายทะเบียนส่งกลับ",
  pending_director: "รอผู้อำนวยการ",
  director_returned: "ผู้อำนวยการส่งกลับ",
  approved: "อนุมัติครบแล้ว",
  issued: "ออกใบประกาศแล้ว",
  cancelled: "ยกเลิก",
};

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
}

function formatMinutes(value: number) {
  if (value <= 0) return "-";
  if (value % 60 === 0) return `${value / 60} ชั่วโมง`;
  return `${Math.floor(value / 60)} ชั่วโมง ${value % 60} นาที`;
}

function approvalBadgeVariant(status: CertificateApprovalStatus): "default" | "secondary" | "destructive" {
  if (status === "issued" || status === "approved") return "default";
  if (status.endsWith("_returned") || status === "cancelled") return "destructive";
  return "secondary";
}

interface ReportNotice {
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  reportId?: number;
  href?: string;
}

export function AdminCertificatesWorkspace({
  rows,
  candidates,
  approvalReports,
  approvalCourseOptions,
}: {
  rows: AdminCertificateRow[];
  candidates: CertificateCandidateRow[];
  approvalReports: CertificateApprovalReportRow[];
  approvalCourseOptions: CertificateApprovalCourseOption[];
}) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState<ReportNotice | null>(null);
  const [isCreatingReport, startCreateReportTransition] = useTransition();
  const router = useRouter();
  const [revoking, setRevoking] = useState<AdminCertificateRow | null>(null);
  const readyCandidates = candidates.filter((candidate) => candidate.eligible);
  const blockedCandidates = candidates.filter((candidate) => !candidate.eligible);

  function openReportDialog() {
    if (approvalCourseOptions.length === 0) {
      setReportNotice({
        type: "warning",
        title: "ยังไม่มีหลักสูตรพร้อมสร้างรายงาน",
        message:
          "ต้องมีผู้เข้าอบรมที่เรียนครบ ผ่าน post-test ผ่านใบงาน/แบบฝึกครบ และยังไม่เคยออกใบประกาศ หรือหลักสูตรนั้นต้องไม่มีรายงานที่กำลังดำเนินการอยู่",
      });
      return;
    }
    setReportOpen(true);
  }

  function handleCreateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    startCreateReportTransition(async () => {
      const result = await createCertificateApprovalReportResultAction(formData);
      if (result.ok) {
        setReportOpen(false);
        setReportNotice({
          type: "success",
          title: result.title,
          message: result.message,
          reportId: result.reportId,
          href: result.href,
        });
        router.refresh();
        return;
      }

      setReportNotice({
        type: "error",
        title: result.title,
        message: result.message,
      });
    });
  }

  const reportColumns: Array<AdminDataTableColumn<CertificateApprovalReportRow>> = [
    {
      id: "report",
      header: "รายงาน",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{row.reportNo}</p>
          <p className="text-xs text-muted-foreground">{row.createdAt}</p>
        </div>
      ),
    },
    {
      id: "course",
      header: "หลักสูตร",
      render: (row) => (
        <div className="grid max-w-[520px] gap-1">
          <p className="font-semibold leading-6">{row.courseTitle}</p>
          <p className="text-xs text-muted-foreground">
            {row.ownerName ?? "-"} / {formatMinutes(row.durationMinutes)}
          </p>
        </div>
      ),
    },
    {
      id: "learners",
      header: "ผู้ผ่าน",
      className: "w-[110px]",
      render: (row) => <Badge variant="secondary">{row.totalLearners} คน</Badge>,
    },
    {
      id: "status",
      header: "สถานะ",
      className: "w-[190px]",
      render: (row) => (
        <Badge variant={approvalBadgeVariant(row.status)}>
          {approvalStatusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[170px] text-right",
      render: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/certificates/reports/${row.id}`}>
            <FileText className="size-4" />
            ดูรายงาน
          </Link>
        </Button>
      ),
    },
  ];

  const certificateColumns: Array<AdminDataTableColumn<AdminCertificateRow>> = [
    {
      id: "certificate",
      header: "ใบประกาศ",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{row.certificateNo}</p>
          <p className="text-sm text-muted-foreground">{row.issuedAt}</p>
        </div>
      ),
    },
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      render: (row) => (
        <div className="grid gap-1">
          <p>{row.learnerName}</p>
          <p className="text-xs text-muted-foreground">{row.learnerEmail}</p>
        </div>
      ),
    },
    {
      id: "course",
      header: "หลักสูตร",
      render: (row) => <p className="max-w-[360px] text-sm leading-6">{row.courseTitle}</p>,
    },
    {
      id: "status",
      header: "สถานะ",
      render: (row) => (
        <Badge variant={row.status === "issued" ? "default" : "secondary"}>
          {certificateStatusLabel(row.status)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[260px] text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={row.pdfUrl ?? `/certificates/${encodeURIComponent(row.certificateNo)}`} target="_blank">
              <Download className="size-4" />
              ดู/ดาวน์โหลด
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/verify-certificate?certificateNo=${encodeURIComponent(row.certificateNo)}`} target="_blank">
              ตรวจ
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setRevoking(row)} title="ยกเลิก">
            <Ban className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">รายงานเสนออนุมัติใบประกาศนียบัตร</h2>
          <p className="text-sm text-muted-foreground">
            สร้างบันทึกข้อความ A4 พร้อม QR และรายชื่อผู้ผ่านการอบรมตามหลักสูตร
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            พร้อมสร้างรายงาน {approvalCourseOptions.length} หลักสูตร
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openReportDialog}>
            <ClipboardCheck className="size-4" />
            สร้างรายงานเสนออนุมัติ
            {approvalCourseOptions.length > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                {approvalCourseOptions.length}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={() => setIssueOpen(true)}>
            <Plus className="size-4" />
            ออกใบประกาศรายบุคคล
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="min-w-0">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">รายงานเสนออนุมัติ</p>
            <p className="text-3xl font-bold">{approvalReports.length}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">ใบประกาศออกแล้ว</p>
            <p className="text-3xl font-bold">{rows.filter((row) => row.status === "issued").length}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">หลักสูตรพร้อมสร้างรายงาน</p>
            <p className="text-3xl font-bold">{approvalCourseOptions.length}</p>
          </CardContent>
        </Card>
      </div>

      {approvalCourseOptions.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <CircleAlert className="size-5" />
          <div>
            <p className="font-semibold">ยังไม่มีหลักสูตรที่พร้อมสร้างรายงานเสนออนุมัติ</p>
            <p className="text-amber-800">
              ต้องมีผู้เข้าอบรมที่เรียนครบ ผ่าน post-test ผ่านใบงาน/แบบฝึกครบ และยังไม่เคยออกใบประกาศ
            </p>
          </div>
        </div>
      )}

      <Card className="min-w-0">
        <CardContent className="min-w-0 p-5">
          <AdminDataTable
            rows={approvalReports}
            columns={reportColumns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) => `${row.reportNo} ${row.courseTitle} ${row.ownerName ?? ""}`}
            searchPlaceholder="ค้นหาเลขรายงาน หลักสูตร หรือเจ้าของหลักสูตร"
            emptyText="ยังไม่มีรายงานเสนออนุมัติ"
          />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="min-w-0 p-5">
          <div className="mb-4">
            <h2 className="font-semibold">ใบประกาศที่ออกแล้ว</h2>
            <p className="text-sm text-muted-foreground">รายการใบประกาศรายบุคคลที่สร้างแล้วในระบบ</p>
          </div>
          <AdminDataTable
            rows={rows}
            columns={certificateColumns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) => `${row.certificateNo} ${row.learnerName} ${row.learnerEmail} ${row.courseTitle}`}
            searchPlaceholder="ค้นหาเลขใบประกาศ ผู้เรียน หรือหลักสูตร"
            emptyText="ยังไม่มีใบประกาศที่ออกแล้ว"
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="สร้างรายงานเสนออนุมัติใบประกาศนียบัตร"
        description="เลือกหลักสูตรที่มีผู้ผ่านเกณฑ์ ระบบจะสร้างบันทึกข้อความ A4 พร้อมตารางรายชื่อและ QR สำหรับผู้อนุมัติ"
        size="lg"
      >
        <form onSubmit={handleCreateReport} className="grid gap-4">
          <select name="courseId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
            {approvalCourseOptions.map((course) => (
              <option key={course.courseId} value={course.courseId}>
                {course.courseTitle} / ผู้ผ่าน {course.eligibleCount} คน
              </option>
            ))}
          </select>
          {approvalCourseOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              ยังไม่มีหลักสูตรที่พร้อมสร้างรายงาน หรือหลักสูตรนั้นมีรายงานที่กำลังดำเนินการอยู่แล้ว
            </p>
          ) : (
            <div className="grid gap-2 rounded-lg border bg-secondary/20 p-3">
              {approvalCourseOptions.map((course) => (
                <div key={course.courseId} className="rounded-md bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{course.courseTitle}</p>
                    <Badge>{course.eligibleCount} คน</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {course.instructorName ?? "-"} / {formatMinutes(course.durationMinutes)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ตัวอย่างรายชื่อ: {course.sampleLearners.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Button type="submit" className="w-fit" disabled={approvalCourseOptions.length === 0 || isCreatingReport}>
            <ClipboardCheck className="size-4" />
            {isCreatingReport ? "กำลังสร้างรายงาน..." : "สร้างรายงาน"}
          </Button>
        </form>
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(reportNotice)}
        onOpenChange={(open) => !open && setReportNotice(null)}
        title={reportNotice?.title ?? ""}
        description={reportNotice?.message}
      >
        {reportNotice && (
          <div className="grid gap-4">
            <div
              className={
                reportNotice.type === "success"
                  ? "rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary"
                  : reportNotice.type === "warning"
                    ? "rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                    : "rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              }
            >
              {reportNotice.message}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setReportNotice(null)}>
                ปิด
              </Button>
              {reportNotice.href && (
                <Button asChild onClick={() => setReportNotice(null)}>
                  <Link href={reportNotice.href}>
                    <FileText className="size-4" />
                    เปิดรายงาน
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={issueOpen}
        onOpenChange={setIssueOpen}
        title="ออกใบประกาศนียบัตรรายบุคคล"
        description="ใช้สำหรับกรณีจำเป็นเฉพาะราย ส่วนหลักควรใช้รายงานเสนออนุมัติตามลำดับ"
        size="lg"
      >
        <form action={issueCertificateAction} className="grid gap-4">
          <select name="enrollmentId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
            {readyCandidates.map((candidate) => (
              <option key={candidate.enrollmentId} value={candidate.enrollmentId}>
                {candidate.learnerName} - {candidate.courseTitle} ({candidate.progressPercent}%)
              </option>
            ))}
          </select>
          {readyCandidates.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              ยังไม่มีรายการที่พร้อมออกใบประกาศ
            </p>
          )}
          {readyCandidates.length > 0 && (
            <div className="grid gap-2 rounded-lg border bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-primary" />
                รายการที่ผ่านเงื่อนไข
              </div>
              {readyCandidates.slice(0, 5).map((candidate) => (
                <div key={candidate.enrollmentId} className="grid gap-1 rounded-md bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{candidate.learnerName}</span>
                    <Badge>พร้อม</Badge>
                  </div>
                  <p className="text-muted-foreground">{candidate.courseTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    เรียน {candidate.completedLessons}/{candidate.totalLessons} บท / งานผ่าน{" "}
                    {candidate.passedTasks}/{candidate.totalTasks} / หลังเรียน{" "}
                    {formatPercent(candidate.postTestScore)}%
                  </p>
                </div>
              ))}
            </div>
          )}
          {blockedCandidates.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <CircleAlert className="size-4" />
                รายการที่ยังไม่พร้อม ({blockedCandidates.length})
              </div>
              {blockedCandidates.slice(0, 5).map((candidate) => (
                <div key={candidate.enrollmentId} className="grid gap-1 rounded-md bg-background p-3 text-sm">
                  <p className="font-medium">{candidate.learnerName}</p>
                  <p className="text-muted-foreground">{candidate.courseTitle}</p>
                  <p className="text-xs text-amber-800">{candidate.eligibilityText}</p>
                </div>
              ))}
            </div>
          )}
          <Button type="submit" className="w-fit" disabled={readyCandidates.length === 0}>
            <Award className="size-4" />
            ออกใบประกาศ
          </Button>
        </form>
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="ยกเลิกใบประกาศ"
        description="ใบประกาศจะยังอยู่ในระบบ แต่สถานะจะเปลี่ยนเป็นยกเลิกแล้ว"
      >
        {revoking && (
          <form action={revokeCertificateAction} className="grid gap-4">
            <input type="hidden" name="certificateId" value={revoking.id} />
            <p className="text-sm text-muted-foreground">
              {revoking.certificateNo} / {revoking.learnerName}
            </p>
            <Button type="submit" variant="destructive" className="w-fit">
              <Ban className="size-4" />
              ยกเลิกใบประกาศ
            </Button>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}
