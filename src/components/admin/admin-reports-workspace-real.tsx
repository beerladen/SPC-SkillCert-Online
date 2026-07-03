"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  ListChecks,
  Printer,
  UserRound,
} from "lucide-react";
import { createReportExportAction } from "@/app/admin/reports/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminReportCourseLearnerRow,
  AdminReportData,
  AdminReportLearnerRow,
} from "@/lib/admin-summary-repositories";
import type { AdminReviewSubmissionRow } from "@/lib/admin-review-repositories";

type ReportTab = "course" | "learner" | "submissions" | "document";

const tabs: Array<{ key: ReportTab; label: string; icon: typeof BookOpenCheck }> = [
  { key: "course", label: "รายงานตามหลักสูตร", icon: BookOpenCheck },
  { key: "learner", label: "รายงานรายบุคคล", icon: UserRound },
  { key: "submissions", label: "วัดผลและส่งงาน", icon: ListChecks },
  { key: "document", label: "เอกสาร A4 / PDF", icon: FileText },
];

const statusLabels: Record<string, string> = {
  active: "กำลังเรียน",
  completed: "เรียนครบ",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
  pending_review: "รอตรวจงาน",
  waiting_submission: "รอส่งงาน",
  not_passed: "ไม่ผ่าน",
  certificate_issued: "ออกใบประกาศแล้ว",
  pending_payment: "รอค่าลงทะเบียน",
  pending: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  issued: "ออกแล้ว",
  revoked: "ยกเลิกใบประกาศ",
  reissued: "ออกใหม่",
  submitted: "ส่งแล้ว",
  graded: "ตรวจแล้ว",
  passed: "ผ่าน",
  needs_revision: "ให้แก้ไข",
  draft: "ฉบับร่าง",
  open: "เปิดรับสมัคร",
  nearly_full: "ใกล้เต็ม",
  closed: "ปิดรับสมัคร",
};

function labelStatus(status: string | null | undefined, fallback = "-") {
  if (!status) return fallback;
  return statusLabels[status] ?? status;
}

function statusVariant(status: string | null | undefined) {
  if (["completed", "approved", "issued", "certificate_issued", "passed"].includes(status ?? "")) {
    return "default" as const;
  }
  if (["rejected", "cancelled", "expired", "not_passed", "revoked"].includes(status ?? "")) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function taskTypeLabel(type: string) {
  return type === "practice" ? "แบบฝึกปฏิบัติ" : "ใบงาน";
}

function documentTypeLabel(type: string | null | undefined) {
  return type === "certificate" ? "ใบประกาศนียบัตร" : "เกียรติบัตร";
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
}

function printCourseUrl(courseId: number | string) {
  return `/admin/reports/print?type=course&courseId=${encodeURIComponent(String(courseId))}`;
}

function printLearnerUrl(userId: number | string) {
  return `/admin/reports/print?type=learner&learnerId=${encodeURIComponent(String(userId))}`;
}

function ProgressBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-36">
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs font-medium">{formatPercent(percent)}</p>
    </div>
  );
}

