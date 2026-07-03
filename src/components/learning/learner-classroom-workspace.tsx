"use client";

import { type ComponentType, type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileUp,
  FileQuestion,
  FileText,
  Gauge,
  Link2,
  ListChecks,
  Paperclip,
  PanelLeft,
  PlayCircle,
  Send,
  Trophy,
  X,
} from "lucide-react";
import {
  submitAssessmentAttemptAction,
  submitLearningTaskAction,
  updateLessonProgressAction,
} from "@/app/my-learning/[slug]/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UploadField } from "@/components/ui/upload-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LearnerClassroomData,
  LearnerTaskEvidence,
  LearningAssessmentOption,
  LearningLesson,
  LearningTask,
} from "@/lib/learning-repositories";
import { learningSubmissionFileEvidenceMarker } from "@/lib/learning-task-files";
import { cn } from "@/lib/utils";

type ClassroomTab = "lessons" | "tests" | "tasks" | "result";

const learnerUploadAccept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.webp";
const learnerUploadExtensions = learnerUploadAccept.split(",");
const learnerUploadMaxBytes = 30 * 1024 * 1024;

interface AdminPreviewContext {
  learnerEmail: string;
  learnerName: string;
  returnHref?: string;
}

interface ClassroomNotice {
  title: string;
  message: string;
  variant: "success" | "error";
  action?: "lessons" | "tasks" | "post_test" | "result";
  actionLabel?: string;
  secondaryLabel?: string;
}

interface ClassroomActionResult {
  ok: boolean;
  message: string;
  event?:
    | "lesson_started"
    | "lesson_completed"
    | "all_lessons_completed"
    | "task_submitted"
    | "all_tasks_submitted"
    | "pre_test_completed"
    | "post_test_completed"
    | "assessment_completed";
  nextTab?: ClassroomTab;
  scorePercent?: number;
  passed?: boolean;
  assessmentType?: string;
  completedLessons?: number;
  totalLessons?: number;
  submittedTasks?: number;
  totalTasks?: number;
}

const tabs: Array<{ value: ClassroomTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "lessons", label: "บทเรียนออนไลน์", icon: BookOpenCheck },
  { value: "tests", label: "แบบทดสอบ", icon: FileQuestion },
  { value: "tasks", label: "ใบงาน/แบบฝึก", icon: ClipboardCheck },
  { value: "result", label: "ผลการเรียน", icon: Award },
];

const taskTypeLabels: Record<string, string> = {
  worksheet: "ใบงาน",
  practice: "แบบฝึกปฏิบัติ",
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function boundedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function requiredEvidenceCount(task: LearningTask) {
  if (task.evidenceRequiredCount > 0) return task.evidenceRequiredCount;
  return task.requireEvidence ? 1 : 0;
}

interface SelectedUploadFile {
  name: string;
  size: number;
}

interface SubmittedTaskFile {
  id: string;
  name: string;
  url: string;
}

interface TaskLinkItem {
  id: string;
  label: string;
  url?: string | null;
  kind?: "file" | "link" | "text";
}

function selectedUploadFiles(files: FileList | null): SelectedUploadFile[] {
  return Array.from(files ?? []).map((file) => ({
    name: file.name,
    size: file.size,
  }));
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}

function isSubmissionFileEvidence(evidence: LearnerTaskEvidence) {
  return evidence.evidenceText === learningSubmissionFileEvidenceMarker;
}

function taskEvidenceItems(task: LearningTask) {
  return task.submission?.evidences.filter((evidence) => !isSubmissionFileEvidence(evidence)) ?? [];
}

function taskSubmittedFiles(task: LearningTask): SubmittedTaskFile[] {
  const files = new Map<string, SubmittedTaskFile>();
  if (task.submission?.submittedFileUrl) {
    files.set(task.submission.submittedFileUrl, {
      id: `main-${task.submission.id}`,
      name: task.submission.submittedFileName ?? "ไฟล์งานที่ส่งล่าสุด",
      url: task.submission.submittedFileUrl,
    });
  }

  for (const evidence of task.submission?.evidences ?? []) {
    if (!isSubmissionFileEvidence(evidence) || !evidence.evidenceUrl) continue;
    files.set(evidence.evidenceUrl, {
      id: `evidence-${evidence.id}`,
      name: evidence.fileName ?? "ไฟล์งานเพิ่มเติม",
      url: evidence.evidenceUrl,
    });
  }

  return Array.from(files.values());
}

function taskScorePercent(task: LearningTask) {
  if (task.submission?.score === null || task.submission?.score === undefined || task.maxScore <= 0) return null;
  return Math.round((task.submission.score / task.maxScore) * 100);
}

function taskSubmissionItems(task: LearningTask): TaskLinkItem[] {
  const files: TaskLinkItem[] = taskSubmittedFiles(task).map((file) => ({
    id: file.id,
    label: file.name,
    url: file.url,
    kind: "file",
  }));

  if (task.submission?.submittedLinkUrl) {
    files.push({
      id: `link-${task.submission.id}`,
      label: "ลิงก์ผลงาน",
      url: task.submission.submittedLinkUrl,
      kind: "link",
    });
  }

  if (task.submission?.answerText && files.length === 0) {
    files.push({
      id: `answer-${task.submission.id}`,
      label: "มีคำตอบข้อความ",
      kind: "text",
    });
  }

  return files;
}

function taskEvidenceLinkItems(task: LearningTask): TaskLinkItem[] {
  return taskEvidenceItems(task).map((evidence, index) => ({
    id: `evidence-${evidence.id}`,
    label: evidence.fileName ?? evidence.evidenceText ?? evidence.evidenceUrl ?? `หลักฐาน ${index + 1}`,
    url: evidence.evidenceUrl,
    kind: evidence.evidenceUrl ? "file" : "text",
  }));
}

function taskAssessmentResult(task: LearningTask) {
  const status = task.submission?.status;
  const score = task.submission?.score;

  if (!task.submission) {
    return {
      label: "ยังไม่ประเมิน",
      className: "bg-slate-100 text-slate-700",
      actionNeeded: true,
    };
  }

  if (status === "pending_review" || status === "submitted") {
    return {
      label: "รอครูประเมิน",
      className: "bg-amber-100 text-amber-800",
      actionNeeded: false,
    };
  }

  if (status === "needs_revision") {
    return {
      label: "ต้องแก้ไข",
      className: "bg-rose-100 text-rose-800",
      actionNeeded: true,
    };
  }

  if (status === "not_passed") {
    return {
      label: "ไม่ผ่าน",
      className: "bg-rose-100 text-rose-800",
      actionNeeded: true,
    };
  }

  if (status === "passed" || status === "graded") {
    const passed = score === null || score === undefined ? true : score >= task.passingScore;
    return passed
      ? {
          label: "ผ่าน",
          className: "bg-emerald-100 text-emerald-800",
          actionNeeded: false,
        }
      : {
          label: "ไม่ผ่าน",
          className: "bg-rose-100 text-rose-800",
          actionNeeded: true,
        };
  }

  return {
    label: "ยังไม่ประเมิน",
    className: "bg-slate-100 text-slate-700",
    actionNeeded: true,
  };
}

function canPreviewUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://local.spc");
    const lowerPath = parsed.pathname.toLowerCase();
    return (
      parsed.hostname.includes("docs.google.com") ||
      parsed.hostname.includes("drive.google.com") ||
      /\.(pdf|png|jpg|jpeg|webp)$/i.test(lowerPath)
    );
  } catch {
    return false;
  }
}

function previewEmbedUrl(url: string) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes(".pdf") && !url.includes("#")) {
    return `${url}#toolbar=1&navpanes=0`;
  }
  return url;
}

function hasPracticeEmbed(html?: string | null) {
  const value = html?.trim();
  if (!value) return false;

  return /<(iframe|script|form|input|textarea|select|button|canvas|object|embed|video|audio)\b/i.test(value)
    || /\b(contenteditable|data-practice-workspace)\b/i.test(value);
}

