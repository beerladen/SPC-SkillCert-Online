"use client";

import { type ComponentType, type FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BookOpenCheck,
  ClipboardCheck,
  Edit3,
  Eye,
  FileQuestion,
  FileText,
  Gauge,
  Layers,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Video,
} from "lucide-react";
import {
  archiveLearningTaskAction,
  saveAssessmentPairAction,
  saveEvaluationRuleAction,
  saveLearningTaskAction,
} from "@/app/admin/learning/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/components/admin/admin-data-table";
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
import type {
  CourseEvaluationRule,
  LearningAssessmentOption,
  LearningLesson,
  LearningManagementCourse,
  LearningManagementData,
  LearningTask,
  LearningTaskType,
} from "@/lib/learning-repositories";
import { cn } from "@/lib/utils";

type ActiveTab = "overview" | "lessons" | "tests" | "worksheets" | "practices" | "evaluation";
type TaskModalState =
  | { mode: "create"; taskType: LearningTaskType; task?: never }
  | { mode: "edit"; taskType: LearningTaskType; task: LearningTask };

const tabs: Array<{ value: ActiveTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "overview", label: "ภาพรวม", icon: Gauge },
  { value: "lessons", label: "แบบเรียนออนไลน์", icon: Video },
  { value: "tests", label: "ก่อน/หลังเรียน", icon: FileQuestion },
  { value: "worksheets", label: "ใบงาน", icon: ClipboardCheck },
  { value: "practices", label: "แบบฝึกปฏิบัติ", icon: BadgeCheck },
  { value: "evaluation", label: "วัดผล", icon: BookOpenCheck },
];

const taskTypeLabels: Record<LearningTaskType, string> = {
  worksheet: "ใบงาน",
  practice: "แบบฝึกปฏิบัติ",
};

const statusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่",
  archived: "เก็บถาวร",
};

const assessmentTypeLabels: Record<string, string> = {
  pre_test: "ก่อนเรียน",
  quiz: "Quiz",
  post_test: "หลังเรียน",
  assignment: "Assignment",
  final_project: "ชิ้นงานสรุป",
};

const ruleLabels: Record<CourseEvaluationRule["criterion"], string> = {
  lesson_progress: "เรียนออนไลน์",
  pre_test: "ก่อนเรียน",
  post_test: "หลังเรียน",
  worksheet: "ใบงาน",
  practice: "แบบฝึกปฏิบัติ",
};

