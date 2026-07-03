"use client";

import { type FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, BookOpenCheck, Eye, FileQuestion, GraduationCap, Settings2 } from "lucide-react";
import { updateEnrollmentStatusAction } from "@/app/admin/enrollments/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminEnrollmentProgressRow } from "@/lib/admin-review-repositories";

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function statusLabel(status: string | null) {
  const labels: Record<string, string> = {
    active: "กำลังเรียน",
    completed: "เรียนจบ",
    expired: "หมดอายุ",
    cancelled: "ยกเลิก",
    approved: "อนุมัติแล้ว",
    pending_payment: "รอค่าลงทะเบียน",
    pending_review: "รอตรวจหลักฐาน",
    rejected: "ไม่ผ่าน",
    issued: "ออกแล้ว",
  };
  return status ? labels[status] ?? status : "-";
}

function statusVariant(status: string | null) {
  if (["completed", "approved", "issued"].includes(status ?? "")) return "default";
  if (["rejected", "cancelled", "expired"].includes(status ?? "")) return "destructive";
  return "secondary";
}

export function AdminEnrollmentsWorkspace({
  rows,
}: {
  rows: AdminEnrollmentProgressRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminEnrollmentProgressRow | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateEnrollmentStatusAction(formData);
      setNotice(result);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  const columns: Array<AdminDataTableColumn<AdminEnrollmentProgressRow>> = [
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      className: "min-w-64",
      render: (row) => (
        <div>
          <p className="font-medium">{row.learnerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.learnerEmail}</p>
        </div>
      ),
    },
    {
      id: "course",
      header: "หลักสูตร",
      className: "min-w-80",
      render: (row) => (
        <div>
          <p className="font-medium">{row.courseTitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusVariant(row.enrollmentStatus)}>
              {statusLabel(row.enrollmentStatus)}
            </Badge>
            <Badge variant={statusVariant(row.registrationStatus)}>
              {statusLabel(row.registrationStatus)}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: "progress",
      header: "ความคืบหน้า",
      render: (row) => (
        <div className="min-w-44">
          <div className="h-2 rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(100, row.progressPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-medium">{formatPercent(row.progressPercent)}</p>
          <p className="text-xs text-muted-foreground">
            บทเรียน {row.completedLessons}/{row.totalLessons}
          </p>
        </div>
      ),
    },
    {
      id: "scores",
      header: "วัดผล",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <span>ก่อนเรียน {formatPercent(row.preTestScore)}</span>
          <span>หลังเรียน {formatPercent(row.postTestScore)}</span>
          <span className="text-muted-foreground">
            งานส่ง {row.submittedTasks}/{row.totalTasks}
          </span>
        </div>
      ),
    },
    {
      id: "pending",
      header: "รอตรวจ",
      render: (row) => (
        <Badge variant={row.pendingTasks > 0 ? "secondary" : "outline"}>
          {row.pendingTasks} งาน
        </Badge>
      ),
    },
    {
      id: "certificate",
      header: "ใบประกาศ",
      render: (row) => (
        <Badge variant={statusVariant(row.certificateStatus)}>
          {statusLabel(row.certificateStatus)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon-sm" asChild title="เปิดหน้าผู้เรียนของหลักสูตรนี้">
            <Link href={`/my-learning/${row.courseSlug}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" title="จัดการสถานะ" onClick={() => setEditing(row)}>
            <Settings2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const completed = rows.filter((row) => row.enrollmentStatus === "completed").length;
  const pendingReviews = rows.reduce((sum, row) => sum + row.pendingTasks, 0);
  const readyCertificates = rows.filter((row) => row.certificateStatus === "issued").length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={GraduationCap} label="ผู้เข้าอบรม" value={rows.length} />
        <SummaryCard icon={BookOpenCheck} label="เรียนจบ" value={completed} />
        <SummaryCard icon={FileQuestion} label="งานรอตรวจ" value={pendingReviews} />
        <SummaryCard icon={Award} label="ใบประกาศออกแล้ว" value={readyCertificates} />
      </div>

      <Card>
        <CardContent className="p-5">
          <AdminDataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) =>
              `${row.learnerName} ${row.learnerEmail} ${row.courseTitle} ${row.enrollmentStatus}`
            }
            searchPlaceholder="ค้นหาผู้เข้าอบรม อีเมล หรือหลักสูตร"
            filter={{
              label: "สถานะ",
              getValue: (row) => row.enrollmentStatus,
              options: [
                { label: "กำลังเรียน", value: "active" },
                { label: "เรียนจบ", value: "completed" },
                { label: "หมดอายุ", value: "expired" },
                { label: "ยกเลิก", value: "cancelled" },
              ],
            }}
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title="จัดการผู้เข้าอบรม"
        description={editing ? `${editing.learnerName} / ${editing.courseTitle}` : undefined}
      >
        {editing && (
          <form className="grid gap-4" onSubmit={submitStatus}>
            <input type="hidden" name="enrollmentId" value={editing.id} />
            <div className="grid gap-2 rounded-lg border bg-secondary/30 p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant(editing.enrollmentStatus)}>{statusLabel(editing.enrollmentStatus)}</Badge>
                <Badge variant="outline">ความคืบหน้า {formatPercent(editing.progressPercent)}</Badge>
                <Badge variant="outline">งานรอตรวจ {editing.pendingTasks}</Badge>
              </div>
              <p className="text-muted-foreground">
                ก่อนเปลี่ยนเป็นเรียนจบ ควรตรวจสอบว่าเรียนครบ งานผ่าน และคะแนนหลังเรียนผ่านเกณฑ์แล้ว
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              สถานะ
              <select name="status" defaultValue={editing.enrollmentStatus} className="h-10 rounded-md border bg-background px-3">
                <option value="active">กำลังเรียน</option>
                <option value="completed">เรียนจบ</option>
                <option value="expired">หมดอายุ</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              หมายเหตุ
              <textarea
                name="note"
                className="min-h-24 rounded-md border bg-background p-3 text-sm"
                placeholder="ระบุเหตุผลหรือบันทึกภายใน"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isPending}>
                บันทึกสถานะ
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(notice)}
        onOpenChange={() => setNotice(null)}
        title={notice?.ok ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ"}
        description={notice?.message}
      >
        <div className={notice?.ok ? "rounded-md border border-primary/20 bg-primary/5 p-4 text-sm" : "rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm"}>
          {notice?.message}
        </div>
      </AdminActionModal>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Icon className="size-7 text-primary" />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