function scoreLevel(percent: number | null | undefined) {
  if (percent === null || percent === undefined) {
    return {
      label: "ยังไม่มีคะแนน",
      message: "ทำแบบทดสอบเพื่อดูระดับผลลัพธ์และคำแนะนำ",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }
  if (percent >= 85) {
    return {
      label: "ยอดเยี่ยม",
      message: "เข้าใจเนื้อหาได้ดีมาก พร้อมต่อยอดสู่ใบประกาศ",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (percent >= 70) {
    return {
      label: "ดีมาก",
      message: "ผลการเรียนอยู่ในเกณฑ์ดี ทบทวนจุดที่พลาดอีกเล็กน้อย",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }
  if (percent >= 50) {
    return {
      label: "กำลังพัฒนา",
      message: "มีพื้นฐานแล้ว ควรทบทวนบทเรียนและลองทำอีกครั้ง",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    label: "ควรทบทวนเพิ่มเติม",
    message: "แนะนำให้กลับไปดูคลิป ใบความรู้ และฝึกทำโจทย์ก่อนสอบใหม่",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  };
}

function improvementLevel(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return {
      label: "รอเปรียบเทียบ",
      message: "ต้องมีทั้งคะแนนก่อนเรียนและหลังเรียนจึงจะเห็นพัฒนาการ",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }
  if (value >= 20) {
    return {
      label: "พัฒนาการโดดเด่น",
      message: "คะแนนหลังเรียนสูงขึ้นชัดเจน แสดงว่าการเรียนได้ผลดีมาก",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (value > 0) {
    return {
      label: "ดีขึ้น",
      message: "คะแนนหลังเรียนสูงกว่าก่อนเรียน เห็นความก้าวหน้าแล้ว",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }
  if (value === 0) {
    return {
      label: "คงที่",
      message: "คะแนนยังใกล้เคียงเดิม ลองทบทวนเฉพาะหัวข้อที่ยังไม่มั่นใจ",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    label: "ควรทบทวนซ้ำ",
    message: "คะแนนหลังเรียนลดลง แนะนำให้กลับไปดูบทเรียนแล้วทำแบบทดสอบอีกครั้ง",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  };
}

function taskStatus(status?: string | null) {
  if (status === "passed" || status === "graded") return { label: "ตรวจแล้ว", className: "bg-emerald-100 text-emerald-800" };
  if (status === "not_passed") return { label: "ตรวจแล้ว", className: "bg-rose-100 text-rose-800" };
  if (status === "pending_review" || status === "submitted") return { label: "รอตรวจ", className: "bg-amber-100 text-amber-800" };
  if (status === "needs_revision") return { label: "ต้องแก้ไข", className: "bg-rose-100 text-rose-800" };
  return { label: "ยังไม่ส่ง", className: "bg-slate-100 text-slate-700" };
}

function assessmentLabel(type: string) {
  if (type === "pre_test") return "ก่อนเรียน";
  if (type === "post_test") return "หลังเรียน";
  if (type === "quiz") return "Quiz";
  return "แบบวัดผล";
}

function youtubeEmbedUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function findPendingPreTest(assessments: LearningAssessmentOption[]) {
  return assessments.find(
    (assessment) =>
      assessment.type === "pre_test" &&
      assessment.status === "published" &&
      !assessment.bestAttempt &&
      (assessment.questions?.length ?? 0) > 0,
  ) ?? null;
}

function findReadyPostTest(assessments: LearningAssessmentOption[]) {
  return assessments.find(
    (assessment) =>
      assessment.type === "post_test" &&
      assessment.status === "published" &&
      (assessment.questions?.length ?? 0) > 0,
  ) ?? null;
}

export function LearnerClassroomWorkspace({
  data,
  adminPreview,
  initialNotice,
}: {
  data: LearnerClassroomData;
  adminPreview?: AdminPreviewContext;
  initialNotice?: ClassroomNotice;
}) {
  const router = useRouter();
  const initialPreTest = findPendingPreTest(data.assessments);
  const shouldShowWelcome = !adminPreview && Boolean(initialPreTest || initialNotice);
  const [activeTab, setActiveTab] = useState<ClassroomTab>(() => initialPreTest ? "tests" : "lessons");
  const [activeLessonId, setActiveLessonId] = useState(data.lessons[0]?.id ?? 0);
  const [assessmentModal, setAssessmentModal] = useState<LearningAssessmentOption | null>(null);
  const [activeTaskId, setActiveTaskId] = useState(
    () => data.tasks.find((task) => task.status === "published" && ["worksheet", "practice"].includes(task.taskType))?.id ?? 0,
  );
  const [notice, setNotice] = useState<ClassroomNotice | null>(() => shouldShowWelcome ? null : initialNotice ?? null);
  const [welcomeOpen, setWelcomeOpen] = useState(shouldShowWelcome);
  const [preTestPrompted, setPreTestPrompted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeLesson = useMemo(
    () => data.lessons.find((lesson) => lesson.id === activeLessonId) ?? data.lessons[0] ?? null,
    [activeLessonId, data.lessons],
  );
  const publishedAssessments = useMemo(
    () => data.assessments.filter((assessment) =>
      ["pre_test", "quiz", "post_test"].includes(assessment.type) && assessment.status === "published",
    ),
    [data.assessments],
  );
  const pendingPreTest = useMemo(() => findPendingPreTest(publishedAssessments), [publishedAssessments]);
  const readyPostTest = useMemo(() => findReadyPostTest(publishedAssessments), [publishedAssessments]);
  const lessonsComplete =
    data.summary.totalLessons === 0 ||
    data.summary.completedLessons >= data.summary.totalLessons;
  const taskGateOpen = lessonsComplete || Boolean(adminPreview);
  const lockedTaskCount = data.tasks.filter(
    (task) => task.status === "published" && ["worksheet", "practice"].includes(task.taskType),
  ).length;
  const publishedTasks = data.tasks.filter(
    (task) =>
      task.status === "published" &&
      (!["worksheet", "practice"].includes(task.taskType) || taskGateOpen),
  );
  const activeTask = publishedTasks.find((task) => task.id === activeTaskId) ?? publishedTasks[0] ?? null;

  function openPendingPreTest() {
    if (!pendingPreTest) return;
    setPreTestPrompted(true);
    setActiveTab("tests");
    setAssessmentModal(pendingPreTest);
  }

  function continueFromWelcome() {
    setWelcomeOpen(false);
    if (pendingPreTest && !preTestPrompted) {
      openPendingPreTest();
    } else if (!pendingPreTest) {
      setActiveTab("lessons");
    }
  }

  function openReadyPostTest() {
    if (!readyPostTest) return;
    setActiveTab("tests");
    setAssessmentModal(readyPostTest);
  }

  function handleNoticeAction(action: ClassroomNotice["action"]) {
    if (!action) {
      setNotice(null);
      return;
    }

    setNotice(null);
    if (action === "post_test") {
      openReadyPostTest();
      return;
    }
    setActiveTab(action);
    window.setTimeout(() => {
      document.getElementById("online-lesson-area")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function runAction(
    action: (formData: FormData) => Promise<ClassroomActionResult>,
    formData: FormData,
    closeModal?: "assessment",
    options?: { silentSuccess?: boolean },
  ) {
    const submittedAssessmentId = closeModal === "assessment" ? Number(formData.get("assessmentId")) : null;
    const submittedAssessment = submittedAssessmentId
      ? publishedAssessments.find((assessment) => assessment.id === submittedAssessmentId) ?? null
      : null;
    startTransition(async () => {
      const result = await action(formData);
      let nextNotice: ClassroomNotice | null = null;

      if (!result.ok) {
        nextNotice = {
          title: "ไม่สำเร็จ",
          message: result.message,
          variant: "error",
        };
      } else if (result.event === "all_lessons_completed") {
        nextNotice = {
          title: "ยอดเยี่ยม เรียนออนไลน์ครบแล้ว",
          message: `${result.message} (${result.completedLessons ?? data.summary.completedLessons}/${result.totalLessons ?? data.summary.totalLessons} บทเรียน)`,
          variant: "success",
          action: "tasks",
          actionLabel: "ไปทำใบงาน/แบบฝึก",
          secondaryLabel: "ทำภายหลัง",
        };
      } else if (result.event === "all_tasks_submitted") {
        nextNotice = {
          title: "ส่งงานครบแล้ว",
          message: readyPostTest
            ? `${result.message} (${result.submittedTasks ?? data.summary.submittedTasks}/${result.totalTasks ?? data.summary.totalTasks} งาน)`
            : "ส่งใบงาน/แบบฝึกครบแล้ว แต่ยังไม่พบ Post-test ที่พร้อมใช้งาน",
          variant: "success",
          action: readyPostTest ? "post_test" : "result",
          actionLabel: readyPostTest ? "ทำ Post-test ตอนนี้" : "ดูผลการเรียน",
          secondaryLabel: readyPostTest ? "ทำภายหลัง" : "ปิด",
        };
      } else if (result.event === "pre_test_completed") {
        nextNotice = {
          title: "บันทึก Pre-test แล้ว",
          message: `${result.message} ต่อไปเริ่มเรียนบทเรียนออนไลน์ได้เลย`,
          variant: "success",
          action: "lessons",
          actionLabel: "ไปบทเรียนออนไลน์",
          secondaryLabel: "ปิด",
        };
      } else if (result.event === "post_test_completed") {
        nextNotice = {
          title: result.passed ? "ยินดีด้วย ทำ Post-test ผ่านแล้ว" : "บันทึก Post-test แล้ว",
          message: `${result.message} ระบบจะแสดงผลการเรียนและความก้าวหน้าของคุณ`,
          variant: "success",
          action: "result",
          actionLabel: "ดูผลการเรียน",
          secondaryLabel: "ปิด",
        };
      } else if (!options?.silentSuccess) {
        nextNotice = {
          title: closeModal === "assessment" ? "ส่งคำตอบแล้ว" : "บันทึกสำเร็จ",
          message: result.message,
          variant: "success",
        };
      }

      if (result.ok) {
        if (closeModal === "assessment") {
          setAssessmentModal(null);
          if (result.event === "pre_test_completed" || submittedAssessment?.type === "pre_test") {
            setActiveTab("lessons");
            window.setTimeout(() => {
              document.getElementById("online-lesson-area")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 120);
          } else if (result.event === "post_test_completed") {
            setActiveTab("result");
          }
        }
        if (result.event === "all_lessons_completed") {
          setActiveTab("tasks");
        }
        if (result.event === "all_tasks_submitted") {
          setActiveTab("tests");
        }
        router.refresh();
      }
      if (nextNotice) setNotice(nextNotice);
    });
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4">
        {adminPreview && (
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">โหมดแอดมินทดสอบหน้าผู้เรียน</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  กำลังดูและทดสอบในนาม {adminPreview.learnerName} / {adminPreview.learnerEmail}
                </p>
              </div>
              {adminPreview.returnHref && (
                <Button variant="outline" size="sm" asChild>
                  <a href={adminPreview.returnHref}>กลับหลังบ้าน</a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        {!adminPreview && (
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-background to-amber-50/50 shadow-sm">
            <CardContent className="grid gap-3 p-3 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-sm shadow-primary/25">
                    <ListChecks className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-6">Flow การเรียน</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Pre-test → เรียนออนไลน์ → ใบงาน/แบบฝึก → Post-test → ใบประกาศ
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Pre-test", icon: FileQuestion },
                    { label: "เรียนออนไลน์", icon: BookOpenCheck },
                    { label: "ใบงาน/แบบฝึก", icon: ClipboardCheck },
                    { label: "Post-test", icon: BadgeCheck },
                    { label: "ใบประกาศ", icon: Trophy },
                  ].map((step, index) => (
                    <div key={step.label} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background/85 px-2.5 text-xs font-medium text-slate-700">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">{index + 1}</span>
                      <step.icon className="size-3.5 text-primary" />
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
                {pendingPreTest ? (
                  <Button size="sm" className="h-8 shrink-0 shadow-sm shadow-primary/20" onClick={openPendingPreTest}>
                    <FileQuestion className="size-4" />
                    ทำ Pre-test
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setActiveTab("lessons")}>
                    <BookOpenCheck className="size-4" />
                    ไปบทเรียน
                  </Button>
                )}
              </div>

              <div className="grid gap-2 rounded-lg border bg-background/80 px-3 py-2 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <Gauge className="size-4 shrink-0 text-primary" />
                  <span className="shrink-0 text-xs font-semibold">ความคืบหน้า</span>
                  <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${boundedPercent(data.summary.lessonProgressPercent)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">{formatPercent(data.summary.lessonProgressPercent)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 font-medium text-cyan-800">
                    <FileQuestion className="size-3.5" />
                    ก่อน/หลัง {formatPercent(data.summary.preTestScore)} / {formatPercent(data.summary.postTestScore)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
                    <ClipboardCheck className="size-3.5" />
                    งาน {data.summary.submittedTasks}/{data.summary.totalTasks}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                    <Award className="size-3.5" />
                    {data.summary.readyForCertificate ? "ใบประกาศพร้อม" : "ใบประกาศยังไม่พร้อม"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card id="online-lesson-area" className="overflow-hidden border-primary/20 shadow-sm">
          <CardHeader className="gap-4 border-b bg-gradient-to-r from-primary/10 via-cyan-50 to-amber-50/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-sm shadow-primary/25">
                  <BookOpenCheck className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl leading-8">ห้องเรียนออนไลน์</CardTitle>
                  <CardDescription className="mt-1 text-sm font-medium text-slate-700">{data.course.title}</CardDescription>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl border bg-background/85 p-1 shadow-xs sm:flex">
                {tabs.map((tab) => (
                  <Button
                    key={tab.value}
                    variant={activeTab === tab.value ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-10 justify-start rounded-lg px-3 font-semibold",
                      activeTab === tab.value
                        ? "shadow-sm shadow-primary/25"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    <tab.icon className="size-4" />
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "lessons" && (
              <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
                <div className="grid max-h-[430px] auto-rows-max content-start gap-3 overflow-y-auto rounded-xl border border-primary/10 bg-secondary/30 p-2 pr-2 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-220px)] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/35 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-primary/5">
                  {data.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      className={cn(
                        "group rounded-xl border bg-background p-4 text-left shadow-xs transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
                        activeLesson?.id === lesson.id ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/15" : "",
                      )}
                      onClick={() => setActiveLessonId(lesson.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold leading-6 group-hover:text-primary">{lesson.title}</p>
                        {lesson.progressStatus === "completed" ? (
                          <CheckCircle2 className="size-5 shrink-0 text-primary" />
                        ) : (
                          <PlayCircle className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{lesson.sectionTitle} / {lesson.durationMinutes} นาที</p>
                      <div className="mt-3 h-2 rounded-full bg-secondary">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, lesson.progressPercent ?? 0)}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
                {activeLesson && (
                  <LessonPanel
                    key={activeLesson.id}
                    lesson={activeLesson}
                    slug={data.course.slug}
                    adminPreviewEmail={adminPreview?.learnerEmail}
                    isPending={isPending}
                    onRunAction={(formData) => runAction(updateLessonProgressAction, formData, undefined, { silentSuccess: true })}
                  />
                )}
              </div>
            )}

            {activeTab === "tests" && (
              <div className="grid gap-4 md:grid-cols-2">
                {publishedAssessments.map((assessment) => (
                  <Card key={assessment.id} className="overflow-hidden border-primary/15 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                    <CardContent className="grid gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge>{assessmentLabel(assessment.type)}</Badge>
                          <h3 className="mt-3 text-lg font-semibold leading-7">{assessment.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            ใช้สอบ {assessment.questions?.length ?? assessment.sourceQuestionCount} จาก {assessment.sourceQuestionCount} ข้อ / ผ่าน {assessment.passingScore}%
                          </p>
                        </div>
                        {assessment.bestAttempt ? <Badge variant="secondary">{formatPercent(assessment.bestAttempt.maxScore ? ((assessment.bestAttempt.score ?? 0) / assessment.bestAttempt.maxScore) * 100 : 0)}</Badge> : <Badge variant="outline">ยังไม่ทำ</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {assessment.countsTowardCompletion ? "นำคะแนนไปใช้ตัดสินผลหลักสูตร" : "ใช้วัดพื้นฐานและเทียบความก้าวหน้า ไม่ตัดสินผลผ่าน"}
                      </p>
                      <Button
                        className="h-11 justify-center text-base shadow-sm shadow-primary/20"
                        onClick={() => setAssessmentModal(assessment)}
                        disabled={!assessment.questions?.length}
                      >
                        <FileQuestion className="size-4" />
                        {assessment.bestAttempt ? "ทำอีกครั้ง/ดูชุดข้อสอบ" : "เริ่มทำแบบทดสอบ"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "tasks" && (
              <TaskWorkbench
                tasks={publishedTasks}
                activeTask={activeTask}
                activeTaskId={activeTask?.id ?? 0}
                taskGateOpen={taskGateOpen}
                lockedTaskCount={lockedTaskCount}
                completedLessons={data.summary.completedLessons}
                totalLessons={data.summary.totalLessons}
                slug={data.course.slug}
                adminPreviewEmail={adminPreview?.learnerEmail}
                isPending={isPending}
                onSelectTask={setActiveTaskId}
                onSubmit={(formData) => runAction(submitLearningTaskAction, formData)}
              />
            )}

            {activeTab === "result" && <ResultPanel data={data} />}
          </CardContent>
        </Card>
      </section>

      <AdminActionModal
        open={welcomeOpen}
        title="ยินดีต้อนรับเข้าสู่ห้องเรียนออนไลน์"
        description={pendingPreTest ? "ระบบจะพาไปทำแบบทดสอบก่อนเรียนเป็นลำดับแรก เพื่อใช้เปรียบเทียบความก้าวหน้าหลังเรียน" : "ตรวจสอบลำดับการเรียน แล้วเริ่มเรียนบทเรียนออนไลน์ได้ทันที"}
        size="lg"
        onOpenChange={(open) => {
          if (!open) continueFromWelcome();
        }}
      >
        <div className="grid gap-5">
          {initialNotice && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-primary">
              <p className="font-semibold">{initialNotice.title}</p>
              <p className="mt-1 text-primary/80">{initialNotice.message}</p>
            </div>
          )}
          <div className="grid gap-3 rounded-xl border bg-secondary/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ListChecks className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Flow การเรียนหลักสูตรนี้</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  ทำตามลำดับนี้จะช่วยให้ระบบวัดผล เก็บความก้าวหน้า และตรวจสิทธิ์ออกใบประกาศได้ถูกต้อง
                </p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              {[
                "ทำ Pre-test",
                "เรียนคลิป/ใบความรู้",
                "ส่งใบงาน/แบบฝึก",
                "ทำ Post-test",
                "รับใบประกาศ",
              ].map((step, index) => (
                <div key={step} className="rounded-lg border bg-background p-3 text-center text-sm">
                  <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
          {pendingPreTest ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">ลำดับแรก: {pendingPreTest.title}</p>
              <p className="mt-1">
                แบบทดสอบก่อนเรียนไม่นำไปตัดสินผลผ่านหลักสูตร แต่ใช้เป็นข้อมูลเปรียบเทียบความก้าวหน้าหลังเรียน
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-primary">
              คุณทำ Pre-test แล้ว หรือหลักสูตรนี้ยังไม่มี Pre-test ที่ต้องทำ สามารถเริ่มเรียนบทเรียนออนไลน์ได้เลย
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={continueFromWelcome}>
              {pendingPreTest ? "เริ่มทำแบบทดสอบก่อนเรียน" : "เริ่มเรียนบทแรก"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </AdminActionModal>

      <AssessmentModal
        assessment={assessmentModal}
        slug={data.course.slug}
        adminPreviewEmail={adminPreview?.learnerEmail}
        isPending={isPending}
        onClose={() => setAssessmentModal(null)}
        onSubmit={(formData) => runAction(submitAssessmentAttemptAction, formData, "assessment")}
      />
      <AdminActionModal
        open={Boolean(notice)}
        title={notice?.title ?? ""}
        description={notice?.message}
        onOpenChange={() => setNotice(null)}
      >
        <div className={cn("rounded-lg border p-4 text-sm", notice?.variant === "error" ? "border-destructive/30 bg-destructive/10" : "border-primary/20 bg-primary/5")}>
          {notice?.message}
        </div>
        {notice?.action && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNotice(null)}>
              {notice.secondaryLabel ?? "ทำภายหลัง"}
            </Button>
            <Button type="button" onClick={() => handleNoticeAction(notice.action)}>
              {notice.actionLabel ?? "ไปต่อ"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </AdminActionModal>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="border-primary/15 bg-gradient-to-br from-background to-primary/5 py-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="size-7" />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LessonPanel({
  lesson,
  slug,
  adminPreviewEmail,
  isPending,
  onRunAction,
}: {
  lesson: LearningLesson;
  slug: string;
  adminPreviewEmail?: string;
  isPending: boolean;
  onRunAction: (formData: FormData) => void;
}) {
  const embedUrl = youtubeEmbedUrl(lesson.videoUrl);
  const [playerStarted, setPlayerStarted] = useState(false);
  const started =
    playerStarted ||
    lesson.progressStatus === "in_progress" ||
    lesson.progressStatus === "completed";

  const markStartedFromPlayer = () => {
    if (started || isPending) return;
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("lessonId", String(lesson.id));
    formData.set("intent", "start");
    if (adminPreviewEmail) formData.set("learnerEmail", adminPreviewEmail);
    setPlayerStarted(true);
    onRunAction(formData);
  };

  const youtubeUrl =
    embedUrl && playerStarted
      ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`
      : embedUrl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-cyan-50 to-background p-4 shadow-sm">
        <div className="min-w-0 self-stretch">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{lesson.sectionTitle}</Badge>
            <Badge variant="outline">{lesson.durationMinutes} นาที</Badge>
            {lesson.progressStatus === "completed" && <Badge>เรียนจบแล้ว</Badge>}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="rounded-lg bg-primary p-2 text-primary-foreground">
              <PlayCircle className="size-5" />
            </div>
            <h3 className="text-xl font-semibold leading-8 [overflow-wrap:anywhere]">{lesson.title}</h3>
          </div>
          {lesson.description && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{lesson.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2 self-stretch">
          <form className="self-start" action={(formData) => onRunAction(formData)}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="intent" value="start" />
            {adminPreviewEmail && <input type="hidden" name="learnerEmail" value={adminPreviewEmail} />}
            <Button
              className="w-full border-primary/30 bg-background text-primary shadow-xs hover:bg-primary/10 sm:w-auto"
              type="submit"
              variant="outline"
              disabled={isPending || started}
            >
              <PlayCircle className="size-4" />
              บันทึกว่าเริ่มเรียน
            </Button>
          </form>
          <form className="self-start" action={(formData) => onRunAction(formData)}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="intent" value="complete" />
            {adminPreviewEmail && <input type="hidden" name="learnerEmail" value={adminPreviewEmail} />}
            <Button className="w-full shadow-sm shadow-primary/20 sm:w-auto" type="submit" disabled={isPending}>
              <CheckCircle2 className="size-4" />
              บันทึกว่าเรียนจบ
            </Button>
          </form>
        </div>
      </div>
      <div className="aspect-video overflow-hidden rounded-lg border bg-slate-950 text-white">
        {embedUrl && !started ? (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-4 text-center transition hover:bg-slate-900"
            disabled={isPending}
            onClick={markStartedFromPlayer}
          >
            <PlayCircle className="size-16 text-primary" />
            <span className="text-lg font-semibold">เล่นวิดีโอและเริ่มเรียน</span>
            <span className="max-w-md text-sm leading-6 text-slate-300">
              ระบบจะบันทึกสถานะเริ่มเรียนทันทีเมื่อกดเล่นวิดีโอ
            </span>
          </button>
        ) : embedUrl ? (
          <iframe className="h-full w-full" src={youtubeUrl ?? embedUrl} title={lesson.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : lesson.videoUrl ? (
          <video className="h-full w-full" src={lesson.videoUrl} controls onPlay={markStartedFromPlayer} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <PlayCircle className="size-16 text-primary" />
            <p className="mt-4 font-semibold">ยังไม่ได้ใส่คลิปสำหรับบทเรียนนี้</p>
          </div>
        )}
      </div>
      <div className="grid gap-3">
        <p className="font-medium">ใบความรู้และไฟล์ประกอบ</p>
        {lesson.resources.length ? lesson.resources.map((resource) => (
          <a key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-secondary" href={resource.fileUrl} target="_blank" rel="noreferrer">
            <span className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block font-medium">{resource.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{resource.fileName ?? resource.fileUrl}</span>
              </span>
            </span>
            <Download className="size-4 shrink-0" />
          </a>
        )) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">ยังไม่มีไฟล์ประกอบ</p>}
      </div>
    </div>
  );
}

interface AssessmentModalProps {
  assessment: LearningAssessmentOption | null;
  slug: string;
  adminPreviewEmail?: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}

function AssessmentModal(props: AssessmentModalProps) {
  if (!props.assessment) return null;
  return <AssessmentModalContent key={props.assessment.id} {...props} assessment={props.assessment} />;
}

function AssessmentModalContent({
  assessment,
  slug,
  adminPreviewEmail,
  isPending,
  onClose,
  onSubmit,
}: AssessmentModalProps & { assessment: LearningAssessmentOption }) {
  const formRef = useRef<HTMLFormElement>(null);
  const autoSubmittedRef = useRef(false);
  const questions = useMemo(() => assessment.questions ?? [], [assessment.questions]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() => (assessment.timeLimitMinutes ?? 0) * 60);

  const currentQuestion = questions[currentIndex] ?? null;
  const hasTimeLimit = Number(assessment.timeLimitMinutes ?? 0) > 0;
  const totalSeconds = hasTimeLimit ? Number(assessment.timeLimitMinutes) * 60 : 0;
  const answeredCount = questions.filter((question) => (selectedOptions[question.id] ?? []).length > 0).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const canSubmitAssessment = questions.length > 0 && (unansweredCount === 0 || (hasTimeLimit && remainingSeconds === 0));
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const questionProgressPercent = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const timerPercent = hasTimeLimit && totalSeconds > 0 ? Math.round((remainingSeconds / totalSeconds) * 100) : 100;
  const isLastQuestion = currentIndex >= questions.length - 1;
  const formId = `assessment-form-${assessment.id}`;

  useEffect(() => {
    if (!hasTimeLimit || isPending || questions.length === 0) return;
    const timerId = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [hasTimeLimit, isPending, questions.length]);

  useEffect(() => {
    if (!hasTimeLimit || remainingSeconds > 0 || autoSubmittedRef.current || questions.length === 0) return;
    autoSubmittedRef.current = true;
    formRef.current?.requestSubmit();
  }, [hasTimeLimit, questions.length, remainingSeconds]);

  function handleOptionSelect(optionId: number) {
    if (!currentQuestion || isPending) return;
    const isMultipleChoice = currentQuestion.questionType === "multiple_choice";
    setSelectedOptions((current) => {
      const selectedForQuestion = current[currentQuestion.id] ?? [];
      const nextSelected = isMultipleChoice
        ? selectedForQuestion.includes(optionId)
          ? selectedForQuestion.filter((selectedId) => selectedId !== optionId)
          : [...selectedForQuestion, optionId]
        : [optionId];
      return {
        ...current,
        [currentQuestion.id]: nextSelected,
      };
    });

    if (!isMultipleChoice && !isLastQuestion) {
      window.setTimeout(() => {
        setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
      }, 220);
    }
  }

  function goToQuestion(index: number) {
    setCurrentIndex(Math.max(0, Math.min(index, questions.length - 1)));
  }

  return (
    <AdminActionModal
      open
      title={assessment.title}
      description={assessment.countsTowardCompletion ? "คะแนนชุดนี้นำไปใช้ตัดสินผลหลักสูตร" : "ชุดนี้ใช้วัดพื้นฐานก่อนเรียน ไม่นำไปตัดสินผล"}
      size="lg"
      footer={(
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {hasTimeLimit && remainingSeconds === 0
              ? "หมดเวลา ระบบกำลังส่งคำตอบให้อัตโนมัติ"
              : unansweredCount > 0
                ? `ยังเหลือ ${unansweredCount} ข้อก่อนส่งคำตอบ`
                : "ตอบครบแล้ว สามารถส่งคำตอบได้"}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0 || isPending}>
              <ArrowLeft className="size-4" />
              ก่อนหน้า
            </Button>
            <Button type="button" variant="outline" onClick={() => goToQuestion(currentIndex + 1)} disabled={isLastQuestion || isPending}>
              ถัดไป
              <ArrowRight className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              <X className="size-4" />
              ปิด
            </Button>
            <Button type="submit" form={formId} disabled={isPending || !canSubmitAssessment}>
              <Send className="size-4" />
              ส่งคำตอบ
            </Button>
          </div>
        </div>
      )}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        id={formId}
        ref={formRef}
        className="grid gap-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="assessmentId" value={assessment.id} />
        {adminPreviewEmail && <input type="hidden" name="learnerEmail" value={adminPreviewEmail} />}
        {questions.map((question) => (
          <input key={`visible-${question.id}`} type="hidden" name="visibleQuestionId" value={question.id} />
        ))}
        {questions.map((question) =>
          (selectedOptions[question.id] ?? []).map((optionId) => (
            <input key={`answer-${question.id}-${optionId}`} type="hidden" name={`question_${question.id}`} value={optionId} />
          )),
        )}

        <div className="grid gap-3 rounded-lg border bg-secondary/30 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{assessmentLabel(assessment.type)}</Badge>
              <Badge variant="outline">{questions.length} ข้อ</Badge>
              <Badge variant="outline">ผ่าน {assessment.passingScore}%</Badge>
              {assessment.maxAttempts ? <Badge variant="outline">ทำได้ {assessment.maxAttempts} ครั้ง</Badge> : null}
            </div>
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
              hasTimeLimit && remainingSeconds <= 60
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-primary/20 bg-primary/10 text-primary",
            )}>
              <Clock3 className="size-4" />
              {hasTimeLimit ? formatTimer(remainingSeconds) : "ไม่จำกัดเวลา"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ตอบแล้ว {answeredCount}/{questions.length} ข้อ</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          {hasTimeLimit && (
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className={cn("h-full rounded-full transition-all", remainingSeconds <= 60 ? "bg-rose-500" : "bg-emerald-500")}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          )}
        </div>

        {currentQuestion ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              {questions.map((question, index) => {
                const answered = (selectedOptions[question.id] ?? []).length > 0;
                const active = index === currentIndex;
                return (
                  <button
                    key={question.id}
                    type="button"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border text-sm font-semibold transition",
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary",
                      answered && !active ? "border-primary/30 bg-primary/10 text-primary" : "",
                    )}
                    onClick={() => goToQuestion(index)}
                    aria-label={`ไปข้อที่ ${index + 1}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ข้อที่ {currentIndex + 1} จาก {questions.length}</p>
                  <h3 className="mt-2 text-lg font-semibold leading-7">{currentQuestion.questionText}</h3>
                </div>
                <Badge variant="outline">{currentQuestion.score} คะแนน</Badge>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${questionProgressPercent}%` }} />
              </div>

              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = (selectedOptions[currentQuestion.id] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex min-h-14 items-start gap-3 rounded-lg border p-4 text-left text-sm leading-6 transition hover:border-primary/50 hover:bg-primary/5",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "bg-background",
                      )}
                      onClick={() => handleOptionSelect(option.id)}
                    >
                      <span className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                      )}>
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span className="min-w-0 flex-1">{option.optionText}</span>
                      {isSelected && <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {currentQuestion.questionType === "multiple_choice" && (
                <p className="mt-3 text-xs text-muted-foreground">ข้อนี้เลือกได้มากกว่า 1 คำตอบ กดถัดไปเมื่อเลือกครบแล้ว</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีคำถามในแบบทดสอบนี้
          </div>
        )}
      </form>
    </AdminActionModal>
  );
}

interface TaskWorkbenchProps {
  tasks: LearningTask[];
  activeTask: LearningTask | null;
  activeTaskId: number;
  taskGateOpen: boolean;
  lockedTaskCount: number;
  completedLessons: number;
  totalLessons: number;
  slug: string;
  adminPreviewEmail?: string;
  isPending: boolean;
  onSelectTask: (taskId: number) => void;
  onSubmit: (formData: FormData) => void;
}

function TaskWorkbench({
  tasks,
  activeTask,
  activeTaskId,
  taskGateOpen,
  lockedTaskCount,
  completedLessons,
  totalLessons,
  slug,
  adminPreviewEmail,
  isPending,
  onSelectTask,
  onSubmit,
}: TaskWorkbenchProps) {
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  function openTaskWorkspace(taskId: number) {
    onSelectTask(taskId);
    setTaskModalOpen(true);
  }

  return (
    <div className="grid gap-5">
      <section className="grid content-start gap-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-amber-50/50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-sm shadow-primary/25">
            <PanelLeft className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">ใบงานและแบบฝึก</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              คลิกใบงานเพื่อเปิดหน้าทำงานแบบเต็มจอ อ่านโจทย์ ส่งหลักฐาน และติดตามผลตรวจ
            </p>
          </div>
        </div>

        {!taskGateOpen && lockedTaskCount > 0 && (
          <div className="rounded-lg border bg-background p-3 text-sm leading-6 text-muted-foreground">
            ใบงานและแบบฝึกปฏิบัติจะปลดล็อกหลังจากเรียนบทเรียนออนไลน์ครบทั้งหมดแล้ว
            ตอนนี้เรียนจบแล้ว {completedLessons}/{totalLessons} บทเรียน
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="rounded-lg border bg-background p-5 text-center text-sm leading-6 text-muted-foreground">
            {taskGateOpen
              ? "ยังไม่มีใบงานหรือแบบฝึกที่เปิดให้ส่ง"
              : "ใบงานและแบบฝึกยังถูกล็อกจนกว่าจะเรียนบทเรียนออนไลน์ครบ"}
          </div>
        ) : (
          <div className="max-h-[620px] overflow-auto rounded-xl border border-primary/15 bg-background shadow-xs">
            <Table className="min-w-[840px]">
              <TableHeader className="sticky top-0 z-10 bg-cyan-50/95 backdrop-blur">
                <TableRow className="hover:bg-cyan-50/95">
                  <TableHead className="w-14 text-center">ลำดับ</TableHead>
                  <TableHead className="min-w-[250px]">ใบงาน/แบบฝึก</TableHead>
                  <TableHead className="w-[86px]">สถานะ</TableHead>
                  <TableHead className="w-[115px]">ส่งงาน</TableHead>
                  <TableHead className="w-[120px]">หลักฐาน</TableHead>
                  <TableHead className="w-[95px]">คะแนน</TableHead>
                  <TableHead className="w-[130px] text-right">ผลประเมิน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task, index) => {
                  const status = taskStatus(task.submission?.status);
                  const scorePercent = taskScorePercent(task);
                  const evidenceTarget = requiredEvidenceCount(task);
                  const evidenceItems = taskEvidenceLinkItems(task);
                  const evidenceCount = evidenceItems.length;
                  const submissionItems = taskSubmissionItems(task);
                  const assessmentResult = taskAssessmentResult(task);
                  const active = activeTaskId === task.id;
                  const evidenceReady = evidenceTarget === 0 || evidenceCount >= evidenceTarget;
                  const submittedAt = task.submission?.submittedAt ? formatDateTime(task.submission.submittedAt) : "-";

                  return (
                    <TableRow
                      key={task.id}
                      className={cn(
                        "group cursor-default hover:bg-primary/5",
                        active ? "border-primary/30 bg-primary/10 hover:bg-primary/10" : "",
                      )}
                    >
                      <TableCell className="py-2 text-center align-top font-semibold text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="min-w-[250px] whitespace-normal py-2 align-top">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
                            <ClipboardCheck className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={task.taskType === "practice" ? "default" : "secondary"}>
                                {taskTypeLabels[task.taskType]}
                              </Badge>
                              {active && <Badge variant="outline">กำลังเลือก</Badge>}
                            </div>
                            <p className="mt-2 line-clamp-2 font-semibold leading-6 group-hover:text-primary">
                              {task.title}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="w-[115px] whitespace-normal py-2 align-top">
                        <TaskLinkList items={submissionItems} emptyLabel="ยังไม่ส่งไฟล์" />
                        {task.submission && (
                          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                            ส่งล่าสุด {submittedAt}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="w-[120px] whitespace-normal py-2 align-top">
                        <TaskLinkList items={evidenceItems} emptyLabel="ยังไม่มีหลักฐาน" />
                        <Badge className="mt-1" variant={evidenceReady ? "default" : "outline"}>
                          {evidenceTarget > 0 ? `${evidenceCount}/${evidenceTarget}` : `${evidenceCount} รายการ`}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <div className="grid gap-1 text-sm">
                          <span className="font-medium">
                            {task.submission?.score !== null && task.submission?.score !== undefined
                              ? `${task.submission.score}/${task.maxScore}`
                              : "-"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {scorePercent !== null ? `${scorePercent}%` : `เต็ม ${task.maxScore} / ผ่าน ${task.passingScore}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right align-top">
                        <div className="inline-flex min-w-0 flex-col items-end gap-2">
                          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", assessmentResult.className)}>
                            {assessmentResult.label}
                          </span>
                          {assessmentResult.actionNeeded && (
                            <Button
                              className="h-8 shadow-sm shadow-primary/20"
                              size="sm"
                              onClick={() => openTaskWorkspace(task.id)}
                            >
                              <ExternalLink className="size-4" />
                              ทำใบงาน
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <TaskWorkspaceModal
        open={Boolean(activeTask && taskModalOpen)}
        task={activeTask}
        slug={slug}
        adminPreviewEmail={adminPreviewEmail}
        isPending={isPending}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function TaskLinkList({
  items,
  emptyLabel,
}: {
  items: TaskLinkItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  const visibleItems = items.slice(0, 2);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="grid gap-1 text-xs">
      {visibleItems.map((item) => {
        const Icon = item.kind === "link" ? Link2 : Paperclip;
        const content = (
          <>
            <Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{item.label}</span>
          </>
        );

        return item.url ? (
          <a
            key={item.id}
            className="inline-flex max-w-[112px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-primary hover:bg-primary/10 hover:underline"
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title={item.label}
          >
            {content}
          </a>
        ) : (
          <span
            key={item.id}
            className="inline-flex max-w-[112px] items-center gap-1.5 rounded-full border bg-secondary/50 px-2 py-1 text-muted-foreground"
            title={item.label}
          >
            {content}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="text-[11px] text-muted-foreground">+{hiddenCount} รายการ</span>
      )}
    </div>
  );
}

function TaskWorkspaceModal({
  open,
  task,
  slug,
  adminPreviewEmail,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  task: LearningTask | null;
  slug: string;
  adminPreviewEmail?: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !task) return null;

  const status = taskStatus(task.submission?.status);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section aria-modal="true" role="dialog" className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b bg-gradient-to-r from-primary/10 via-cyan-50 to-background px-4 py-3 shadow-sm md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm shadow-primary/25">
              <ClipboardCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={task.taskType === "practice" ? "default" : "secondary"}>
                  {taskTypeLabels[task.taskType]}
                </Badge>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>{status.label}</span>
              </div>
              <h2 className="mt-2 truncate text-lg font-semibold md:text-xl">{task.title}</h2>
            </div>
          </div>
          <Button className="border-primary/30 bg-background shadow-xs hover:bg-primary/10" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            ปิด
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/25 p-3 md:p-5">
          <TaskWorkspacePanel
            key={task.id}
            task={task}
            slug={slug}
            adminPreviewEmail={adminPreviewEmail}
            isPending={isPending}
            onSubmit={onSubmit}
          />
        </div>
      </section>
    </div>
  );
}

function TaskWorkspacePanel({
  task,
  slug,
  adminPreviewEmail,
  isPending,
  onSubmit,
}: {
  task: LearningTask;
  slug: string;
  adminPreviewEmail?: string;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const status = taskStatus(task.submission?.status);
  const evidenceTarget = requiredEvidenceCount(task);
  const evidenceItems = taskEvidenceItems(task);
  const submittedFiles = taskSubmittedFiles(task);
  const evidenceCount = evidenceItems.length;
  const scorePercent = taskScorePercent(task);
  const promptPreviewUrl = task.instructionFileUrl && canPreviewUrl(task.instructionFileUrl)
    ? task.instructionFileUrl
    : null;
  const instructionHtml = task.instructionHtml?.trim() ? task.instructionHtml : "";
  const hasInstructionHtml = Boolean(instructionHtml);
  const showPracticeWorkspace = hasPracticeEmbed(instructionHtml);
  const hasSupportingFiles = Boolean(task.instructionFileUrl) || task.attachments.length > 0;
  const [selectedSubmissionFiles, setSelectedSubmissionFiles] = useState<SelectedUploadFile[]>([]);
  const [selectedEvidenceFiles, setSelectedEvidenceFiles] = useState<SelectedUploadFile[]>([]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(430px,1fr)] 2xl:grid-cols-[minmax(0,2fr)_minmax(520px,1fr)]">
        <div className="grid content-start gap-4">
          <section className="overflow-hidden rounded-xl border border-primary/20 bg-background shadow-sm">
            <div className="border-b bg-gradient-to-r from-primary/10 via-cyan-50 to-background p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="rounded-lg bg-primary p-2 text-primary-foreground">
                    <ListChecks className="size-4" />
                  </div>
                  <Badge>{taskTypeLabels[task.taskType]}</Badge>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>
                    {status.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">ใบงาน/แบบฝึกปฏิบัติ</p>
                    <h3 className="truncate text-base font-semibold leading-6">{task.title}</h3>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  {promptPreviewUrl && (
                    <Button className="border-primary/30 bg-background shadow-xs hover:bg-primary/10" variant="outline" size="sm" asChild>
                      <a href={promptPreviewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        เปิดเต็มหน้า
                      </a>
                    </Button>
                  )}
                  <Badge variant="outline">เต็ม {task.maxScore}</Badge>
                  <Badge variant="outline">ผ่าน {task.passingScore}</Badge>
                </div>
              </div>
            </div>

            {promptPreviewUrl ? (
              <iframe
                className="h-[calc(100dvh-176px)] min-h-[560px] max-h-[820px] w-full bg-background"
                src={previewEmbedUrl(promptPreviewUrl)}
                title={`ใบงาน ${task.title}`}
              />
            ) : hasInstructionHtml && !showPracticeWorkspace ? (
              <div className="max-h-[720px] min-h-[520px] overflow-auto bg-white p-6 text-sm leading-7 [overflow-wrap:anywhere] [&_*]:max-w-full">
                <div dangerouslySetInnerHTML={{ __html: instructionHtml }} />
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center bg-secondary/20 p-8 text-center text-sm leading-6 text-muted-foreground">
                <div>
                  <FileText className="mx-auto mb-3 size-10 text-primary" />
                  ครูยังไม่ได้เพิ่มไฟล์หรือโจทย์ใบงาน รายละเอียดของงานจะแสดงจากคำอธิบายด้านบนแทน
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex flex-wrap gap-2">
              {task.sectionTitle && <Badge variant="outline">{task.sectionTitle}</Badge>}
              {task.lessonTitle && <Badge variant="outline">{task.lessonTitle}</Badge>}
              {task.instructionFileUrl && <Badge variant="outline">PDF ใบงาน</Badge>}
              {hasInstructionHtml && <Badge variant="outline">{showPracticeWorkspace ? "HTML ฝึกปฏิบัติ" : "HTML"}</Badge>}
              {scorePercent !== null && <Badge variant="outline">คะแนนล่าสุด {scorePercent}%</Badge>}
            </div>
            {task.description && (
              <p className="mt-3 text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p>
            )}
          </section>

          {hasSupportingFiles && (
            <section className="rounded-xl border border-primary/15 bg-background p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Paperclip className="size-5" />
                </div>
                <h4 className="text-base font-semibold">ไฟล์ประกอบและดาวน์โหลด</h4>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {task.instructionFileUrl && (
                  <TaskResourceLink
                    href={task.instructionFileUrl}
                    title={task.instructionFileName ?? "ไฟล์คำสั่งงาน"}
                    description="ไฟล์คำสั่งงานหลัก"
                    icon={FileText}
                  />
                )}
                {task.attachments.map((attachment) => (
                  <TaskResourceLink
                    key={attachment.id}
                    href={attachment.fileUrl}
                    title={attachment.title}
                    description={attachment.fileName ?? attachment.fileType}
                    icon={FileText}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-primary/15 bg-background p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardCheck className="size-5" />
              </div>
              <h4 className="text-base font-semibold">เกณฑ์ตรวจงาน</h4>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {task.rubrics.length ? task.rubrics.map((rubric) => (
                <div key={rubric.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{rubric.title}</p>
                    <Badge variant="outline">{rubric.maxScore} คะแนน</Badge>
                  </div>
                  {rubric.description && <p className="mt-2 leading-6 text-muted-foreground">{rubric.description}</p>}
                </div>
              )) : (
                <p className="rounded-lg border p-4 text-sm text-muted-foreground">ครูยังไม่ได้กำหนด rubric แยกรายข้อ</p>
              )}
            </div>
          </section>
        </div>

        <div className="grid content-start gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-118px)] xl:overflow-y-auto xl:pr-1">
          {showPracticeWorkspace && (
            <section
              data-practice-workspace="true"
              className="rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-background to-emerald-50/80 p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-cyan-100 p-2 text-primary shadow-xs">
                      <Link2 className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold">พื้นที่ปฏิบัติ</h4>
                      <p className="text-xs text-muted-foreground">แบบฝึกที่ฝังด้วย HTML</p>
                    </div>
                  </div>
                  <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">HTML</Badge>
                </div>
                <div className="overflow-hidden rounded-xl border border-cyan-200 bg-background shadow-xs">
                  <iframe
                    className="h-[340px] w-full bg-background"
                    srcDoc={instructionHtml}
                    title={`พื้นที่ปฏิบัติ ${task.title}`}
                    sandbox="allow-forms allow-scripts allow-popups allow-downloads"
                  />
                </div>
              </div>
            </section>
          )}

          <form
            className="grid gap-4 rounded-2xl border border-primary/20 bg-background p-4 shadow-sm ring-1 ring-primary/5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              onSubmit(new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="taskId" value={task.id} />
            {adminPreviewEmail && <input type="hidden" name="learnerEmail" value={adminPreviewEmail} />}

            <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/10 via-cyan-50 to-emerald-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm shadow-primary/25">
                    <Send className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold">ส่งงาน</h4>
                    <p className="mt-1 text-sm text-muted-foreground">ส่งลิงก์ แนบไฟล์ หรือสรุปขั้นตอนที่ทำ</p>
                  </div>
                </div>
                <span className={cn("w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>{status.label}</span>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-sky-200/80 bg-sky-50/60 p-3">
              <label className="grid gap-2 text-sm font-medium">
                ลิงก์ผลงาน
                <Input name="submittedLinkUrl" defaultValue={task.submission?.submittedLinkUrl ?? ""} placeholder="https://..." />
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm font-medium">
                  <span>ไฟล์ผลงาน</span>
                  <Badge className="bg-sky-600 text-white hover:bg-sky-600">เลือกได้หลายไฟล์</Badge>
                </div>
                <UploadField
                  name="submissionFile"
                  label="อัปโหลดไฟล์งาน"
                  description="PDF, Word, Excel, PowerPoint, ZIP/RAR หรือรูปภาพ ไฟล์ละไม่เกิน 30 MB"
                  multiple
                  accept={learnerUploadAccept}
                  allowedExtensions={learnerUploadExtensions}
                  maxBytes={learnerUploadMaxBytes}
                  className="border-sky-200 bg-background/80"
                  data-testid="submission-file-input"
                  onChange={(event) => setSelectedSubmissionFiles(selectedUploadFiles(event.currentTarget.files))}
                />
                <SelectedFileList files={selectedSubmissionFiles} emptyText="ยังไม่ได้เลือกไฟล์งาน" />
              </div>
            </div>

            <label className="grid gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-sm font-medium">
              คำตอบ/ขั้นตอนที่ทำ
              <textarea
                name="answerText"
                className="min-h-24 rounded-md border bg-background p-3 text-sm leading-6 [overflow-wrap:anywhere]"
                defaultValue={task.submission?.answerText ?? ""}
                placeholder="สรุปวิธีทำ ปัญหาที่พบ หรือคำตอบตามใบงาน"
              />
            </label>

            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">หลักฐานการปฏิบัติ</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {evidenceTarget > 0
                      ? `ต้องมีอย่างน้อย ${evidenceTarget} รายการ`
                      : "เพิ่มหลักฐานประกอบได้"}
                  </p>
                </div>
                {evidenceTarget > 0 && (
                  <Badge variant={evidenceCount >= evidenceTarget ? "default" : "outline"}>
                    {evidenceCount}/{evidenceTarget}
                  </Badge>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm font-medium">
                    <span>ไฟล์หลักฐาน</span>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">เลือกได้หลายไฟล์</Badge>
                  </div>
                  <UploadField
                    name="evidenceFiles"
                    label="อัปโหลดไฟล์หลักฐาน"
                    description="ภาพหน้าจอ ไฟล์ประกอบ หรือหลักฐานระหว่างปฏิบัติ ไฟล์ละไม่เกิน 30 MB"
                    multiple
                    accept={learnerUploadAccept}
                    allowedExtensions={learnerUploadExtensions}
                    maxBytes={learnerUploadMaxBytes}
                    className="border-emerald-200 bg-background/80"
                    data-testid="evidence-file-input"
                    onChange={(event) => setSelectedEvidenceFiles(selectedUploadFiles(event.currentTarget.files))}
                  />
                  <SelectedFileList files={selectedEvidenceFiles} emptyText="ยังไม่ได้เลือกไฟล์หลักฐาน" />
                </div>
                <div className="grid gap-3 2xl:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    ลิงก์หลักฐาน
                    <Input name="evidenceUrl" placeholder="https://..." />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    หมายเหตุหลักฐาน
                    <Input name="evidenceText" placeholder="เช่น ภาพหน้าจอระหว่างทำงาน" />
                  </label>
                </div>
              </div>
            </div>

            <label className="grid gap-2 rounded-xl border bg-secondary/20 p-3 text-sm font-medium">
              หมายเหตุถึงครู
              <Input name="note" defaultValue={task.submission?.note ?? ""} placeholder="ข้อความเพิ่มเติมถึงผู้ตรวจงาน" />
            </label>

            {task.submission && (
              <div className="rounded-lg border p-4 text-sm leading-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">ส่งล่าสุด {formatDateTime(task.submission.submittedAt)}</Badge>
                  {task.submission.score !== null && task.submission.score !== undefined && (
                    <Badge variant="outline">คะแนน {task.submission.score}/{task.maxScore}</Badge>
                  )}
                </div>
                {submittedFiles.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    <p className="font-medium">ไฟล์งานที่ส่งแล้ว</p>
                    {submittedFiles.map((file) => (
                      <a
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-primary hover:bg-secondary/60 hover:underline"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <ExternalLink className="size-4 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
                {task.submission.feedback && <p className="mt-3 rounded-md bg-secondary/40 p-3">ข้อเสนอแนะ: {task.submission.feedback}</p>}
              </div>
            )}

            <Button className="h-11 text-base shadow-sm shadow-primary/20" type="submit" disabled={isPending}>
              <Send className="size-4" />
              {task.submission ? "ส่งแก้ไขงาน" : "ส่งงาน"}
            </Button>
          </form>

          <section className="rounded-xl border border-primary/15 bg-background p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileUp className="size-5" />
              </div>
              <h4 className="text-base font-semibold">หลักฐานที่บันทึกแล้ว</h4>
            </div>
            <div className="mt-4 grid gap-2">
              {evidenceItems.length ? evidenceItems.map((evidence) => (
                <div key={evidence.id} className="rounded-lg border p-3 text-sm leading-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{evidence.evidenceType}</Badge>
                    {evidence.evidenceUrl && (
                      <a className="text-primary hover:underline" href={evidence.evidenceUrl} target="_blank" rel="noreferrer">
                        เปิดหลักฐาน
                      </a>
                    )}
                  </div>
                  {evidence.fileName && <p className="mt-2 font-medium [overflow-wrap:anywhere]">{evidence.fileName}</p>}
                  {evidence.evidenceText && <p className="mt-2 text-muted-foreground">{evidence.evidenceText}</p>}
                </div>
              )) : (
                <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                  ยังไม่มีหลักฐานที่บันทึกไว้ เพิ่มหลักฐานได้พร้อมกับการส่งงาน
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SelectedFileList({ files, emptyText }: { files: SelectedUploadFile[]; emptyText: string }) {
  if (!files.length) {
    return (
      <div className="rounded-md border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border bg-background/85 p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-emerald-700">
        <span>ไฟล์ที่เลือก {files.length} ไฟล์</span>
        <span>พร้อมส่ง</span>
      </div>
      {files.map((file, index) => (
        <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-secondary/35 px-3 py-2 text-xs">
          <span className="min-w-0 truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
        </div>
      ))}
    </div>
  );
}

function TaskResourceLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description?: string | null;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <a className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-secondary" href={href} target="_blank" rel="noreferrer">
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block font-medium [overflow-wrap:anywhere]">{title}</span>
          {description && <span className="block truncate text-xs text-muted-foreground">{description}</span>}
        </span>
      </span>
      <Download className="size-4 shrink-0" />
    </a>
  );
}

function ResultPanel({ data }: { data: LearnerClassroomData }) {
  const postLevel = scoreLevel(data.summary.postTestScore);
  const progressLevel = improvementLevel(data.summary.improvementPercent);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={BookOpenCheck} label="เรียนออนไลน์" value={formatPercent(data.summary.lessonProgressPercent)} />
        <MetricCard icon={BadgeCheck} label="คะแนนรวม" value={formatPercent(data.summary.weightedScore)} />
        <MetricCard icon={Award} label="สถานะใบประกาศ" value={data.summary.readyForCertificate ? "พร้อมออก" : "ยังไม่พร้อม"} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>เปรียบเทียบก่อนเรียนและหลังเรียน</CardTitle>
          <CardDescription>คะแนนก่อนเรียนใช้เป็น baseline ไม่นำไปตัดสินผลผ่านหลักสูตร ส่วนคะแนนหลังเรียนใช้วัดผลลัพธ์หลังอบรม</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <ScoreProgressCard label="ก่อนเรียน" value={data.summary.preTestScore} />
            <ScoreProgressCard label="หลังเรียน" value={data.summary.postTestScore} />
            <div className={cn("rounded-lg border p-4", progressLevel.className)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm opacity-80">พัฒนาการ</p>
                  <p className="mt-1 text-2xl font-bold">{formatSignedPercent(data.summary.improvementPercent)}</p>
                </div>
                <Trophy className="size-8 shrink-0" />
              </div>
              <p className="mt-3 text-sm font-semibold">{progressLevel.label}</p>
              <p className="mt-1 text-sm leading-6 opacity-85">{progressLevel.message}</p>
            </div>
          </div>

          <div className={cn("rounded-lg border p-4", postLevel.className)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm opacity-80">ระดับผลสอบหลังเรียน</p>
                <h3 className="mt-1 text-xl font-bold">{postLevel.label}</h3>
                <p className="mt-2 text-sm leading-6 opacity-85">{postLevel.message}</p>
              </div>
              <BadgeCheck className="size-10 shrink-0" />
            </div>
          </div>

          <Separator />
          <div className="grid gap-3 text-sm">
            {data.rules.map((rule) => (
              <SummaryLine key={rule.id} label={rule.title} value={`น้ำหนัก ${rule.weightPercent}% / ผ่าน ${rule.passingScore}`} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreProgressCard({ label, value }: { label: string; value: number | null }) {
  const percent = boundedPercent(value);
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{formatPercent(value)}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-md border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
