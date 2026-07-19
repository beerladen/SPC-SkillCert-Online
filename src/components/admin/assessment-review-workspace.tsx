"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  History,
  ListChecks,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import {
  gradeLearningTaskSubmissionAction,
  gradeLearningTaskSubmissionsBatchAction,
} from "@/app/admin/assessments/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminReviewSubmissionRow } from "@/lib/admin-review-repositories";

interface QueueCourse {
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  pending: number;
  latestSubmittedAt: string | null;
}

interface LearnerQueueRow {
  id: number;
  name: string;
  email: string;
  pending: number;
  total: number;
  latestSubmittedAt: string | null;
  courses: QueueCourse[];
}

function taskTypeLabel(type: string) {
  return type === "practice" ? "แบบฝึกปฏิบัติ" : "ใบงาน";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "ส่งแล้ว",
    pending_review: "รอตรวจ",
    graded: "ตรวจแล้ว",
    passed: "ผ่าน",
    not_passed: "ไม่ผ่าน",
    needs_revision: "ให้แก้ไข",
  };
  return labels[status] ?? status;
}

function statusVariant(status: string) {
  if (["passed", "graded"].includes(status)) return "default";
  if (["not_passed", "needs_revision"].includes(status)) return "destructive";
  return "secondary";
}

function formatScore(value: number | null, maxScore: number) {
  if (value === null) return `-/${maxScore}`;
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}/${maxScore}`;
}

function formatPassingScore(passingScore: number, maxScore: number) {
  const formatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
  if (maxScore <= 0) return `${formatter.format(passingScore)} คะแนน`;
  const percent = (passingScore / maxScore) * 100;
  return `${formatter.format(passingScore)} คะแนน (${formatter.format(percent)}%)`;
}

function isPendingReview(status: string) {
  return ["submitted", "pending_review"].includes(status);
}

function isGraded(status: string) {
  return ["passed", "graded", "not_passed"].includes(status);
}

function compareDateValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Send className="size-7 text-primary" />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FileLink({
  href,
  label,
}: {
  href: string | null;
  label: string;
}) {
  if (!href) return null;

  return (
    <a
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-secondary"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function AssessmentReviewWorkspace({
  rows,
}: {
  rows: AdminReviewSubmissionRow[];
}) {
  const router = useRouter();
  const [reviewTarget, setReviewTarget] = useState<{ learnerId: number; courseId: number } | null>(null);
  const [historyLearnerId, setHistoryLearnerId] = useState<number | null>(null);
  const [selected, setSelected] = useState<AdminReviewSubmissionRow | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; ok: boolean } | null>(null);
  const [savedSubmissionIds, setSavedSubmissionIds] = useState<Set<number>>(() => new Set());
  const [savingSubmissionId, setSavingSubmissionId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendingRows = useMemo(
    () =>
      rows
        .filter((row) => isPendingReview(row.status))
        .sort((a, b) => compareDateValue(a.submittedAt) - compareDateValue(b.submittedAt)),
    [rows],
  );

  const queueRows = useMemo(() => {
    const learners = new Map<number, LearnerQueueRow>();

    for (const row of pendingRows) {
      const learner =
        learners.get(row.learnerId) ??
        ({
          id: row.learnerId,
          name: row.learnerName,
          email: row.learnerEmail,
          pending: 0,
          total: rows.filter((item) => item.learnerId === row.learnerId).length,
          latestSubmittedAt: null,
          courses: [],
        } satisfies LearnerQueueRow);

      learner.pending += 1;
      if (compareDateValue(row.submittedAt) > compareDateValue(learner.latestSubmittedAt)) {
        learner.latestSubmittedAt = row.submittedAt;
      }

      const course = learner.courses.find((item) => item.courseId === row.courseId);
      if (course) {
        course.pending += 1;
        if (compareDateValue(row.submittedAt) > compareDateValue(course.latestSubmittedAt)) {
          course.latestSubmittedAt = row.submittedAt;
        }
      } else {
        learner.courses.push({
          courseId: row.courseId,
          courseTitle: row.courseTitle,
          courseSlug: row.courseSlug,
          pending: 1,
          latestSubmittedAt: row.submittedAt,
        });
      }

      learners.set(row.learnerId, learner);
    }

    return [...learners.values()]
      .map((learner) => ({
        ...learner,
        courses: learner.courses.sort(
          (a, b) => compareDateValue(a.latestSubmittedAt) - compareDateValue(b.latestSubmittedAt),
        ),
      }))
      .sort(
        (a, b) =>
          compareDateValue(a.latestSubmittedAt) - compareDateValue(b.latestSubmittedAt) ||
          a.name.localeCompare(b.name, "th"),
      );
  }, [pendingRows, rows]);

  const selectedLearner = queueRows.find((row) => row.id === reviewTarget?.learnerId) ?? null;
  const historyQueueLearner = queueRows.find((row) => row.id === historyLearnerId) ?? null;
  const historySubmissionLearner = rows.find((row) => row.learnerId === historyLearnerId) ?? null;
  const historyLearner = historyQueueLearner
    ? { name: historyQueueLearner.name, email: historyQueueLearner.email }
    : historySubmissionLearner
      ? { name: historySubmissionLearner.learnerName, email: historySubmissionLearner.learnerEmail }
      : null;
  const reviewCourse =
    selectedLearner?.courses.find((course) => course.courseId === reviewTarget?.courseId) ?? null;
  const reviewRows = pendingRows.filter(
    (row) =>
      row.learnerId === reviewTarget?.learnerId &&
      row.courseId === reviewTarget?.courseId &&
      !savedSubmissionIds.has(row.id),
  );
  const historyRows = rows
    .filter((row) => row.learnerId === historyLearnerId)
    .sort((a, b) => compareDateValue(b.submittedAt) - compareDateValue(a.submittedAt));

  const learnerColumns: Array<AdminDataTableColumn<LearnerQueueRow>> = [
    {
      id: "learner",
      header: "ผู้เข้าอบรม",
      className: "min-w-72",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "courses",
      header: "รายวิชารอตรวจ",
      className: "min-w-[520px]",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.courses.map((course) => (
            <Button
              key={course.courseId}
              type="button"
              size="sm"
              variant="outline"
              className="h-auto justify-start gap-2 px-3 py-2 text-left"
              onClick={() => setReviewTarget({ learnerId: row.id, courseId: course.courseId })}
            >
              <ListChecks className="size-4 text-primary" />
              <span className="max-w-64 truncate">{course.courseTitle}</span>
              <Badge variant="secondary">{course.pending} งาน</Badge>
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: "tasks",
      header: "คิว",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <Badge variant="secondary" className="w-fit">{row.pending} งานรอตรวจ</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            ล่าสุด {row.latestSubmittedAt ?? "-"}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setHistoryLearnerId(row.id)}>
          <History className="size-4" />
          ดูทั้งหมด
        </Button>
      ),
    },
  ];

  const historyColumns: Array<AdminDataTableColumn<AdminReviewSubmissionRow>> = [
    {
      id: "course",
      header: "หลักสูตร/ชิ้นงาน",
      className: "min-w-80",
      render: (row) => (
        <div>
          <p className="font-medium">{row.courseTitle}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.taskTitle}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      render: (row) => <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>,
    },
    {
      id: "score",
      header: "คะแนน",
      render: (row) => formatScore(row.score, row.maxScore),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
          <FileCheck2 className="size-4" />
          ดู/แก้ไข
        </Button>
      ),
    },
  ];

  const pending = pendingRows.length;
  const revision = rows.filter((row) => row.status === "needs_revision").length;
  const graded = rows.filter((row) => isGraded(row.status)).length;

  function submitGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await gradeLearningTaskSubmissionAction(formData);
      setNotice({
        title: result.ok ? "บันทึกผลตรวจแล้ว" : "ตรวจงานไม่สำเร็จ",
        message: result.message,
        ok: result.ok,
      });
      if (result.ok) {
        setSelected(null);
        router.refresh();
      }
    });
  }

  function submitCourseGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await gradeLearningTaskSubmissionsBatchAction(formData);
      setNotice({
        title: result.ok ? "บันทึกผลตรวจรายวิชาแล้ว" : "ตรวจรายวิชาไม่สำเร็จ",
        message: result.message,
        ok: result.ok,
      });
      if (result.ok) {
        setReviewTarget(null);
        router.refresh();
      }
    });
  }

  function submitCourseItemGrade(row: AdminReviewSubmissionRow, form: HTMLFormElement | null) {
    if (!form || savingSubmissionId !== null) return;

    const sourceFormData = new FormData(form);
    const formData = new FormData();
    formData.append("submissionId", String(row.id));
    formData.append(`score_${row.id}`, String(sourceFormData.get(`score_${row.id}`) ?? ""));
    formData.append(`decision_${row.id}`, String(sourceFormData.get(`decision_${row.id}`) ?? "graded"));
    formData.append(`feedback_${row.id}`, String(sourceFormData.get(`feedback_${row.id}`) ?? ""));

    setSavingSubmissionId(row.id);
    startTransition(async () => {
      try {
        const result = await gradeLearningTaskSubmissionsBatchAction(formData);
        setNotice({
          title: result.ok ? "บันทึกผลตรวจใบงานแล้ว" : "บันทึกรายใบงานไม่สำเร็จ",
          message: result.message,
          ok: result.ok,
        });
        if (result.ok) {
          setSavedSubmissionIds((previous) => {
            const next = new Set(previous);
            next.add(row.id);
            return next;
          });
          if (reviewRows.filter((item) => item.id !== row.id).length === 0) {
            setReviewTarget(null);
          }
          router.refresh();
        }
      } catch (error) {
        setNotice({
          title: "บันทึกรายใบงานไม่สำเร็จ",
          message: error instanceof Error ? error.message : "เกิดข้อผิดพลาดระหว่างบันทึกผลตรวจ",
          ok: false,
        });
      } finally {
        setSavingSubmissionId(null);
      }
    });
  }

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <SummaryCard label="รอตรวจ" value={pending} />
        <SummaryCard label="ส่งกลับแก้ไข" value={revision} />
        <SummaryCard label="ตรวจแล้ว" value={graded} />
      </div>

      <Card className="min-w-0">
        <CardHeader className="gap-2 border-b bg-secondary/20">
          <CardTitle className="text-base">คิวตรวจงาน</CardTitle>
          <p className="text-sm text-muted-foreground">
            แสดงเฉพาะผู้เข้าอบรมที่มีใบงานหรือแบบฝึกส่งเข้ามาและยังไม่ได้ตรวจ คลิกชื่อรายวิชาเพื่อให้คะแนนได้ทันที
          </p>
        </CardHeader>
        <CardContent className="min-w-0 p-5">
          <AdminDataTable
            rows={queueRows}
            columns={learnerColumns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) =>
              `${row.name} ${row.email} ${row.courses.map((course) => course.courseTitle).join(" ")}`
            }
            searchPlaceholder="ค้นหาผู้เข้าอบรม อีเมล หรือรายวิชาที่รอตรวจ"
            emptyText="ไม่มีงานรอตรวจในขณะนี้"
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={Boolean(reviewTarget)}
        title={reviewCourse ? `ตรวจรายวิชา: ${reviewCourse.courseTitle}` : "ตรวจรายวิชา"}
        description={selectedLearner ? `${selectedLearner.name} / ${selectedLearner.email}` : undefined}
        size="xl"
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      >
        {reviewCourse && (
          <form className="grid gap-4" onSubmit={submitCourseGrade}>
            <div className="rounded-lg border bg-primary/5 p-4 text-sm text-muted-foreground">
              ให้คะแนนใบงาน/แบบฝึกที่รอตรวจในรายวิชานี้ให้ครบ แล้วกดบันทึก รายวิชานี้จะออกจากคิวตรวจงานทันทีเมื่อไม่มีงานรอตรวจเหลือ
            </div>
            <div className="grid gap-3">
              {reviewRows.map((row, index) => (
                <div key={row.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_120px_160px_minmax(180px,0.7fr)]">
                  <input type="hidden" name="submissionId" value={row.id} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{taskTypeLabel(row.taskType)}</Badge>
                      <Badge variant="outline">งานที่ {index + 1}</Badge>
                      {row.rubrics.length > 0 && <Badge variant="secondary">{row.rubrics.length} rubric</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 font-medium">{row.taskTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.submissionNo} / ส่งเมื่อ {row.submittedAt ?? "-"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <FileLink href={row.submittedFileUrl} label={row.submittedFileName ?? "ไฟล์งาน"} />
                      <FileLink href={row.submittedLinkUrl} label="ลิงก์งาน" />
                      {row.evidences.slice(0, 3).map((evidence, evidenceIndex) => (
                        <FileLink
                          key={evidence.id}
                          href={evidence.evidenceUrl}
                          label={evidence.fileName ?? evidence.evidenceText ?? `หลักฐาน ${evidenceIndex + 1}`}
                        />
                      ))}
                      {row.evidences.length > 3 && <Badge variant="outline">+{row.evidences.length - 3}</Badge>}
                    </div>
                  </div>
                  <label className="grid content-start gap-2 text-sm font-medium">
                    คะแนน
                    <Input
                      name={`score_${row.id}`}
                      type="number"
                      min={0}
                      max={row.maxScore}
                      step="0.1"
                      required
                      defaultValue={row.score ?? ""}
                      placeholder={`เต็ม ${row.maxScore}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      ผ่าน {formatPassingScore(row.passingScore, row.maxScore)}
                    </span>
                  </label>
                  <label className="grid content-start gap-2 text-sm font-medium">
                    ผลตรวจ
                    <select name={`decision_${row.id}`} defaultValue="graded" className="h-10 rounded-md border bg-background px-3">
                      <option value="graded">ตัดสินตามคะแนน</option>
                      <option value="needs_revision">ส่งกลับแก้ไข</option>
                    </select>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelected(row)}>
                      <FileCheck2 className="size-4" />
                      ตรวจละเอียด
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending || savingSubmissionId !== null}
                      onClick={(event) => submitCourseItemGrade(row, event.currentTarget.form)}
                    >
                      <CheckCircle2 className="size-4" />
                      {savingSubmissionId === row.id ? "กำลังบันทึก" : "บันทึกรายใบงาน"}
                    </Button>
                  </label>
                  <label className="grid content-start gap-2 text-sm font-medium">
                    Feedback
                    <textarea
                      name={`feedback_${row.id}`}
                      className="min-h-24 rounded-md border bg-background p-3 text-sm"
                      defaultValue={row.feedback ?? ""}
                      placeholder="ข้อเสนอแนะถึงผู้เรียน"
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isPending || savingSubmissionId !== null}>
                <CheckCircle2 className="size-4" />
                บันทึกคะแนนทั้งรายวิชา
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(historyLearnerId)}
        title="รายละเอียดงานทั้งหมด"
        description={historyLearner ? `${historyLearner.name} / ${historyLearner.email}` : undefined}
        size="xl"
        onOpenChange={(open) => {
          if (!open) setHistoryLearnerId(null);
        }}
      >
        <AdminDataTable
          rows={historyRows}
          columns={historyColumns}
          getRowKey={(row) => String(row.id)}
          getSearchText={(row) => `${row.courseTitle} ${row.taskTitle} ${row.status}`}
          searchPlaceholder="ค้นหาหลักสูตร ชิ้นงาน หรือสถานะ"
          filter={{
            label: "สถานะ",
            getValue: (row) => row.status,
            options: [
              { label: "รอตรวจ", value: "pending_review" },
              { label: "ส่งแล้ว", value: "submitted" },
              { label: "ให้แก้ไข", value: "needs_revision" },
              { label: "ผ่าน", value: "passed" },
              { label: "ไม่ผ่าน", value: "not_passed" },
            ],
          }}
        />
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(selected)}
        title={selected?.taskTitle ?? "ตรวจงาน"}
        description={selected ? `${selected.learnerName} / ${selected.courseTitle}` : undefined}
        size="lg"
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <form className="grid gap-5" onSubmit={submitGrade}>
            <input type="hidden" name="submissionId" value={selected.id} />
            <div className="grid gap-3 rounded-lg border bg-secondary/30 p-4 text-sm leading-6">
              <div className="flex flex-wrap gap-2">
                <Badge>{taskTypeLabel(selected.taskType)}</Badge>
                <Badge variant={statusVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
                <Badge variant="outline">คะแนนเต็ม {selected.maxScore}</Badge>
                <Badge variant="outline">ผ่าน {formatPassingScore(selected.passingScore, selected.maxScore)}</Badge>
              </div>
              {selected.answerText && (
                <div>
                  <p className="font-medium">คำตอบ/คำอธิบาย</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.answerText}</p>
                </div>
              )}
              {selected.note && (
                <div>
                  <p className="font-medium">หมายเหตุผู้เรียน</p>
                  <p className="mt-1 text-muted-foreground">{selected.note}</p>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {selected.submittedFileUrl && (
                <a className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary" href={selected.submittedFileUrl} target="_blank" rel="noreferrer">
                  <span>{selected.submittedFileName ?? "ไฟล์งาน"}</span>
                  <ExternalLink className="size-4" />
                </a>
              )}
              {selected.submittedLinkUrl && (
                <a className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary" href={selected.submittedLinkUrl} target="_blank" rel="noreferrer">
                  <span>ลิงก์ผลงาน</span>
                  <ExternalLink className="size-4" />
                </a>
              )}
              {selected.evidences.map((evidence) => (
                <a
                  key={evidence.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary"
                  href={evidence.evidenceUrl ?? "#"}
                  target={evidence.evidenceUrl ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <span>{evidence.fileName ?? evidence.evidenceText ?? evidence.evidenceType}</span>
                  {evidence.evidenceUrl && <ExternalLink className="size-4" />}
                </a>
              ))}
            </div>

            {selected.rubrics.length > 0 && (
              <div className="grid gap-3 rounded-lg border bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">เกณฑ์การให้คะแนน</p>
                    <p className="text-sm text-muted-foreground">กรอกคะแนนรายข้อ ระบบจะรวมคะแนนให้อัตโนมัติ</p>
                  </div>
                  <Badge variant="outline">
                    รวม {selected.rubrics.reduce((sum, rubric) => sum + rubric.maxScore, 0)} คะแนน
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {selected.rubrics.map((rubric) => (
                    <div key={rubric.id} className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_140px]">
                      <div className="min-w-0">
                        <p className="font-medium">{rubric.title}</p>
                        {rubric.description && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{rubric.description}</p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">คะแนนเต็ม {rubric.maxScore}</p>
                      </div>
                      <label className="grid gap-2 text-sm font-medium">
                        คะแนน
                        <Input
                          name={`rubricScore_${rubric.id}`}
                          type="number"
                          min={0}
                          max={rubric.maxScore}
                          step="0.1"
                          required
                          defaultValue={rubric.score ?? ""}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium md:col-span-2">
                        Feedback รายข้อ
                        <Input
                          name={`rubricFeedback_${rubric.id}`}
                          defaultValue={rubric.feedback ?? ""}
                          placeholder="ข้อเสนอแนะเฉพาะเกณฑ์นี้"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <label className="grid gap-2 text-sm font-medium">
                คะแนน
                <Input
                  name="score"
                  type="number"
                  min={0}
                  max={selected.maxScore}
                  step="0.1"
                  required={selected.rubrics.length === 0}
                  readOnly={selected.rubrics.length > 0}
                  defaultValue={selected.score ?? ""}
                  placeholder={selected.rubrics.length > 0 ? "รวมจาก rubric" : undefined}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                ผลตรวจ
                <select name="decision" defaultValue="graded" className="h-10 rounded-md border bg-background px-3">
                  <option value="graded">ตรวจและตัดสินตามคะแนน</option>
                  <option value="needs_revision">ส่งกลับให้แก้ไข</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Feedback ถึงผู้เรียน
              <textarea
                name="feedback"
                className="min-h-28 rounded-md border bg-background p-3 text-sm"
                defaultValue={selected.feedback ?? ""}
              />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="outline" disabled={isPending}>
                <RotateCcw className="size-4" />
                ส่งตามผลตรวจ
              </Button>
              <Button type="submit" disabled={isPending}>
                <CheckCircle2 className="size-4" />
                บันทึกผลตรวจ
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(notice)}
        title={notice?.title ?? ""}
        description={notice?.message}
        onOpenChange={() => setNotice(null)}
      >
        <div className={notice?.ok ? "rounded-md border border-primary/20 bg-primary/5 p-4 text-sm" : "rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm"}>
          {notice?.message}
        </div>
      </AdminActionModal>
    </div>
  );
}