const defaultRuleRows: Array<Pick<CourseEvaluationRule, "criterion" | "title" | "weightPercent" | "passingScore" | "isRequired" | "status" | "sortOrder">> = [
  {
    criterion: "lesson_progress",
    title: "เรียนออนไลน์ครบตามเกณฑ์",
    weightPercent: 20,
    passingScore: 80,
    isRequired: true,
    status: "active",
    sortOrder: 1,
  },
  {
    criterion: "pre_test",
    title: "แบบทดสอบก่อนเรียนเพื่อเทียบพัฒนาการ",
    weightPercent: 0,
    passingScore: 0,
    isRequired: false,
    status: "active",
    sortOrder: 2,
  },
  {
    criterion: "worksheet",
    title: "ใบงานระหว่างเรียน",
    weightPercent: 25,
    passingScore: 70,
    isRequired: true,
    status: "active",
    sortOrder: 3,
  },
  {
    criterion: "practice",
    title: "แบบฝึกปฏิบัติ/ชิ้นงาน",
    weightPercent: 25,
    passingScore: 70,
    isRequired: true,
    status: "active",
    sortOrder: 4,
  },
  {
    criterion: "post_test",
    title: "แบบทดสอบหลังเรียน",
    weightPercent: 30,
    passingScore: 70,
    isRequired: true,
    status: "active",
    sortOrder: 5,
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
}

function formatTaskPassingScore(passingScore: number, maxScore: number) {
  if (maxScore <= 0) return `${formatNumber(passingScore)} คะแนน`;
  const percent = (passingScore / maxScore) * 100;
  return `${formatNumber(passingScore)} คะแนน (${formatNumber(percent)}%)`;
}

function statusBadge(status: string) {
  if (status === "published" || status === "open" || status === "active") return "default";
  if (status === "archived" || status === "closed") return "destructive";
  return "secondary";
}

function getNextTaskOrder(course: LearningManagementCourse, taskType: LearningTaskType) {
  return course.tasks
    .filter((task) => task.taskType === taskType)
    .reduce((max, task) => Math.max(max, task.sortOrder), 0) + 1;
}

function getRule(course: LearningManagementCourse, criterion: CourseEvaluationRule["criterion"]) {
  const saved = course.rules.find((rule) => rule.criterion === criterion);
  const fallback = defaultRuleRows.find((rule) => rule.criterion === criterion);
  return saved ?? {
    id: 0,
    courseId: course.id,
    ...(fallback ?? defaultRuleRows[0]),
  };
}

export function LearningManagementWorkspace({ data }: { data: LearningManagementData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(String(data.courses[0]?.id ?? ""));
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; variant: "success" | "error" } | null>(null);

  const selectedCourse = useMemo(
    () => data.courses.find((course) => String(course.id) === selectedCourseId) ?? data.courses[0] ?? null,
    [data.courses, selectedCourseId],
  );

  const publishedLessons = selectedCourse?.lessons.filter((lesson) => lesson.status === "published").length ?? 0;
  const preTest = selectedCourse?.assessments.find((assessment) => assessment.type === "pre_test") ?? null;
  const postTest = selectedCourse?.assessments.find((assessment) => assessment.type === "post_test") ?? null;
  const worksheetTasks = selectedCourse?.tasks.filter((task) => task.taskType === "worksheet") ?? [];
  const practiceTasks = selectedCourse?.tasks.filter((task) => task.taskType === "practice") ?? [];
  const pendingTaskReviews = selectedCourse?.tasks.reduce((sum, task) => sum + task.pendingReviewCount, 0) ?? 0;

  function runAction(action: (formData: FormData) => Promise<{ ok: boolean; message: string }>, formData: FormData, successTitle: string, closeModal = false) {
    startTransition(async () => {
      const result = await action(formData);
      setNotice({
        title: result.ok ? successTitle : "ดำเนินการไม่สำเร็จ",
        message: result.message,
        variant: result.ok ? "success" : "error",
      });
      if (result.ok) {
        if (closeModal) setTaskModal(null);
        router.refresh();
      }
    });
  }

  if (!selectedCourse) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">ยังไม่มีหลักสูตรในระบบ</CardContent>
      </Card>
    );
  }

  const lessonColumns: Array<AdminDataTableColumn<LearningLesson>> = [
    {
      id: "lesson",
      header: "บทเรียน",
      render: (lesson) => (
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">หน่วย: {lesson.sectionTitle}</Badge>
            <Badge variant={statusBadge(lesson.status)}>{statusLabels[lesson.status] ?? lesson.status}</Badge>
          </div>
          <p className="mt-2 font-medium">{lesson.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lesson.description ?? "ยังไม่มีคำอธิบาย"}</p>
        </div>
      ),
    },
    {
      id: "media",
      header: "สื่อ/คลิป",
      render: (lesson) => (
        <div className="grid gap-2 text-sm">
          <span>{lesson.durationMinutes} นาที</span>
          <span className="text-muted-foreground">{lesson.videoUrl ? "มีคลิปออนไลน์" : "ยังไม่มีคลิป"}</span>
          <Badge variant="outline">{lesson.resources.length} ไฟล์ประกอบ</Badge>
        </div>
      ),
    },
    {
      id: "action",
      header: "จัดการ",
      className: "w-40",
      render: () => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/courses/${selectedCourse.slug}/builder?view=lessons`}>
            <Edit3 className="size-4" />
            แก้ไขใน Builder
          </Link>
        </Button>
      ),
    },
  ];

  const assessmentColumns: Array<AdminDataTableColumn<LearningAssessmentOption>> = [
    {
      id: "assessment",
      header: "ชุดวัดผล",
      render: (assessment) => (
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{assessmentTypeLabels[assessment.type]}</Badge>
            <Badge variant={statusBadge(assessment.status)}>{statusLabels[assessment.status] ?? assessment.status}</Badge>
            {!assessment.countsTowardCompletion && <Badge variant="secondary">ไม่ตัดสินผล</Badge>}
          </div>
          <p className="mt-2 font-medium">{assessment.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{assessment.description ?? "ยังไม่มีคำชี้แจง"}</p>
        </div>
      ),
    },
    {
      id: "question",
      header: "คำถาม",
      render: (assessment) => (
        <div className="grid gap-2 text-sm">
          <span>ชุดนี้: {assessment.ownQuestionCount} ข้อ</span>
          <span>ชุดที่ใช้จริง: {assessment.sourceQuestionCount} ข้อ</span>
          <span>จำนวนข้อที่สุ่มใช้: {assessment.questionLimit ?? "ใช้ทุกข้อ"}</span>
          {assessment.sourceTitle && <span className="text-muted-foreground">ใช้จาก: {assessment.sourceTitle}</span>}
        </div>
      ),
    },
    {
      id: "rule",
      header: "กติกา",
      render: (assessment) => (
        <div className="grid gap-2 text-sm">
          <span>ผ่าน {assessment.passingScore}%</span>
          <span>{assessment.maxAttempts ? `${assessment.maxAttempts} ครั้ง` : "ไม่จำกัดครั้ง"}</span>
          <span className="text-muted-foreground">
            {assessment.randomizeQuestions ? "สุ่มข้อ" : "เรียงข้อ"} / {assessment.randomizeOptions ? "สุ่มตัวเลือก" : "เรียงตัวเลือก"}
          </span>
        </div>
      ),
    },
  ];

  const taskColumns: Array<AdminDataTableColumn<LearningTask>> = [
    {
      id: "task",
      header: "รายการ",
      render: (task) => (
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{taskTypeLabels[task.taskType]}</Badge>
            <Badge variant={statusBadge(task.status)}>{statusLabels[task.status]}</Badge>
            {task.requireEvidence && <Badge variant="secondary">หลักฐาน {task.evidenceRequiredCount} รายการ</Badge>}
          </div>
          <p className="mt-2 font-medium">{task.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description ?? "ยังไม่มีคำอธิบาย"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {task.sectionTitle ?? "ทั้งหลักสูตร"} {task.lessonTitle ? ` / ${task.lessonTitle}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "score",
      header: "คะแนน/ส่งงาน",
      render: (task) => (
        <div className="grid gap-2 text-sm">
          <span>{formatNumber(task.maxScore)} คะแนน / ผ่าน {formatTaskPassingScore(task.passingScore, task.maxScore)}</span>
          <span>น้ำหนัก {formatNumber(task.weightPercent)}%</span>
          <span className="text-muted-foreground">ส่งแล้ว {task.submissionCount} / รอตรวจ {task.pendingReviewCount}</span>
        </div>
      ),
    },
    {
      id: "assets",
      header: "โจทย์/Rubric",
      render: (task) => (
        <div className="grid gap-2 text-sm">
          <Badge variant="outline">{task.attachmentCount} ไฟล์แนบ</Badge>
          <Badge variant="outline">{task.rubricCount} rubric</Badge>
          <span className="text-muted-foreground">{task.allowResubmission ? "ส่งแก้ไขได้" : "ส่งครั้งเดียว"}</span>
        </div>
      ),
    },
    {
      id: "manage",
      header: "จัดการ",
      className: "w-48",
      render: (task) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setTaskModal({ mode: "edit", taskType: task.taskType, task })}>
            <Edit3 className="size-4" />
            แก้ไข
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const formData = new FormData();
              formData.set("taskId", String(task.id));
              runAction(archiveLearningTaskAction, formData, "ปิดใช้งานแล้ว");
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm text-muted-foreground">เลือกหลักสูตรเพื่อจัดการระบบเรียนออนไลน์ ใบงาน แบบฝึก และการวัดผล</p>
            <select
              className="mt-3 h-11 w-full max-w-2xl rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
            >
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/admin/courses/${selectedCourse.slug}/builder`}>
                <Layers className="size-4" />
                โครงสร้างหลักสูตร
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/learning/${selectedCourse.slug}/preview`}>
                <Eye className="size-4" />
                หน้าผู้เรียน
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Studio</CardTitle>
          <CardDescription>
            เปิดโหมดจัดการเดียวกับปุ่มโครงสร้าง โดยเลือกทำงานเฉพาะส่วนของหลักสูตรนี้ได้ทันที
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=sections`}
            icon={Layers}
            title="หน่วย"
            description="หน่วย สมรรถนะ เวลาเรียน และเกณฑ์ผ่าน"
          />
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=lessons`}
            icon={Video}
            title="บทเรียนออนไลน์"
            description="คลิป ใบความรู้ และลำดับการเรียน"
          />
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=resources`}
            icon={FileText}
            title="สื่อ/ใบความรู้"
            description="อัปโหลดไฟล์ เอกสาร ลิงก์ และสื่อประกอบ"
          />
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=assessments`}
            icon={FileQuestion}
            title="ข้อสอบ"
            description="Pre/Post, Quiz, คลังคำถาม และ bulk import"
          />
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=worksheets`}
            icon={ClipboardCheck}
            title="ใบงาน"
            description="โจทย์ งานส่ง ไฟล์แนบ rubric และงานรอตรวจ"
          />
          <StudioLink
            href={`/admin/courses/${selectedCourse.slug}/builder?view=practices`}
            icon={BadgeCheck}
            title="แบบฝึก"
            description="แบบฝึกปฏิบัติและชิ้นงานหลังเรียน"
          />
          <button
            type="button"
            onClick={() => setActiveTab("evaluation")}
            className="rounded-lg border p-4 text-left transition hover:border-primary/40 hover:bg-secondary"
          >
            <BookOpenCheck className="size-5 text-primary" />
            <p className="mt-3 font-semibold">เกณฑ์วัดผล</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              น้ำหนักคะแนน เกณฑ์ผ่าน และเงื่อนไขใบประกาศ
            </p>
          </button>
          <StudioLink
            href={`/admin/learning/${selectedCourse.slug}/preview`}
            icon={Eye}
            title="ดูหน้าผู้เรียน"
            description="ดูทุกแท็บและทดสอบด้วยบัญชีผู้เรียนจริง"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={Video} label="บทเรียนเผยแพร่" value={`${publishedLessons}/${selectedCourse.lessons.length}`} />
        <SummaryCard icon={FileQuestion} label="ชุดวัดผล" value={String(selectedCourse.assessments.length)} />
        <SummaryCard icon={ClipboardCheck} label="ใบงาน/แบบฝึก" value={`${worksheetTasks.length}/${practiceTasks.length}`} />
        <SummaryCard icon={Gauge} label="งานรอตรวจ" value={String(pendingTaskReviews)} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>{selectedCourse.title}</CardTitle>
              <CardDescription>
                {selectedCourse.categoryName} / {selectedCourse.instructorName} / ค่าลงทะเบียน {formatNumber(selectedCourse.registrationFee)} บาท
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <StatusMetric label="หน่วยการเรียนรู้" value={selectedCourse.sections.length} detail="ใช้ DataTable ในแท็บ Builder" />
              <StatusMetric label="บทเรียนออนไลน์" value={selectedCourse.lessons.length} detail={`${publishedLessons} รายการเผยแพร่แล้ว`} />
              <StatusMetric label="Pre/Post Test" value={preTest && postTest ? 2 : selectedCourse.assessments.filter((item) => item.type === "pre_test" || item.type === "post_test").length} detail={postTest?.sharedQuestionSourceId ? "ใช้ชุดคำถามเดียวกันแล้ว" : "ยังไม่ได้จับคู่ชุดคำถาม"} />
              <StatusMetric label="Rubric" value={selectedCourse.tasks.reduce((sum, task) => sum + task.rubricCount, 0)} detail="ใช้กับใบงานและแบบฝึก" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Flow ที่เปิดใช้งาน</CardTitle>
              <CardDescription>ลำดับที่ผู้เรียนจะเห็นในห้องเรียน</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {["ทำแบบทดสอบก่อนเรียน", "เรียนคลิป/อ่านใบความรู้", "ส่งใบงาน", "ส่งแบบฝึกปฏิบัติ", "ทำแบบทดสอบหลังเรียน", "ดูผลเปรียบเทียบและใบประกาศ"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-md border p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 font-bold text-primary">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "lessons" && (
        <Card>
          <CardHeader>
            <CardTitle>แบบเรียนออนไลน์</CardTitle>
            <CardDescription>ตรวจบทเรียน คลิป ใบความรู้ และไฟล์ประกอบของหลักสูตรนี้</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={selectedCourse.lessons}
              columns={lessonColumns}
              getRowKey={(lesson) => String(lesson.id)}
              getSearchText={(lesson) => `${lesson.title} ${lesson.description ?? ""} ${lesson.sectionTitle}`}
              pageSize={6}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "tests" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>จับคู่แบบทดสอบก่อนเรียนและหลังเรียน</CardTitle>
              <CardDescription>ก่อนเรียนและหลังเรียนใช้ชุดคำถามเดียวกัน โดยก่อนเรียนไม่นำคะแนนไปตัดสินผล</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  runAction(saveAssessmentPairAction, new FormData(event.currentTarget), "บันทึกการจับคู่แล้ว");
                }}
              >
                <input type="hidden" name="courseId" value={selectedCourse.id} />
                <label className="grid gap-2 text-sm font-medium">
                  ชุดก่อนเรียน
                  <select name="preAssessmentId" defaultValue={preTest?.id ?? ""} className="h-10 rounded-md border bg-background px-3">
                    <option value="">สร้างใหม่อัตโนมัติ</option>
                    {selectedCourse.assessments.filter((item) => item.type === "pre_test").map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  ชุดหลังเรียน
                  <select name="postAssessmentId" defaultValue={postTest?.id ?? ""} className="h-10 rounded-md border bg-background px-3">
                    <option value="">สร้างใหม่อัตโนมัติ</option>
                    {selectedCourse.assessments.filter((item) => item.type === "post_test").map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                </label>
                <Button type="submit" className="self-end" disabled={isPending}>
                  <RotateCw className="size-4" />
                  ใช้ชุดเดียวกัน
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ชุดวัดผลทั้งหมด</CardTitle>
              <CardDescription>จัดการคำถามเชิงลึกผ่าน Builder เดิม ส่วนหน้านี้ดูการจับคู่และสถานะ</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={selectedCourse.assessments}
                columns={assessmentColumns}
                getRowKey={(assessment) => String(assessment.id)}
                getSearchText={(assessment) => `${assessment.title} ${assessment.type} ${assessment.description ?? ""}`}
                pageSize={6}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {(activeTab === "worksheets" || activeTab === "practices") && (
        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{activeTab === "worksheets" ? "จัดการใบงาน" : "จัดการแบบฝึกปฏิบัติ"}</CardTitle>
              <CardDescription>สร้างโจทย์ แนบไฟล์ ตั้ง rubric คะแนน หลักฐาน และสถานะเผยแพร่</CardDescription>
            </div>
            <Button onClick={() => setTaskModal({ mode: "create", taskType: activeTab === "worksheets" ? "worksheet" : "practice" })}>
              <Plus className="size-4" />
              เพิ่ม{activeTab === "worksheets" ? "ใบงาน" : "แบบฝึก"}
            </Button>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={activeTab === "worksheets" ? worksheetTasks : practiceTasks}
              columns={taskColumns}
              getRowKey={(task) => String(task.id)}
              getSearchText={(task) => `${task.title} ${task.description ?? ""} ${task.sectionTitle ?? ""} ${task.lessonTitle ?? ""}`}
              pageSize={6}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "evaluation" && (
        <Card>
          <CardHeader>
            <CardTitle>เกณฑ์วัดผลและน้ำหนักคะแนน</CardTitle>
            <CardDescription>pre-test น้ำหนัก 0% สำหรับเปรียบเทียบความก้าวหน้า ส่วน post-test ใช้ตัดสินผล</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {defaultRuleRows.map((fallback) => {
              const rule = getRule(selectedCourse, fallback.criterion);
              return (
                <form
                  key={fallback.criterion}
                  className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1.4fr_120px_120px_110px_110px_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runAction(saveEvaluationRuleAction, new FormData(event.currentTarget), "บันทึกเกณฑ์แล้ว");
                  }}
                >
                  <input type="hidden" name="courseId" value={selectedCourse.id} />
                  <input type="hidden" name="criterion" value={rule.criterion} />
                  <input type="hidden" name="sortOrder" value={rule.sortOrder} />
                  <label className="grid gap-2 text-sm font-medium">
                    {ruleLabels[rule.criterion]}
                    <Input name="title" defaultValue={rule.title} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    น้ำหนัก %
                    <Input name="weightPercent" type="number" min={0} max={100} step="0.1" defaultValue={rule.weightPercent} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    เกณฑ์ผ่าน (%)
                    <Input name="passingScore" type="number" min={0} max={100} step="0.1" defaultValue={rule.passingScore} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    สถานะ
                    <select name="status" defaultValue={rule.status} className="h-10 rounded-md border bg-background px-3">
                      <option value="active">ใช้งาน</option>
                      <option value="inactive">ปิด</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                    <input name="isRequired" type="checkbox" defaultChecked={rule.isRequired} />
                    บังคับผ่าน
                  </label>
                  <Button type="submit" className="self-end" disabled={isPending}>
                    <Save className="size-4" />
                    บันทึก
                  </Button>
                </form>
              );
            })}
          </CardContent>
        </Card>
      )}

      <TaskEditorModal
        course={selectedCourse}
        modal={taskModal}
        onClose={() => setTaskModal(null)}
        onSubmit={(formData) => runAction(saveLearningTaskAction, formData, "บันทึกรายการแล้ว", true)}
        isPending={isPending}
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
      </AdminActionModal>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StudioLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-4 transition hover:border-primary/40 hover:bg-secondary"
    >
      <Icon className="size-5 text-primary" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatusMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function TaskEditorModal({
  course,
  modal,
  onClose,
  onSubmit,
  isPending,
}: {
  course: LearningManagementCourse;
  modal: TaskModalState | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  if (!modal) return null;
  const task = modal.task;
  const taskType = modal.taskType;
  const defaultSortOrder = task?.sortOrder ?? getNextTaskOrder(course, taskType);
  const firstAttachment = task?.attachments[0];
  const rubrics = task?.rubrics ?? [];

  return (
    <AdminActionModal
      open
      title={task ? `แก้ไข${taskTypeLabels[taskType]}` : `เพิ่ม${taskTypeLabels[taskType]}`}
      description="กำหนดโจทย์ คะแนน rubric ไฟล์ประกอบ และเงื่อนไขการส่งงาน"
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="grid gap-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="courseId" value={course.id} />
        <input type="hidden" name="taskType" value={taskType} />
        {task && <input type="hidden" name="taskId" value={task.id} />}

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            หน่วย
            <select name="sectionId" defaultValue={task?.sectionId ?? ""} className="h-10 rounded-md border bg-background px-3">
              <option value="">ทั้งหลักสูตร</option>
              {course.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            บทเรียน
            <select name="lessonId" defaultValue={task?.lessonId ?? ""} className="h-10 rounded-md border bg-background px-3">
              <option value="">ไม่ผูกบทเรียน</option>
              {course.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            ลำดับ
            <Input name="sortOrder" type="number" min={1} defaultValue={defaultSortOrder} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_170px]">
          <label className="grid gap-2 text-sm font-medium">
            ชื่อรายการ
            <Input name="title" required defaultValue={task?.title ?? ""} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            สถานะ
            <select name="status" defaultValue={task?.status ?? "published"} className="h-10 rounded-md border bg-background px-3">
              <option value="draft">ฉบับร่าง</option>
              <option value="published">เผยแพร่</option>
              <option value="archived">เก็บถาวร</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          คำอธิบาย
          <textarea name="description" className="min-h-20 rounded-md border bg-background p-3 text-sm" defaultValue={task?.description ?? ""} />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          โจทย์/คำชี้แจง HTML
          <textarea name="instructionHtml" className="min-h-32 rounded-md border bg-background p-3 text-sm" defaultValue={task?.instructionHtml ?? ""} />
        </label>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">
            คะแนนเต็ม
            <Input name="maxScore" type="number" min={0} step="0.1" defaultValue={task?.maxScore ?? 100} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            คะแนนผ่าน (คะแนน)
            <Input name="passingScore" type="number" min={0} step="0.1" defaultValue={task?.passingScore ?? 70} />
            <span className="text-xs font-normal text-muted-foreground">
              ใช้คะแนนดิบ เช่น คะแนนเต็ม 20 ผ่าน 14 เท่ากับ 70%
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            น้ำหนัก %
            <Input name="weightPercent" type="number" min={0} max={100} step="0.1" defaultValue={task?.weightPercent ?? (taskType === "worksheet" ? 20 : 25)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            กำหนดส่งหลังลงทะเบียน
            <Input name="dueDaysAfterEnrollment" type="number" min={0} defaultValue={task?.dueDaysAfterEnrollment ?? ""} placeholder="วัน" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium">
            วิธีส่ง
            <select name="submissionMode" defaultValue={task?.submissionMode ?? "file_or_link"} className="h-10 rounded-md border bg-background px-3">
              <option value="file_or_link">ไฟล์หรือลิงก์</option>
              <option value="file">ไฟล์เท่านั้น</option>
              <option value="link">ลิงก์เท่านั้น</option>
              <option value="text">ข้อความ</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            จำนวนหลักฐาน
            <Input name="evidenceRequiredCount" type="number" min={0} defaultValue={task?.evidenceRequiredCount ?? 0} />
          </label>
          <div className="flex items-end gap-4 pb-2 text-sm font-medium">
            <label className="flex items-center gap-2">
              <input name="allowResubmission" type="checkbox" defaultChecked={task?.allowResubmission ?? true} />
              ส่งแก้ไขได้
            </label>
            <label className="flex items-center gap-2">
              <input name="requireEvidence" type="checkbox" defaultChecked={task?.requireEvidence ?? false} />
              ต้องมีหลักฐาน
            </label>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            URL ไฟล์โจทย์
            <Input name="instructionFileUrl" defaultValue={task?.instructionFileUrl ?? ""} placeholder="/uploads/resources/work.pdf" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            ชื่อไฟล์โจทย์
            <Input name="instructionFileName" defaultValue={task?.instructionFileName ?? ""} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            URL ไฟล์/ลิงก์ประกอบ
            <Input name="attachmentUrl" defaultValue={firstAttachment?.fileUrl ?? task?.resourceUrl ?? ""} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            ชื่อไฟล์ประกอบ
            <Input name="attachmentFileName" defaultValue={firstAttachment?.fileName ?? ""} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            ชื่อรายการไฟล์แนบ
            <Input name="attachmentTitle" defaultValue={firstAttachment?.title ?? ""} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            ประเภทไฟล์แนบ
            <select name="attachmentFileType" defaultValue={firstAttachment?.fileType ?? "other"} className="h-10 rounded-md border bg-background px-3">
              <option value="pdf">PDF</option>
              <option value="doc">เอกสาร</option>
              <option value="sheet">ตารางคำนวณ</option>
              <option value="image">รูปภาพ</option>
              <option value="link">ลิงก์</option>
              <option value="other">อื่น ๆ</option>
            </select>
          </label>
          <input type="hidden" name="resourceUrl" value={firstAttachment?.fileUrl ?? task?.resourceUrl ?? ""} />
        </div>

        <Separator />

        <div className="grid gap-3">
          <div>
            <p className="font-semibold">Rubric การให้คะแนน</p>
            <p className="text-sm text-muted-foreground">ระบบจะใช้รายการนี้ช่วยให้ครูตรวจงานได้เป็นมาตรฐานเดียวกัน</p>
          </div>
          {[1, 2, 3, 4].map((index) => {
            const rubric = rubrics[index - 1];
            return (
              <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_110px]">
                <div className="grid gap-3">
                  <Input name={`rubricTitle${index}`} defaultValue={rubric?.title ?? ""} placeholder={`หัวข้อ rubric ${index}`} />
                  <Input name={`rubricDescription${index}`} defaultValue={rubric?.description ?? ""} placeholder="คำอธิบาย" />
                </div>
                <Input name={`rubricScore${index}`} type="number" min={0} step="0.1" defaultValue={rubric?.maxScore ?? ""} placeholder="คะแนน" />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save className="size-4" />
            บันทึก
          </Button>
        </div>
      </form>
    </AdminActionModal>
  );
}