function FileLink({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-secondary"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function AdminReportsWorkspaceReal({ data }: { data: AdminReportData }) {
  const [tab, setTab] = useState<ReportTab>("course");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    data.courseOptions[0] ? String(data.courseOptions[0].id) : "",
  );
  const [selectedLearner, setSelectedLearner] = useState<AdminReportLearnerRow | null>(null);
  const [selectedCourseLearner, setSelectedCourseLearner] =
    useState<AdminReportCourseLearnerRow | null>(null);

  const selectedCourse = useMemo(
    () => data.courseOptions.find((course) => String(course.id) === selectedCourseId) ?? null,
    [data.courseOptions, selectedCourseId],
  );

  const selectedCourseLearners = useMemo(
    () =>
      selectedCourseId
        ? data.courseLearnerRows.filter((row) => String(row.courseId) === selectedCourseId)
        : data.courseLearnerRows,
    [data.courseLearnerRows, selectedCourseId],
  );

  const selectedCourseSubmissions = useMemo(
    () =>
      selectedCourseId
        ? data.reviewRows.filter((row) => String(row.courseId) === selectedCourseId)
        : data.reviewRows,
    [data.reviewRows, selectedCourseId],
  );

  const selectedLearnerCourses = selectedLearner
    ? data.courseLearnerRows.filter((row) => row.userId === selectedLearner.userId)
    : [];

  const selectedLearnerSubmissions = selectedLearner
    ? data.reviewRows.filter((row) => row.learnerId === selectedLearner.userId)
    : [];

  const courseColumns: Array<AdminDataTableColumn<AdminReportCourseLearnerRow>> = [
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      className: "min-w-60",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.learnerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.learnerEmail}</p>
          {row.learnerPhone && <p className="text-xs text-muted-foreground">{row.learnerPhone}</p>}
        </div>
      ),
    },
    {
      id: "registration",
      header: "ลงทะเบียน",
      className: "min-w-48",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <span>{row.registeredAt ?? "-"}</span>
          <span className="text-xs text-muted-foreground">{row.registrationNo ?? "-"}</span>
          <div className="flex flex-wrap gap-1">
            <Badge variant={statusVariant(row.registrationStatus)}>
              {labelStatus(row.registrationStatus)}
            </Badge>
            <Badge variant={statusVariant(row.paymentStatus)}>
              {labelStatus(row.paymentStatus, "ยังไม่มีชำระ")}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: "progress",
      header: "ความก้าวหน้า",
      className: "min-w-44",
      render: (row) => (
        <div>
          <ProgressBar value={row.progressPercent} />
          <p className="mt-1 text-xs text-muted-foreground">
            บทเรียน {row.completedLessons}/{row.totalLessons}
          </p>
        </div>
      ),
    },
    {
      id: "scores",
      header: "Pre/Post",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <span>ก่อนเรียน {formatScore(row.preTestScore)}</span>
          <span>หลังเรียน {formatScore(row.postTestScore)}</span>
        </div>
      ),
    },
    {
      id: "tasks",
      header: "ใบงาน/แบบฝึก",
      className: "min-w-44",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">ส่ง {row.submittedTasks}/{row.totalTasks}</Badge>
          <Badge variant="default">ผ่าน {row.passedTasks}</Badge>
          <Badge variant={row.failedTasks > 0 ? "destructive" : "outline"}>ไม่ผ่าน {row.failedTasks}</Badge>
          <Badge variant={row.pendingTasks > 0 ? "secondary" : "outline"}>รอตรวจ {row.pendingTasks}</Badge>
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      className: "min-w-44",
      render: (row) => (
        <div className="grid gap-2">
          <Badge variant={statusVariant(row.courseResultStatus)}>
            {labelStatus(row.courseResultStatus)}
          </Badge>
          <Badge variant={statusVariant(row.certificateStatus)}>
            {labelStatus(row.certificateStatus, "ยังไม่พร้อม")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {documentTypeLabel(row.certificateDocumentType)}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedCourseLearner(row)}>
            รายละเอียด
          </Button>
          <Button asChild variant="outline" size="icon-sm" title="พิมพ์รายบุคคล">
            <Link href={printLearnerUrl(row.userId)} target="_blank">
              <Printer className="size-4" />
            </Link>
          </Button>
          {row.certificateUrl && (
            <Button asChild variant="outline" size="icon-sm" title="ดูใบประกาศ">
              <Link href={row.certificateUrl} target="_blank">
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const learnerColumns: Array<AdminDataTableColumn<AdminReportLearnerRow>> = [
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      className: "min-w-64",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.learnerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.learnerEmail}</p>
          {row.learnerPhone && <p className="text-xs text-muted-foreground">{row.learnerPhone}</p>}
        </div>
      ),
    },
    {
      id: "courses",
      header: "หลักสูตร",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{row.courseCount} หลักสูตร</Badge>
          <Badge variant="secondary">กำลังเรียน {row.activeCourses}</Badge>
          <Badge variant="default">เรียนครบ {row.completedCourses}</Badge>
        </div>
      ),
    },
    {
      id: "progress",
      header: "ความก้าวหน้าเฉลี่ย",
      render: (row) => <ProgressBar value={row.averageProgress} />,
    },
    {
      id: "pending",
      header: "งานรอตรวจ",
      render: (row) => (
        <Badge variant={row.pendingTasks > 0 ? "secondary" : "outline"}>
          {row.pendingTasks} งาน
        </Badge>
      ),
    },
    {
      id: "certificates",
      header: "ใบประกาศ",
      render: (row) => <Badge variant="outline">{row.certificates} ใบ</Badge>,
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedLearner(row)}>
            ดูรายละเอียด
          </Button>
          <Button asChild variant="outline" size="icon-sm" title="พิมพ์รายบุคคล">
            <Link href={printLearnerUrl(row.userId)} target="_blank">
              <Printer className="size-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  const submissionColumns: Array<AdminDataTableColumn<AdminReviewSubmissionRow>> = [
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      className: "min-w-56",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.learnerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.learnerEmail}</p>
        </div>
      ),
    },
    {
      id: "task",
      header: "ชิ้นงาน",
      className: "min-w-80",
      render: (row) => (
        <div>
          <div className="flex flex-wrap gap-1">
            <Badge>{taskTypeLabel(row.taskType)}</Badge>
            <Badge variant="outline">{row.submissionNo}</Badge>
          </div>
          <p className="mt-2 line-clamp-2 font-medium">{row.taskTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.courseTitle}</p>
        </div>
      ),
    },
    {
      id: "score",
      header: "คะแนน",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <span className="font-semibold">
            {row.score === null ? "-" : formatScore(row.score)}/{formatScore(row.maxScore)}
          </span>
          <span className="text-xs text-muted-foreground">ผ่าน {formatScore(row.passingScore)}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะตรวจ",
      render: (row) => (
        <div className="grid gap-1">
          <Badge variant={statusVariant(row.status)}>{labelStatus(row.status)}</Badge>
          <span className="text-xs text-muted-foreground">
            ผู้ตรวจ {row.gradedByName ?? "-"}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.gradedAt ? `ตรวจเมื่อ ${row.gradedAt}` : "ยังไม่ตรวจ"}
          </span>
        </div>
      ),
    },
    {
      id: "files",
      header: "ไฟล์ / หลักฐาน",
      className: "min-w-52",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <FileLink href={row.submittedFileUrl} label={row.submittedFileName ?? "ไฟล์งาน"} />
          <FileLink href={row.submittedLinkUrl} label="ลิงก์งาน" />
          {row.evidences.slice(0, 3).map((evidence, index) => (
            <FileLink
              key={evidence.id}
              href={evidence.evidenceUrl}
              label={evidence.fileName ?? evidence.evidenceText ?? `หลักฐาน ${index + 1}`}
            />
          ))}
          {row.evidences.length > 3 && <Badge variant="outline">+{row.evidences.length - 3}</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>ศูนย์รายงาน DataTable</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              เลือกรายงานรายหลักสูตร รายบุคคล วัดผล/ส่งงาน และเอกสาร A4 สำหรับพิมพ์หรือบันทึกเป็น PDF
            </p>
          </div>
          <form action={createReportExportAction} className="flex flex-wrap gap-2">
            <Button type="submit" name="reportType" value="course_summary" size="sm">
              <FileDown className="size-4" />
              CSV หลักสูตร
            </Button>
            <Button type="submit" name="reportType" value="registration_payment" variant="outline" size="sm">
              <FileDown className="size-4" />
              CSV ค่าลงทะเบียน
            </Button>
          </form>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.key}
                    type="button"
                    variant={tab === item.key ? "default" : "outline"}
                    onClick={() => setTab(item.key)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              หลักสูตร
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="h-9 min-w-72 rounded-md border bg-background px-3 text-sm text-foreground"
              >
                {data.courseOptions.length === 0 ? (
                  <option value="">ยังไม่มีหลักสูตร</option>
                ) : (
                  data.courseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {tab === "course" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>รายงานภาพรวมแต่ละหลักสูตร</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedCourse ? `${selectedCourse.title} / ${documentTypeLabel(selectedCourse.certificateDocumentType)}` : "เลือกหลักสูตรเพื่อดูรายงาน"}
              </p>
            </div>
            {selectedCourse && (
              <Button asChild variant="outline" size="sm">
                <Link href={printCourseUrl(selectedCourse.id)} target="_blank">
                  <Printer className="size-4" />
                  PDF A4
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={selectedCourseLearners}
              columns={courseColumns}
              getRowKey={(row) => String(row.enrollmentId)}
              getSearchText={(row) =>
                `${row.learnerName} ${row.learnerEmail} ${row.learnerPhone ?? ""} ${row.registrationNo ?? ""} ${row.courseTitle} ${row.courseResultStatus}`
              }
              searchPlaceholder="ค้นหาชื่อ อีเมล เบอร์โทร เลขลงทะเบียน หรือสถานะ"
              pageSize={8}
              emptyText="ยังไม่มีผู้เข้าอบรมในหลักสูตรนี้"
            />
          </CardContent>
        </Card>
      )}

      {tab === "learner" && (
        <Card>
          <CardHeader>
            <CardTitle>รายงานรายบุคคล</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              ค้นหาผู้เข้าอบรม 1 คน แล้วดูทุกหลักสูตร คะแนน งานส่ง และสถานะใบประกาศ
            </p>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={data.learnerRows}
              columns={learnerColumns}
              getRowKey={(row) => String(row.userId)}
              getSearchText={(row) =>
                `${row.learnerName} ${row.learnerEmail} ${row.learnerPhone ?? ""}`
              }
              searchPlaceholder="ค้นหาชื่อ อีเมล หรือเบอร์โทรผู้เข้าอบรม"
              pageSize={8}
              emptyText="ยังไม่มีข้อมูลผู้เข้าอบรม"
            />
          </CardContent>
        </Card>
      )}

      {tab === "submissions" && (
        <Card>
          <CardHeader>
            <CardTitle>รายงานวัดผลและส่งงาน</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              แสดงใบงาน/แบบฝึก คะแนน เกณฑ์ผ่าน สถานะตรวจ ไฟล์งาน หลักฐาน ผู้ตรวจ และวันที่ตรวจ
            </p>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={selectedCourseSubmissions}
              columns={submissionColumns}
              getRowKey={(row) => String(row.id)}
              getSearchText={(row) =>
                `${row.learnerName} ${row.learnerEmail} ${row.courseTitle} ${row.taskTitle} ${row.status}`
              }
              searchPlaceholder="ค้นหาผู้เรียน หลักสูตร ชิ้นงาน หรือสถานะตรวจ"
              filter={{
                label: "สถานะ",
                getValue: (row) => row.status,
                options: [
                  { label: "รอตรวจ", value: "pending_review" },
                  { label: "ส่งแล้ว", value: "submitted" },
                  { label: "ผ่าน", value: "passed" },
                  { label: "ไม่ผ่าน", value: "not_passed" },
                  { label: "ให้แก้ไข", value: "needs_revision" },
                  { label: "ตรวจแล้ว", value: "graded" },
                ],
              }}
              pageSize={8}
              emptyText="ยังไม่มีงานส่งในหลักสูตรนี้"
            />
          </CardContent>
        </Card>
      )}

      {tab === "document" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>เอกสารรายงานพร้อมเซ็นรับรอง</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                เอกสาร A4 จะจัดหัวรายงาน ตารางรายชื่อ สรุปผล และช่องลงนามเจ้าของหลักสูตร พร้อมใช้คำสั่งพิมพ์เป็น PDF
              </p>
            </CardHeader>
            <CardContent>
              {selectedCourse ? (
                <div className="grid gap-4 rounded-lg border bg-secondary/20 p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">ชื่อหลักสูตร</p>
                    <p className="text-xl font-bold">{selectedCourse.title}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ReportMetric label="ผู้เข้าอบรม" value={`${selectedCourseLearners.length} คน`} />
                    <ReportMetric
                      label="เรียนครบ"
                      value={`${selectedCourseLearners.filter((row) => row.enrollmentStatus === "completed").length} คน`}
                    />
                    <ReportMetric
                      label="ใบประกาศออกแล้ว"
                      value={`${selectedCourseLearners.filter((row) => row.certificateStatus === "issued").length} ใบ`}
                    />
                  </div>
                  <div className="grid gap-2 text-sm">
                    <p>เจ้าของหลักสูตร: {selectedCourse.instructorName ?? "-"}</p>
                    <p>ตำแหน่ง: {selectedCourse.instructorPosition ?? "-"}</p>
                    <p>
                      ช่วงอบรม: {selectedCourse.startsAt ?? "ตลอดเวลา"} - {selectedCourse.endsAt ?? "ตลอดเวลา"}
                    </p>
                    <p>รูปแบบใบประกาศ: {documentTypeLabel(selectedCourse.certificateDocumentType)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={printCourseUrl(selectedCourse.id)} target="_blank">
                        <Printer className="size-4" />
                        เปิดเอกสาร A4 / PDF
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={printCourseUrl(selectedCourse.id)} target="_blank">
                        <FileText className="size-4" />
                        รายชื่อผู้ผ่าน/ไม่ผ่าน
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  ยังไม่มีหลักสูตรสำหรับสร้างเอกสารรายงาน
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ประวัติการส่งออก</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.exports.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  ยังไม่มีประวัติการส่งออกรายงาน
                </p>
              ) : (
                data.exports.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{item.reportType}</p>
                      <p className="text-sm text-muted-foreground">{item.createdAt}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{item.status}</Badge>
                      {item.fileUrl && (
                        <Button asChild variant="outline" size="sm">
                          <a href={item.fileUrl}>
                            <Download className="size-4" />
                            ดาวน์โหลด
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AdminActionModal
        open={Boolean(selectedLearner)}
        onOpenChange={(open) => !open && setSelectedLearner(null)}
        title={selectedLearner?.learnerName ?? "รายงานรายบุคคล"}
        description={selectedLearner?.learnerEmail}
        size="xl"
      >
        {selectedLearner && (
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{selectedLearner.courseCount} หลักสูตร</Badge>
              <Badge variant="secondary">งานรอตรวจ {selectedLearner.pendingTasks}</Badge>
              <Badge variant="default">ใบประกาศ {selectedLearner.certificates}</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={printLearnerUrl(selectedLearner.userId)} target="_blank">
                  <Printer className="size-4" />
                  PDF A4 รายบุคคล
                </Link>
              </Button>
            </div>
            <AdminDataTable
              rows={selectedLearnerCourses}
              columns={courseColumns.filter((column) => column.id !== "learner")}
              getRowKey={(row) => String(row.enrollmentId)}
              getSearchText={(row) => `${row.courseTitle} ${row.courseResultStatus}`}
              searchPlaceholder="ค้นหาหลักสูตรหรือสถานะ"
              pageSize={6}
              emptyText="ยังไม่มีหลักสูตรของผู้เข้าอบรมนี้"
            />
            {selectedLearnerSubmissions.length > 0 && (
              <AdminDataTable
                rows={selectedLearnerSubmissions}
                columns={submissionColumns.filter((column) => column.id !== "learner")}
                getRowKey={(row) => String(row.id)}
                getSearchText={(row) => `${row.courseTitle} ${row.taskTitle} ${row.status}`}
                searchPlaceholder="ค้นหางานส่งของผู้เข้าอบรม"
                pageSize={5}
              />
            )}
          </div>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(selectedCourseLearner)}
        onOpenChange={(open) => !open && setSelectedCourseLearner(null)}
        title={selectedCourseLearner?.learnerName ?? "รายละเอียดผู้เข้าอบรม"}
        description={selectedCourseLearner?.courseTitle}
        size="lg"
      >
        {selectedCourseLearner && (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-lg border bg-secondary/20 p-4 md:grid-cols-2">
              <ReportMetric label="ความก้าวหน้า" value={formatPercent(selectedCourseLearner.progressPercent)} />
              <ReportMetric
                label="บทเรียน"
                value={`${selectedCourseLearner.completedLessons}/${selectedCourseLearner.totalLessons}`}
              />
              <ReportMetric
                label="คะแนนก่อนเรียน"
                value={formatScore(selectedCourseLearner.preTestScore)}
              />
              <ReportMetric
                label="คะแนนหลังเรียน"
                value={formatScore(selectedCourseLearner.postTestScore)}
              />
              <ReportMetric
                label="งานส่ง"
                value={`${selectedCourseLearner.submittedTasks}/${selectedCourseLearner.totalTasks}`}
              />
              <ReportMetric label="งานผ่าน" value={`${selectedCourseLearner.passedTasks} งาน`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant(selectedCourseLearner.courseResultStatus)}>
                {labelStatus(selectedCourseLearner.courseResultStatus)}
              </Badge>
              <Badge variant={statusVariant(selectedCourseLearner.certificateStatus)}>
                {labelStatus(selectedCourseLearner.certificateStatus, "ยังไม่พร้อม")}
              </Badge>
              {selectedCourseLearner.certificateUrl && (
                <Button asChild variant="outline" size="sm">
                  <Link href={selectedCourseLearner.certificateUrl} target="_blank">
                    <ExternalLink className="size-4" />
                    ดูใบประกาศ
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </AdminActionModal>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
