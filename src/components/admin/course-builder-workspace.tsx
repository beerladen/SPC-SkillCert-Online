"use client";

import { type FormEvent, type ReactNode, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Edit,
  Eye,
  FileQuestion,
  FileText,
  Layers,
  Library,
  LinkIcon,
  Plus,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  deleteAssessmentAction,
  deleteCourseSectionAction,
  deleteLessonAction,
  deleteLessonResourceAction,
  deleteQuestionAction,
  importQuestionsAction,
  saveAssessmentAction,
  saveCourseSectionAction,
  saveLessonAction,
  saveLessonResourceAction,
  saveQuestionAction,
} from "@/app/admin/courses/builder-actions";
import {
  archiveLearningTaskAction,
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UploadField } from "@/components/ui/upload-field";
import type {
  BuilderPublishStatus,
  CourseBuilderAssessment,
  CourseBuilderAssessmentType,
  CourseBuilderData,
  CourseBuilderLesson,
  CourseBuilderLessonType,
  CourseBuilderQuestion,
  CourseBuilderQuestionType,
  CourseBuilderResource,
  CourseBuilderResourceType,
  CourseBuilderSection,
  CourseBuilderTask,
  CourseBuilderTaskType,
  CourseBuilderShowAnswers,
  CourseSectionLearningMode,
} from "@/lib/db-repositories";
import { cn } from "@/lib/utils";

interface CourseBuilderWorkspaceProps {
  data: CourseBuilderData;
  initialView?: BuilderView;
}

const emptyBuilderLessons: CourseBuilderLesson[] = [];

type BuilderView = "sections" | "lessons" | "resources" | "assessments" | "worksheets" | "practices";

const builderViews: Array<{
  value: BuilderView;
  label: string;
  description: string;
}> = [
  {
    value: "sections",
    label: "หน่วย",
    description: "จัดการหน่วยการเรียนรู้ สมรรถนะ เวลาเรียน และเกณฑ์ผ่าน",
  },
  {
    value: "lessons",
    label: "บทเรียน",
    description: "จัดการบทเรียนออนไลน์ คลิป ใบความรู้ และลำดับการเรียน",
  },
  {
    value: "resources",
    label: "สื่อ",
    description: "จัดการไฟล์ประกอบ ใบงาน ใบความรู้ ลิงก์ และวิดีโอ",
  },
  {
    value: "assessments",
    label: "ข้อสอบ",
    description: "จัดการ pre-test, quiz, post-test และคำถามวัดผล",
  },
  {
    value: "worksheets",
    label: "ใบงาน",
    description: "จัดการใบงานระหว่างเรียน งานส่ง ไฟล์แนบ rubric และงานรอตรวจ",
  },
  {
    value: "practices",
    label: "แบบฝึก",
    description: "จัดการแบบฝึกปฏิบัติ งานส่ง ไฟล์แนบ rubric และงานรอตรวจ",
  },
];

type BuilderAction = (formData: FormData) => Promise<{ ok: boolean; message: string }>;

type DeleteTarget =
  | { entity: "section"; section: CourseBuilderSection }
  | { entity: "lesson"; lesson: CourseBuilderLesson }
  | { entity: "resource"; resource: CourseBuilderResource }
  | { entity: "assessment"; assessment: CourseBuilderAssessment }
  | { entity: "question"; question: CourseBuilderQuestion }
  | { entity: "task"; task: CourseBuilderTask };

type BuilderModal =
  | { type: "section"; section?: CourseBuilderSection }
  | { type: "lesson"; lesson?: CourseBuilderLesson; sectionId?: number }
  | { type: "resource"; resource?: CourseBuilderResource; lessonId?: number }
  | { type: "assessment"; assessment?: CourseBuilderAssessment; target?: string }
  | { type: "questions"; assessment: CourseBuilderAssessment; question?: CourseBuilderQuestion }
  | {
      type: "task";
      task?: CourseBuilderTask;
      taskType: CourseBuilderTaskType;
      sectionId?: number;
      lessonId?: number;
    }
  | { type: "delete"; target: DeleteTarget };

type LessonRow = CourseBuilderLesson & { sectionTitle: string };
type ResourceRow = CourseBuilderResource & {
  lessonTitle: string;
  sectionTitle?: string;
};
type AssessmentRow = CourseBuilderAssessment & { targetText: string };

const textAreaClassName =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const builderUploadAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.zip,.rar,.txt,.csv";
const maxBuilderUploadSizeBytes = 25 * 1024 * 1024;
const allowedBuilderUploadExtensions = new Set(
  builderUploadAccept.split(",").map((extension) => extension.trim().toLowerCase()),
);

const submissionModeLabels: Record<CourseBuilderTask["submissionMode"], string> = {
  file: "ไฟล์เท่านั้น",
  link: "ลิงก์เท่านั้น",
  file_or_link: "ไฟล์หรือลิงก์",
  text: "ข้อความ",
};

const taskTypeLabels: Record<CourseBuilderTaskType, string> = {
  worksheet: "ใบงาน",
  practice: "แบบฝึก",
};

function getBuilderUploadValidationMessage(file: File) {
  if (file.size > maxBuilderUploadSizeBytes) {
    return `ไฟล์ ${file.name} มีขนาดเกิน 25 MB`;
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!allowedBuilderUploadExtensions.has(extension)) {
    return `ไฟล์ ${file.name} ยังไม่อยู่ในรูปแบบที่รองรับ`;
  }

  return null;
}

function validateBuilderUploads(form: HTMLFormElement) {
  for (const key of ["resourceFile", "instructionFile", "attachmentFile"]) {
    const input = form.elements.namedItem(key);
    if (!(input instanceof HTMLInputElement)) continue;

    const file = input.files?.[0] ?? null;
    if (!file) continue;

    const message = getBuilderUploadValidationMessage(file);
    if (message) return message;
  }

  return null;
}

function validateQuestionImport(form: HTMLFormElement) {
  const textInput = form.elements.namedItem("importText");
  const fileInput = form.elements.namedItem("questionImportFile");

  if (!textInput && !fileInput) {
    return null;
  }

  const hasText =
    textInput instanceof HTMLTextAreaElement && textInput.value.trim().length > 0;
  const hasFile =
    fileInput instanceof HTMLInputElement && Boolean(fileInput.files?.[0]);

  if (!hasText && !hasFile) {
    return "กรุณาวางข้อความข้อสอบหรืออัปโหลดไฟล์ .txt/.csv";
  }

  return null;
}

function formatBuilderNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
}

function formatTaskPassingScore(passingScore: number, maxScore: number) {
  if (maxScore <= 0) return `${formatBuilderNumber(passingScore)} คะแนน`;
  const percent = (passingScore / maxScore) * 100;
  return `${formatBuilderNumber(passingScore)} คะแนน (${formatBuilderNumber(percent)}%)`;
}

const statusLabels: Record<BuilderPublishStatus, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่",
  archived: "เก็บเข้าคลัง",
};

const learningModeLabels: Record<CourseSectionLearningMode, string> = {
  online: "ออนไลน์",
  live_online: "ออนไลน์ + สด",
  blended: "ผสมผสาน",
};

const lessonTypeLabels: Record<CourseBuilderLessonType, string> = {
  video: "คลิปวิดีโอ",
  document: "ใบความรู้",
  practice: "ปฏิบัติ",
};

const resourceTypeLabels: Record<CourseBuilderResourceType, string> = {
  pdf: "PDF",
  doc: "เอกสาร",
  link: "ลิงก์",
  worksheet: "ใบงาน",
  video: "วิดีโอ",
  image: "รูปภาพ",
  other: "อื่น ๆ",
};

const assessmentTypeLabels: Record<CourseBuilderAssessmentType, string> = {
  pre_test: "ก่อนเรียน",
  quiz: "ระหว่างเรียน",
  post_test: "หลังเรียน",
  assignment: "ใบงาน",
  final_project: "ชิ้นงานสรุป",
};

const questionTypeLabels: Record<CourseBuilderQuestionType, string> = {
  single_choice: "ปรนัยคำตอบเดียว",
  multiple_choice: "ปรนัยหลายคำตอบ",
  true_false: "ถูก/ผิด",
  short_answer: "คำตอบสั้น",
  essay: "อัตนัย",
  file_upload: "อัปโหลดไฟล์",
};

const showAnswerLabels: Record<CourseBuilderShowAnswers, string> = {
  immediate: "แสดงทันทีหลังส่ง",
  after_close: "แสดงหลังปิดสอบ",
  never: "ไม่แสดงเฉลย",
};

const lessonTypeIcons: Record<CourseBuilderLessonType, typeof Video> = {
  video: Video,
  document: FileText,
  practice: ClipboardCheck,
};

export function CourseBuilderWorkspace({ data, initialView = "sections" }: CourseBuilderWorkspaceProps) {
  const router = useRouter();
  const [modal, setModal] = useState<BuilderModal | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<BuilderView>(initialView);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    data.sections[0]?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const lessons = useMemo(
    () => data.sections.flatMap((section) => section.lessons),
    [data.sections],
  );
  const lessonRows = useMemo<LessonRow[]>(
    () =>
      data.sections.flatMap((section) =>
        section.lessons.map((lesson) => ({
          ...lesson,
          sectionTitle: section.title,
        })),
      ),
    [data.sections],
  );
  const assessments = useMemo(
    () => [
      ...data.courseAssessments,
      ...data.sections.flatMap((section) => [
        ...section.assessments,
        ...section.lessons.flatMap((lesson) => lesson.assessments),
      ]),
    ],
    [data.courseAssessments, data.sections],
  );
  const resources = useMemo(
    () => lessons.flatMap((lesson) => lesson.resources),
    [lessons],
  );
  const resourceRows = useMemo<ResourceRow[]>(
    () =>
      data.sections.flatMap((section) =>
        section.lessons.flatMap((lesson) =>
          lesson.resources.map((resource) => ({
            ...resource,
            lessonTitle: lesson.title,
            sectionTitle: section.title,
          })),
        ),
      ),
    [data.sections],
  );
  const tasks = data.tasks;
  const worksheetTasks = useMemo(
    () => tasks.filter((task) => task.taskType === "worksheet"),
    [tasks],
  );
  const practiceTasks = useMemo(
    () => tasks.filter((task) => task.taskType === "practice"),
    [tasks],
  );
  const selectedSection =
    data.sections.find((section) => section.id === selectedSectionId) ??
    data.sections[0] ??
    null;
  const selectedLessons = selectedSection?.lessons ?? emptyBuilderLessons;
  const selectedResources = selectedLessons.flatMap((lesson) =>
    lesson.resources.map((resource) => ({ ...resource, lessonTitle: lesson.title })),
  );
  const selectedAssessments = selectedSection
    ? [
        ...selectedSection.assessments.map((assessment) => ({
          ...assessment,
          targetText: selectedSection.title,
        })),
        ...selectedLessons.flatMap((lesson) =>
          lesson.assessments.map((assessment) => ({
            ...assessment,
            targetText: lesson.title,
          })),
        ),
      ]
    : [];
  const selectedPracticeTasks = useMemo(() => {
    if (!selectedSection) return [];
    const lessonIds = new Set(selectedLessons.map((lesson) => lesson.id));
    return practiceTasks.filter(
      (task) =>
        task.sectionId === selectedSection.id ||
        (task.lessonId !== null && lessonIds.has(task.lessonId)),
    );
  }, [practiceTasks, selectedLessons, selectedSection]);
  const worksheetCountByLessonId = useMemo(() => {
    const countByLessonId = new Map<number, number>();
    for (const task of worksheetTasks) {
      if (task.lessonId === null) continue;
      countByLessonId.set(task.lessonId, (countByLessonId.get(task.lessonId) ?? 0) + 1);
    }
    return countByLessonId;
  }, [worksheetTasks]);
  const practiceCountByLessonId = useMemo(() => {
    const countByLessonId = new Map<number, number>();
    for (const task of practiceTasks) {
      if (task.lessonId === null) continue;
      countByLessonId.set(task.lessonId, (countByLessonId.get(task.lessonId) ?? 0) + 1);
    }
    return countByLessonId;
  }, [practiceTasks]);
  const worksheetCountBySectionId = useMemo(() => {
    const countBySectionId = new Map<number, number>();
    for (const section of data.sections) {
      const lessonIds = new Set(section.lessons.map((lesson) => lesson.id));
      const count = worksheetTasks.filter(
        (task) =>
          task.sectionId === section.id ||
          (task.lessonId !== null && lessonIds.has(task.lessonId)),
      ).length;
      countBySectionId.set(section.id, count);
    }
    return countBySectionId;
  }, [data.sections, worksheetTasks]);
  const practiceCountBySectionId = useMemo(() => {
    const countBySectionId = new Map<number, number>();
    for (const section of data.sections) {
      const lessonIds = new Set(section.lessons.map((lesson) => lesson.id));
      const count = practiceTasks.filter(
        (task) =>
          task.sectionId === section.id ||
          (task.lessonId !== null && lessonIds.has(task.lessonId)),
      ).length;
      countBySectionId.set(section.id, count);
    }
    return countBySectionId;
  }, [data.sections, practiceTasks]);
  const assessmentRows = useMemo<AssessmentRow[]>(
    () => [
      ...data.courseAssessments.map((assessment) => ({
        ...assessment,
        targetText: "ระดับหลักสูตร",
      })),
      ...data.sections.flatMap((section) => [
        ...section.assessments.map((assessment) => ({
          ...assessment,
          targetText: `หน่วย: ${section.title}`,
        })),
        ...section.lessons.flatMap((lesson) =>
          lesson.assessments.map((assessment) => ({
            ...assessment,
            targetText: `บทเรียน: ${lesson.title}`,
          })),
        ),
      ]),
    ],
    [data.courseAssessments, data.sections],
  );
  const activeViewDetail =
    builderViews.find((view) => view.value === activeView) ?? builderViews[0];

  const runAction = (
    event: FormEvent<HTMLFormElement>,
    action: BuilderAction,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const uploadMessage = validateBuilderUploads(form);
    if (uploadMessage) {
      setActionMessage(uploadMessage);
      return;
    }
    const importMessage = validateQuestionImport(form);
    if (importMessage) {
      setActionMessage(importMessage);
      return;
    }

    const formData = new FormData(form);

    startTransition(() => {
      void action(formData)
        .then((result) => {
          setActionMessage(result.message);
          if (result.ok) {
            setModal(null);
            router.refresh();
          }
        })
        .catch((error) => {
          setActionMessage(
            error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
          );
        });
    });
  };

  const openModal = (nextModal: BuilderModal) => {
    setActionMessage(null);
    setModal(nextModal);
  };

  const sectionColumns: Array<AdminDataTableColumn<CourseBuilderSection>> = [
    {
      id: "unit",
      header: "หน่วยการเรียนรู้",
      className: "w-[360px] min-w-[280px] max-w-[360px] whitespace-normal",
      render: (section) => (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {section.code && <Badge variant="outline">{section.code}</Badge>}
            <Badge variant={section.status === "published" ? "default" : "secondary"}>
              {statusLabels[section.status]}
            </Badge>
          </div>
          <p className="break-words font-medium leading-6">{section.title}</p>
          <p className="line-clamp-2 max-w-full break-words text-sm leading-6 text-muted-foreground">
            {section.description ?? "ยังไม่มีคำอธิบาย"}
          </p>
        </div>
      ),
    },
    {
      id: "detail",
      header: "รายละเอียด",
      render: (section) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>{section.hours} ชั่วโมง</span>
          <span className="text-muted-foreground">
            {learningModeLabels[section.learningMode]} · ผ่าน {section.passingScore}%
          </span>
        </div>
      ),
    },
    {
      id: "contents",
      header: "เนื้อหา",
      render: (section) => {
        const sectionResources = section.lessons.reduce(
          (total, lesson) => total + lesson.resources.length,
          0,
        );
        return (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{section.lessons.length} บทเรียน</Badge>
            <Badge variant="outline">{sectionResources} สื่อ</Badge>
            <Badge variant="outline">
              {worksheetCountBySectionId.get(section.id) ?? 0} ใบงาน
            </Badge>
            <Badge variant="outline">
              {practiceCountBySectionId.get(section.id) ?? 0} แบบฝึก
            </Badge>
            <Badge variant="outline">
              {section.assessments.length +
                section.lessons.reduce(
                  (total, lesson) => total + lesson.assessments.length,
                  0,
                )}{" "}
              วัดผล
            </Badge>
          </div>
        );
      },
    },
    {
      id: "tests",
      header: "Pre/Post",
      render: (section) => {
        const allSectionAssessments = [
          ...section.assessments,
          ...section.lessons.flatMap((lesson) => lesson.assessments),
        ];
        const preTests = allSectionAssessments.filter(
          (assessment) => assessment.type === "pre_test",
        ).length;
        const postTests = allSectionAssessments.filter(
          (assessment) => assessment.type === "post_test",
        ).length;
        return (
          <div className="flex flex-wrap gap-2">
            <Badge variant={preTests > 0 ? "secondary" : "outline"}>ก่อนเรียน {preTests}</Badge>
            <Badge variant={postTests > 0 ? "secondary" : "outline"}>หลังเรียน {postTests}</Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (section) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant={selectedSection?.id === section.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedSectionId(section.id);
              setActiveView("lessons");
            }}
          >
            บทเรียน
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "section", section })}
          >
            <Edit data-icon="inline-start" />
            แก้ไข
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "delete", target: { entity: "section", section } })}
          >
            <Trash2 data-icon="inline-start" />
            ลบ
          </Button>
        </div>
      ),
    },
  ];

  const lessonColumns: Array<AdminDataTableColumn<CourseBuilderLesson>> = [
    {
      id: "lesson",
      header: "บทเรียน",
      className: "w-[320px] min-w-[260px] max-w-[360px] whitespace-normal",
      render: (lesson) => {
        const Icon = lessonTypeIcons[lesson.lessonType];
        return (
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Icon />
                {lessonTypeLabels[lesson.lessonType]}
              </Badge>
              <Badge variant={lesson.status === "published" ? "default" : "outline"}>
                {statusLabels[lesson.status]}
              </Badge>
            </div>
            <p className="break-words font-medium leading-6">{lesson.title}</p>
            <p className="line-clamp-2 max-w-full break-words text-sm leading-6 text-muted-foreground">
              {lesson.description ?? lesson.videoUrl ?? "ยังไม่มีรายละเอียด"}
            </p>
          </div>
        );
      },
    },
    {
      id: "meta",
      header: "ข้อมูล",
      render: (lesson) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>{lesson.durationMinutes} นาที</span>
          <span className="text-muted-foreground">ลำดับ {lesson.sortOrder}</span>
        </div>
      ),
    },
    {
      id: "items",
      header: "รายการ",
      render: (lesson) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{lesson.resources.length} สื่อ</Badge>
          <Badge variant="outline">
            {worksheetCountByLessonId.get(lesson.id) ?? 0} ใบงาน
          </Badge>
          <Badge variant="outline">
            {practiceCountByLessonId.get(lesson.id) ?? 0} แบบฝึก
          </Badge>
          <Badge variant="outline">{lesson.assessments.length} วัดผล</Badge>
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (lesson) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "lesson", lesson })}
          >
            <Edit data-icon="inline-start" />
            แก้
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "resource", lessonId: lesson.id })}
          >
            <Plus data-icon="inline-start" />
            สื่อ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "assessment", target: `lesson:${lesson.id}` })}
          >
            <Plus data-icon="inline-start" />
            วัดผล
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid={`builder-add-worksheet-lesson-${lesson.id}`}
            onClick={() =>
              openModal({
                type: "task",
                taskType: "worksheet",
                sectionId: lesson.sectionId,
                lessonId: lesson.id,
              })
            }
          >
            <Plus data-icon="inline-start" />
            ใบงาน
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid={`builder-add-practice-lesson-${lesson.id}`}
            onClick={() =>
              openModal({
                type: "task",
                taskType: "practice",
                sectionId: lesson.sectionId,
                lessonId: lesson.id,
              })
            }
          >
            <Plus data-icon="inline-start" />
            แบบฝึก
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "delete", target: { entity: "lesson", lesson } })}
          >
            <Trash2 data-icon="inline-start" />
            ลบ
          </Button>
        </div>
      ),
    },
  ];

  const lessonPageColumns: Array<AdminDataTableColumn<LessonRow>> = [
    lessonColumns[0] as AdminDataTableColumn<LessonRow>,
    {
      id: "section",
      header: "หน่วย",
      className: "w-[260px] max-w-[320px] whitespace-normal",
      render: (lesson) => (
        <span className="line-clamp-2 break-words text-sm text-muted-foreground">
          {lesson.sectionTitle}
        </span>
      ),
    },
    lessonColumns[1] as AdminDataTableColumn<LessonRow>,
    lessonColumns[2] as AdminDataTableColumn<LessonRow>,
    lessonColumns[3] as AdminDataTableColumn<LessonRow>,
  ];

  const resourceColumns: Array<AdminDataTableColumn<ResourceRow>> = [
    {
      id: "resource",
      header: "สื่อ",
      className: "min-w-72",
      render: (resource) => (
        <div>
          <p className="font-medium">{resource.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {resource.fileName ?? resource.fileUrl}
          </p>
        </div>
      ),
    },
    {
      id: "lesson",
      header: "บทเรียน",
      render: (resource) => <span className="text-sm">{resource.lessonTitle}</span>,
    },
    {
      id: "section",
      header: "หน่วย",
      className: "w-[240px] max-w-[300px] whitespace-normal",
      render: (resource) => (
        <span className="line-clamp-2 break-words text-sm text-muted-foreground">
          {resource.sectionTitle ?? "-"}
        </span>
      ),
    },
    {
      id: "type",
      header: "ประเภท",
      render: (resource) => (
        <Badge variant="outline">{resourceTypeLabels[resource.resourceType]}</Badge>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (resource) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "resource", resource })}
          >
            <Edit data-icon="inline-start" />
            แก้
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "delete", target: { entity: "resource", resource } })}
          >
            <Trash2 data-icon="inline-start" />
            ลบ
          </Button>
        </div>
      ),
    },
  ];

  const assessmentColumns: Array<AdminDataTableColumn<AssessmentRow>> = [
    {
      id: "assessment",
      header: "กิจกรรมวัดผล",
      className: "min-w-72",
      render: (assessment) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{assessmentTypeLabels[assessment.type]}</Badge>
            <Badge variant={assessment.status === "published" ? "default" : "outline"}>
              {statusLabels[assessment.status]}
            </Badge>
          </div>
          <p className="mt-2 font-medium">{assessment.title}</p>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {assessment.description ?? "ยังไม่มีคำชี้แจง"}
          </p>
        </div>
      ),
    },
    {
      id: "target",
      header: "ผูกกับ",
      render: (assessment) => (
        <span className="text-sm text-muted-foreground">{assessment.targetText}</span>
      ),
    },
    {
      id: "score",
      header: "ข้อสอบ",
      render: (assessment) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{assessment.questionCount} ข้อ</Badge>
          <Badge variant="outline">
            ใช้จริง {assessment.questionLimit ?? assessment.questionCount ?? 0} ข้อ
          </Badge>
          <Badge variant="outline">ผ่าน {assessment.passingScore}%</Badge>
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (assessment) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            onClick={() => openModal({ type: "questions", assessment })}
          >
            <FileQuestion data-icon="inline-start" />
            คำถาม
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal({ type: "assessment", assessment })}
          >
            <Edit data-icon="inline-start" />
            แก้
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openModal({ type: "delete", target: { entity: "assessment", assessment } })
            }
          >
            <Trash2 data-icon="inline-start" />
            ลบ
          </Button>
        </div>
      ),
    },
  ];

  const taskColumns: Array<AdminDataTableColumn<CourseBuilderTask>> = [
    {
      id: "task",
      header: "ใบงาน/แบบฝึก",
      className: "w-[340px] min-w-[260px] max-w-[380px] whitespace-normal",
      render: (task) => (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{taskTypeLabels[task.taskType]}</Badge>
            <Badge variant={task.status === "published" ? "default" : "outline"}>
              {statusLabels[task.status]}
            </Badge>
          </div>
          <p className="mt-1 break-words font-medium leading-6">{task.title}</p>
          <p className="line-clamp-2 max-w-full break-words text-sm leading-6 text-muted-foreground">
            {task.description ?? task.instructionFileName ?? "ยังไม่มีคำอธิบาย"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{task.attachmentCount} ไฟล์แนบ</Badge>
            <Badge variant="outline">{task.rubricCount} rubric</Badge>
          </div>
        </div>
      ),
    },
    {
      id: "target",
      header: "ผูกกับ",
      className: "w-[260px] max-w-[300px] whitespace-normal",
      render: (task) => (
        <div className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="line-clamp-2 break-words">
            {task.lessonTitle
              ? `บทเรียน: ${task.lessonTitle}`
              : task.sectionTitle
                ? `หน่วย: ${task.sectionTitle}`
                : "ระดับหลักสูตร"}
          </span>
          <span className="text-muted-foreground">ลำดับ {task.sortOrder}</span>
        </div>
      ),
    },
    {
      id: "score",
      header: "คะแนน/ส่งงาน",
      render: (task) => (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {formatBuilderNumber(task.maxScore)} คะแนน
          </Badge>
          <Badge variant="outline">ผ่าน {formatTaskPassingScore(task.passingScore, task.maxScore)}</Badge>
          <Badge variant="outline">{submissionModeLabels[task.submissionMode]}</Badge>
          {task.dueDaysAfterEnrollment !== null && (
            <Badge variant="outline">ส่งใน {task.dueDaysAfterEnrollment} วัน</Badge>
          )}
        </div>
      ),
    },
    {
      id: "review",
      header: "การตรวจ",
      render: (task) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>{task.submissionCount} งานส่ง</span>
          <span className="text-muted-foreground">{task.pendingReviewCount} รอตรวจ</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "text-right",
      render: (task) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            title={`แก้ไข${taskTypeLabels[task.taskType]}`}
            onClick={() =>
              openModal({
                type: "task",
                task,
                taskType: task.taskType,
                sectionId: task.sectionId ?? undefined,
                lessonId: task.lessonId ?? undefined,
              })
            }
          >
            <Edit data-icon="inline-start" />
            แก้
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={`ลบ${taskTypeLabels[task.taskType]}`}
            onClick={() => openModal({ type: "delete", target: { entity: "task", task } })}
          >
            <Trash2 data-icon="inline-start" />
            ลบ
          </Button>
        </div>
      ),
    },
  ];

  const courseAssessmentRows: AssessmentRow[] = data.courseAssessments.map((assessment) => ({
    ...assessment,
    targetText: "ระดับหลักสูตร",
  }));

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{data.course.title}</CardTitle>
            <CardDescription>
              {data.course.categoryName} · ผู้สอน {data.course.instructorName} · รวม{" "}
              {Math.round(data.course.durationMinutes / 60)} ชั่วโมง
            </CardDescription>
            <CardAction className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/courses">กลับหลักสูตร</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/courses/${data.course.slug}`}>
                  <LinkIcon data-icon="inline-start" />
                  หน้าเว็บ
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/learning/${data.course.slug}/preview`}>
                  <Eye data-icon="inline-start" />
                  หน้าผู้เรียน
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <SummaryTile icon={Layers} label="หน่วย" value={data.sections.length} />
              <SummaryTile icon={BookOpenCheck} label="บทเรียน" value={lessons.length} />
              <SummaryTile icon={Library} label="สื่อ" value={resources.length} />
              <SummaryTile icon={ClipboardCheck} label="วัดผล" value={assessments.length} />
              <SummaryTile icon={FileText} label="ใบงาน" value={worksheetTasks.length} />
              <SummaryTile icon={ClipboardCheck} label="แบบฝึก" value={practiceTasks.length} />
            </div>

            {actionMessage && (
              <div
                className="rounded-md border bg-secondary/40 px-4 py-3 text-sm"
                role="status"
              >
                {actionMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-lg border bg-secondary/20 p-3">
              <div className="flex flex-wrap gap-2">
                {builderViews.map((view) => (
                  <Button
                    key={view.value}
                    type="button"
                    data-testid={`builder-view-${view.value}`}
                    variant={activeView === view.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveView(view.value)}
                  >
                    {view.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-3 rounded-md bg-background p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{activeViewDetail.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeViewDetail.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeView === "sections" && (
                    <Button
                      data-testid="builder-add-section"
                      onClick={() => openModal({ type: "section" })}
                    >
                      <Plus data-icon="inline-start" />
                      เพิ่มหน่วย
                    </Button>
                  )}
                  {activeView === "lessons" && (
                    <Button
                      data-testid="builder-add-lesson"
                      disabled={!selectedSection}
                      onClick={() =>
                        openModal({ type: "lesson", sectionId: selectedSection?.id })
                      }
                    >
                      <Plus data-icon="inline-start" />
                      เพิ่มบทเรียน
                    </Button>
                  )}
                  {activeView === "resources" && (
                    <Button
                      data-testid="builder-add-resource"
                      disabled={lessons.length === 0}
                      onClick={() => openModal({ type: "resource", lessonId: lessons[0]?.id })}
                    >
                      <Plus data-icon="inline-start" />
                      เพิ่มสื่อ
                    </Button>
                  )}
                  {activeView === "assessments" && (
                    <>
                      <Button
                        data-testid="builder-add-assessment"
                        disabled={!selectedSection}
                        onClick={() =>
                          openModal({
                            type: "assessment",
                            target: selectedSection ? `section:${selectedSection.id}` : "course",
                          })
                        }
                      >
                        <Plus data-icon="inline-start" />
                        เพิ่ม Pre/Post
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openModal({ type: "assessment", target: "course" })}
                      >
                        <Plus data-icon="inline-start" />
                        วัดผลระดับหลักสูตร
                      </Button>
                    </>
                  )}
                  {activeView === "worksheets" && (
                    <Button
                      data-testid="builder-add-worksheet"
                      disabled={!selectedSection}
                      onClick={() =>
                        openModal({
                          type: "task",
                          taskType: "worksheet",
                          sectionId: selectedSection?.id,
                        })
                      }
                    >
                      <Plus data-icon="inline-start" />
                      เพิ่มใบงาน
                    </Button>
                  )}
                  {activeView === "practices" && (
                    <Button
                      data-testid="builder-add-practice"
                      disabled={!selectedSection}
                      onClick={() =>
                        openModal({
                          type: "task",
                          taskType: "practice",
                          sectionId: selectedSection?.id,
                        })
                      }
                    >
                      <Plus data-icon="inline-start" />
                      เพิ่มแบบฝึก
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {activeView === "sections" && (
        <Card>
          <CardHeader>
            <CardTitle>ตารางหน่วยการเรียนรู้</CardTitle>
            <CardDescription>
              เลือกหน่วยเพื่อจัดการบทเรียน สื่อ แบบฝึก แบบทดสอบก่อนเรียน และแบบทดสอบหลังเรียน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={data.sections}
              columns={sectionColumns}
              getRowKey={(section) => String(section.id)}
              getSearchText={(section) =>
                `${section.code ?? ""} ${section.title} ${section.description ?? ""}`
              }
              searchPlaceholder="ค้นหาหน่วยการเรียนรู้"
              pageSize={8}
              emptyText="ยังไม่มีหน่วยการเรียนรู้"
            />
          </CardContent>
        </Card>
        )}

        {activeView === "lessons" && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการบทเรียน</CardTitle>
              <CardDescription>
                แสดงบทเรียนทั้งหมดของหลักสูตร แยกตามหน่วย เพื่อแก้ไข เพิ่มสื่อ วัดผล หรือแบบฝึกจากบทเรียนได้โดยตรง
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  disabled={!selectedSection}
                  onClick={() => openModal({ type: "lesson", sectionId: selectedSection?.id })}
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มบทเรียน
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={lessonRows}
                columns={lessonPageColumns}
                getRowKey={(lesson) => String(lesson.id)}
                getSearchText={(lesson) =>
                  `${lesson.title} ${lesson.description ?? ""} ${lesson.videoUrl ?? ""} ${lesson.sectionTitle}`
                }
                searchPlaceholder="ค้นหาบทเรียน หน่วย หรือรายละเอียด"
                pageSize={8}
                emptyText="ยังไม่มีบทเรียนในหลักสูตรนี้"
              />
            </CardContent>
          </Card>
        )}

        {activeView === "resources" && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการสื่อการเรียน</CardTitle>
              <CardDescription>
                จัดการไฟล์ ใบความรู้ ใบงาน ลิงก์ วิดีโอ และสื่อประกอบทั้งหมดในหลักสูตร
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  disabled={lessons.length === 0}
                  onClick={() => openModal({ type: "resource", lessonId: lessons[0]?.id })}
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มสื่อ
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={resourceRows}
                columns={resourceColumns}
                getRowKey={(resource) => String(resource.id)}
                getSearchText={(resource) =>
                  `${resource.title} ${resource.fileName ?? ""} ${resource.lessonTitle} ${resource.sectionTitle ?? ""}`
                }
                searchPlaceholder="ค้นหาสื่อ บทเรียน หรือหน่วย"
                pageSize={8}
                emptyText="ยังไม่มีสื่อการเรียนในหลักสูตรนี้"
              />
            </CardContent>
          </Card>
        )}

        {activeView === "assessments" && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการข้อสอบและวัดผล</CardTitle>
              <CardDescription>
                จัดการแบบทดสอบก่อนเรียน ระหว่างเรียน หลังเรียน และคำถามทั้งหมดในหลักสูตร
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!selectedSection}
                  onClick={() =>
                    openModal({
                      type: "assessment",
                      target: selectedSection ? `section:${selectedSection.id}` : "course",
                    })
                  }
                >
                  <Plus data-icon="inline-start" />
                  เพิ่ม Pre/Post
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal({ type: "assessment", target: "course" })}
                >
                  <Plus data-icon="inline-start" />
                  วัดผลระดับหลักสูตร
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={assessmentRows}
                columns={assessmentColumns}
                getRowKey={(assessment) => String(assessment.id)}
                getSearchText={(assessment) =>
                  `${assessment.title} ${assessment.description ?? ""} ${assessment.targetText}`
                }
                searchPlaceholder="ค้นหาข้อสอบ กิจกรรมวัดผล หรือหน่วยที่ผูกไว้"
                pageSize={8}
                emptyText="ยังไม่มีข้อสอบหรือกิจกรรมวัดผล"
              />
            </CardContent>
          </Card>
        )}

        {activeView === "worksheets" && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการใบงาน</CardTitle>
              <CardDescription>
                ใบงานใช้สำหรับงานระหว่างเรียนหรือกิจกรรมส่งงานตามบทเรียน ครูสามารถจัดการโจทย์ ไฟล์แนบ rubric และงานรอตรวจจากตารางนี้
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  data-testid="builder-add-worksheet-panel"
                  disabled={!selectedSection}
                  onClick={() =>
                    openModal({
                      type: "task",
                      taskType: "worksheet",
                      sectionId: selectedSection?.id,
                    })
                  }
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มใบงาน
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={worksheetTasks}
                columns={taskColumns}
                getRowKey={(task) => String(task.id)}
                getSearchText={(task) =>
                  `${task.title} ${task.description ?? ""} ${task.sectionTitle ?? ""} ${task.lessonTitle ?? ""}`
                }
                searchPlaceholder="ค้นหาใบงาน หน่วย บทเรียน หรือสถานะงาน"
                pageSize={8}
                emptyText="ยังไม่มีใบงานในหลักสูตรนี้"
              />
            </CardContent>
          </Card>
        )}

        {activeView === "practices" && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการแบบฝึกปฏิบัติ</CardTitle>
              <CardDescription>
                แบบฝึกจะปลดให้ผู้เรียนทำหลังเรียนจบบทเรียนทั้งหมด ครูสามารถจัดการโจทย์ ไฟล์แนบ rubric และงานรอตรวจจากตารางนี้
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  data-testid="builder-add-practice-panel"
                  disabled={!selectedSection}
                  onClick={() =>
                    openModal({
                      type: "task",
                      taskType: "practice",
                      sectionId: selectedSection?.id,
                    })
                  }
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มแบบฝึก
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AdminDataTable
                rows={practiceTasks}
                columns={taskColumns}
                getRowKey={(task) => String(task.id)}
                getSearchText={(task) =>
                  `${task.title} ${task.description ?? ""} ${task.sectionTitle ?? ""} ${task.lessonTitle ?? ""}`
                }
                searchPlaceholder="ค้นหาแบบฝึก หน่วย บทเรียน หรือสถานะงาน"
                pageSize={8}
                emptyText="ยังไม่มีแบบฝึกปฏิบัติในหลักสูตรนี้"
              />
            </CardContent>
          </Card>
        )}

        {false && selectedSection && (
          <Card>
            <CardHeader>
              <CardTitle>จัดการหน่วย: {selectedSection.title}</CardTitle>
              <CardDescription>
                บทเรียน สื่อประกอบ แบบทดสอบก่อนเรียน/หลังเรียน แบบฝึกปฏิบัติ และกิจกรรมวัดผลของหน่วยนี้
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openModal({ type: "section", section: selectedSection })}
                >
                  <Edit data-icon="inline-start" />
                  แก้หน่วย
                </Button>
                <Button
                  size="sm"
                  onClick={() => openModal({ type: "lesson", sectionId: selectedSection.id })}
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มบทเรียน
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="builder-add-practice-selected"
                  onClick={() =>
                    openModal({
                      type: "task",
                      taskType: "practice",
                      sectionId: selectedSection.id,
                    })
                  }
                >
                  <Plus data-icon="inline-start" />
                  เพิ่มแบบฝึก
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {(selectedSection.objectives || selectedSection.competency) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedSection.objectives && (
                    <InfoBlock title="จุดประสงค์การเรียนรู้" value={selectedSection.objectives ?? ""} />
                  )}
                  {selectedSection.competency && (
                    <InfoBlock title="สมรรถนะประจำหน่วย" value={selectedSection.competency ?? ""} />
                  )}
                </div>
              )}

              <PanelTable
                title="บทเรียนในหน่วย"
                description="จัดคลิป ใบความรู้ และกิจกรรมปฏิบัติ"
                action={
                  <Button
                    size="sm"
                    onClick={() => openModal({ type: "lesson", sectionId: selectedSection.id })}
                  >
                    <Plus data-icon="inline-start" />
                    เพิ่มบทเรียน
                  </Button>
                }
              >
                <AdminDataTable
                  rows={selectedLessons}
                  columns={lessonColumns}
                  getRowKey={(lesson) => String(lesson.id)}
                  getSearchText={(lesson) =>
                    `${lesson.title} ${lesson.description ?? ""} ${lesson.videoUrl ?? ""}`
                  }
                  searchPlaceholder="ค้นหาบทเรียน"
                  pageSize={6}
                  emptyText="หน่วยนี้ยังไม่มีบทเรียน"
                />
              </PanelTable>

              <PanelTable
                title="สื่อประกอบของหน่วย"
                description="ไฟล์ ใบความรู้ ใบงาน ลิงก์ และคลิปประกอบ"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedLessons.length === 0}
                    onClick={() =>
                      openModal({ type: "resource", lessonId: selectedLessons[0]?.id })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    เพิ่มสื่อ
                  </Button>
                }
              >
                <AdminDataTable
                  rows={selectedResources}
                  columns={resourceColumns}
                  getRowKey={(resource) => String(resource.id)}
                  getSearchText={(resource) =>
                    `${resource.title} ${resource.fileName ?? ""} ${resource.lessonTitle}`
                  }
                  searchPlaceholder="ค้นหาสื่อ"
                  pageSize={6}
                  emptyText="หน่วยนี้ยังไม่มีสื่อประกอบ"
                />
              </PanelTable>

              <PanelTable
                title="แบบฝึกปฏิบัติและงานส่งของหน่วย"
                description="กำหนดโจทย์ปฏิบัติ ไฟล์แนบ วิธีส่งงาน คะแนน rubric และรายการรอตรวจ"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="builder-add-practice-panel"
                    onClick={() =>
                      openModal({
                        type: "task",
                        taskType: "practice",
                        sectionId: selectedSection.id,
                      })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    เพิ่มแบบฝึก
                  </Button>
                }
              >
                <AdminDataTable
                  rows={selectedPracticeTasks}
                  columns={taskColumns}
                  getRowKey={(task) => String(task.id)}
                  getSearchText={(task) =>
                    `${task.title} ${task.description ?? ""} ${task.sectionTitle ?? ""} ${task.lessonTitle ?? ""}`
                  }
                  searchPlaceholder="ค้นหาแบบฝึก"
                  pageSize={6}
                  emptyText="หน่วยนี้ยังไม่มีแบบฝึกปฏิบัติ"
                />
              </PanelTable>

              <PanelTable
                title="แบบทดสอบและกิจกรรมวัดผลของหน่วย"
                description="จัดการ pre-test, quiz, post-test, ใบงาน และคำถาม"
                action={
                  <Button
                    size="sm"
                    onClick={() =>
                      openModal({ type: "assessment", target: `section:${selectedSection.id}` })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    เพิ่มกิจกรรมวัดผล
                  </Button>
                }
              >
                <AdminDataTable
                  rows={selectedAssessments}
                  columns={assessmentColumns}
                  getRowKey={(assessment) => String(assessment.id)}
                  getSearchText={(assessment) =>
                    `${assessment.title} ${assessment.description ?? ""} ${assessment.targetText}`
                  }
                  searchPlaceholder="ค้นหากิจกรรมวัดผล"
                  pageSize={6}
                  emptyText="หน่วยนี้ยังไม่มีแบบทดสอบหรือกิจกรรมวัดผล"
                />
              </PanelTable>
            </CardContent>
          </Card>
        )}

        {false && (
        <Card>
          <CardHeader>
            <CardTitle>กิจกรรมวัดผลระดับหลักสูตร</CardTitle>
            <CardDescription>
              ใช้กับแบบทดสอบภาพรวม ชิ้นงานสรุป หรือกิจกรรมที่ไม่ผูกกับหน่วยใดโดยตรง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={courseAssessmentRows}
              columns={assessmentColumns}
              getRowKey={(assessment) => String(assessment.id)}
              getSearchText={(assessment) =>
                `${assessment.title} ${assessment.description ?? ""}`
              }
              searchPlaceholder="ค้นหากิจกรรมวัดผลระดับหลักสูตร"
              pageSize={6}
              emptyText="ยังไม่มีกิจกรรมวัดผลระดับหลักสูตร"
            />
          </CardContent>
        </Card>
        )}
      </div>

      <BuilderModals
        data={data}
        lessons={lessons}
        modal={modal}
        isPending={isPending}
        onClose={() => setModal(null)}
        onRunAction={runAction}
        onOpenModal={openModal}
      />
    </>
  );
}

function BuilderModals({
  data,
  lessons,
  modal,
  isPending,
  onClose,
  onRunAction,
  onOpenModal,
}: {
  data: CourseBuilderData;
  lessons: CourseBuilderLesson[];
  modal: BuilderModal | null;
  isPending: boolean;
  onClose: () => void;
  onRunAction: (event: FormEvent<HTMLFormElement>, action: BuilderAction) => void;
  onOpenModal: (modal: BuilderModal) => void;
}) {
  return (
    <>
      <AdminActionModal
        open={modal?.type === "section"}
        title={modal?.type === "section" && modal.section ? "แก้ไขหน่วย" : "เพิ่มหน่วยการเรียนรู้"}
        description="กำหนดโครงสร้าง สมรรถนะ และเกณฑ์ผ่านของหน่วย"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "section" && (
          <SectionForm
            data={data}
            section={modal.section}
            isPending={isPending}
            onSubmit={(event) => onRunAction(event, saveCourseSectionAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "lesson"}
        title={modal?.type === "lesson" && modal.lesson ? "แก้ไขบทเรียน" : "เพิ่มบทเรียน"}
        description="เพิ่มคลิป ใบความรู้ หรือกิจกรรมปฏิบัติภายในหน่วย"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "lesson" && (
          <LessonForm
            data={data}
            lesson={modal.lesson}
            sectionId={modal.sectionId}
            isPending={isPending}
            onSubmit={(event) => onRunAction(event, saveLessonAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "resource"}
        title={modal?.type === "resource" && modal.resource ? "แก้ไขสื่อการเรียน" : "เพิ่มสื่อการเรียน"}
        description="เพิ่มลิงก์ไฟล์ ใบงาน ใบความรู้ หรือสื่อประกอบบทเรียน"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "resource" && (
          <ResourceForm
            data={data}
            lessons={lessons}
            resource={modal.resource}
            lessonId={modal.lessonId}
            isPending={isPending}
            onSubmit={(event) => onRunAction(event, saveLessonResourceAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "assessment"}
        title={
          modal?.type === "assessment" && modal.assessment
            ? "แก้ไขกิจกรรมวัดผล"
            : "เพิ่มกิจกรรมวัดผล"
        }
        description="สร้าง pre-test, quiz, post-test, ใบงาน หรือชิ้นงานสรุป"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "assessment" && (
          <AssessmentForm
            data={data}
            lessons={lessons}
            assessment={modal.assessment}
            target={modal.target}
            isPending={isPending}
            onSubmit={(event) => onRunAction(event, saveAssessmentAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "questions"}
        title={
          modal?.type === "questions"
            ? `จัดการคำถาม: ${modal.assessment.title}`
            : "จัดการคำถาม"
        }
        description="เพิ่มคำถาม ตัวเลือก เฉลย คะแนน และคำอธิบายเฉลย"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "questions" && (
          <QuestionManager
            data={data}
            assessment={modal.assessment}
            question={modal.question}
            isPending={isPending}
            onEditQuestion={(question) =>
              onOpenModal({ type: "questions", assessment: modal.assessment, question })
            }
            onDeleteQuestion={(question) =>
              onOpenModal({ type: "delete", target: { entity: "question", question } })
            }
            onImportSubmit={(event) => onRunAction(event, importQuestionsAction)}
            onSubmit={(event) => onRunAction(event, saveQuestionAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "task"}
        title={
          modal?.type === "task" && modal.task
            ? `แก้ไข${taskTypeLabels[modal.taskType]}`
            : modal?.type === "task"
              ? `เพิ่ม${taskTypeLabels[modal.taskType]}`
              : "จัดการแบบฝึก"
        }
        description="กำหนดโจทย์ ไฟล์แนบ วิธีส่งงาน คะแนน rubric และเงื่อนไขการตรวจงาน"
        size="lg"
        onOpenChange={(open) => !open && onClose()}
      >
        {modal?.type === "task" && (
          <TaskForm
            data={data}
            lessons={lessons}
            task={modal.task}
            taskType={modal.taskType}
            sectionId={modal.sectionId}
            lessonId={modal.lessonId}
            isPending={isPending}
            onSubmit={(event) => onRunAction(event, saveLearningTaskAction)}
          />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={modal?.type === "delete"}
        title="ยืนยันการลบ"
        description="ถ้ารายการมีหลักฐานการเรียนแล้ว ระบบจะเก็บเข้าคลังแทนการลบถาวร"
        size="sm"
        onOpenChange={(open) => !open && onClose()}
        footer={
          modal?.type === "delete" ? (
            <DeleteForm
              data={data}
              target={modal.target}
              isPending={isPending}
              onSubmit={(event, action) => onRunAction(event, action)}
            />
          ) : null
        }
      >
        {modal?.type === "delete" && <DeleteSummary target={modal.target} />}
      </AdminActionModal>
    </>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function PanelTable({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

function HiddenCourseFields({ data }: { data: CourseBuilderData }) {
  return (
    <>
      <input type="hidden" name="courseId" value={data.course.id} />
      <input type="hidden" name="courseSlug" value={data.course.slug} />
    </>
  );
}

function SectionForm({
  data,
  section,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  section?: CourseBuilderSection;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <HiddenCourseFields data={data} />
      {section && <input type="hidden" name="sectionId" value={section.id} />}
      <div className="grid gap-4 md:grid-cols-[0.7fr_1fr_0.7fr]">
        <Field label="รหัสหน่วย">
          <Input name="code" defaultValue={section?.code ?? ""} placeholder="U01" />
        </Field>
        <Field label="ชื่อหน่วย">
          <Input name="title" required defaultValue={section?.title ?? ""} />
        </Field>
        <Field label="ลำดับ">
          <Input
            name="sortOrder"
            type="number"
            min={1}
            defaultValue={section?.sortOrder ?? data.sections.length + 1}
          />
        </Field>
      </div>
      <Field label="คำอธิบายหน่วย">
        <textarea
          name="description"
          className={textAreaClassName}
          defaultValue={section?.description ?? ""}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="จุดประสงค์การเรียนรู้">
          <textarea
            name="objectives"
            className={textAreaClassName}
            defaultValue={section?.objectives ?? ""}
          />
        </Field>
        <Field label="สมรรถนะประจำหน่วย">
          <textarea
            name="competency"
            className={textAreaClassName}
            defaultValue={section?.competency ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="จำนวนชั่วโมง">
          <Input
            name="hours"
            type="number"
            min={0}
            defaultValue={section?.hours ?? 0}
          />
        </Field>
        <Field label="รูปแบบการเรียน">
          <Select name="learningMode" defaultValue={section?.learningMode ?? "online"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกรูปแบบ" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(learningModeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="เกณฑ์ผ่านหน่วย (%)">
          <Input
            name="passingScore"
            type="number"
            min={0}
            max={100}
            defaultValue={section?.passingScore ?? 70}
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="เงื่อนไขปลดล็อก">
          <Input
            name="unlockRule"
            defaultValue={section?.unlockRule ?? "manual"}
            placeholder="manual, previous_passed"
          />
        </Field>
        <StatusSelect
          name="status"
          label="สถานะ"
          defaultValue={section?.status ?? "draft"}
        />
      </div>
      <SubmitRow isPending={isPending} label="บันทึกหน่วย" />
    </form>
  );
}

function LessonForm({
  data,
  lesson,
  sectionId,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  lesson?: CourseBuilderLesson;
  sectionId?: number;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (data.sections.length === 0) {
    return <p className="text-sm text-muted-foreground">กรุณาเพิ่มหน่วยก่อนเพิ่มบทเรียน</p>;
  }

  const defaultSectionId = String(lesson?.sectionId ?? sectionId ?? data.sections[0].id);

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <HiddenCourseFields data={data} />
      {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr_0.5fr]">
        <Field label="หน่วย">
          <Select name="sectionId" defaultValue={defaultSectionId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกหน่วย" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {data.sections.map((section) => (
                  <SelectItem key={section.id} value={String(section.id)}>
                    {section.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ประเภทบทเรียน">
          <Select name="lessonType" defaultValue={lesson?.lessonType ?? "video"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(lessonTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ลำดับ">
          <Input name="sortOrder" type="number" min={1} defaultValue={lesson?.sortOrder ?? ""} />
        </Field>
      </div>
      <Field label="ชื่อบทเรียน">
        <Input name="title" required defaultValue={lesson?.title ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-[1fr_0.4fr]">
        <Field label="ลิงก์วิดีโอหรือบทเรียน">
          <Input name="videoUrl" defaultValue={lesson?.videoUrl ?? ""} />
        </Field>
        <Field label="ระยะเวลา (นาที)">
          <Input
            name="durationMinutes"
            type="number"
            min={0}
            defaultValue={lesson?.durationMinutes ?? 0}
          />
        </Field>
      </div>
      <Field label="คำอธิบาย">
        <textarea
          name="description"
          className={textAreaClassName}
          defaultValue={lesson?.description ?? ""}
        />
      </Field>
      <Field label="เนื้อหา / คำชี้แจง">
        <textarea
          name="content"
          className={cn(textAreaClassName, "min-h-32")}
          defaultValue={lesson?.content ?? ""}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <StatusSelect
          name="status"
          label="สถานะ"
          defaultValue={lesson?.status ?? "draft"}
        />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            name="isPreview"
            type="checkbox"
            defaultChecked={lesson?.isPreview ?? false}
            className="size-4 rounded border-input"
          />
          เปิดเป็นบทเรียนตัวอย่าง
        </label>
      </div>
      <SubmitRow isPending={isPending} label="บันทึกบทเรียน" />
    </form>
  );
}

function ResourceForm({
  data,
  lessons,
  resource,
  lessonId,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  lessons: CourseBuilderLesson[];
  resource?: CourseBuilderResource;
  lessonId?: number;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (lessons.length === 0) {
    return <p className="text-sm text-muted-foreground">กรุณาเพิ่มบทเรียนก่อนเพิ่มสื่อ</p>;
  }

  const defaultLessonId = String(resource?.lessonId ?? lessonId ?? lessons[0].id);

  return (
    <form className="flex flex-col gap-4" encType="multipart/form-data" onSubmit={onSubmit}>
      <HiddenCourseFields data={data} />
      {resource && <input type="hidden" name="resourceId" value={resource.id} />}
      <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_0.4fr]">
        <Field label="บทเรียน">
          <Select name="lessonId" defaultValue={defaultLessonId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกบทเรียน" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={String(lesson.id)}>
                    {lesson.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ประเภทสื่อ">
          <Select name="resourceType" defaultValue={resource?.resourceType ?? "pdf"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(resourceTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ลำดับ">
          <Input
            name="sortOrder"
            type="number"
            min={1}
            defaultValue={resource?.sortOrder ?? ""}
          />
        </Field>
      </div>
      <Field label="ชื่อสื่อ">
        <Input name="title" required defaultValue={resource?.title ?? ""} />
      </Field>
      <div className="rounded-lg border bg-secondary/20 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Upload className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">อัปโหลดไฟล์สื่อ</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอ, ZIP และไฟล์ข้อความ ขนาดไม่เกิน 25 MB
              </p>
            </div>
          </div>
          <UploadField
            name="resourceFile"
            label="เลือกไฟล์สื่อ"
            description="รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอ, ZIP, TXT และ CSV"
            accept={builderUploadAccept}
            allowedExtensions={Array.from(allowedBuilderUploadExtensions)}
            maxBytes={maxBuilderUploadSizeBytes}
            currentFileName={resource?.fileName ?? null}
            currentFileUrl={resource?.fileUrl ?? null}
            isPending={isPending}
          />
          {resource?.fileName && (
            <p className="text-sm text-muted-foreground">ไฟล์เดิม: {resource.fileName}</p>
          )}
        </div>
      </div>
      <Field label="URL ไฟล์หรือลิงก์">
        <Input
          name="fileUrl"
          defaultValue={resource?.fileUrl ?? ""}
          placeholder="ถ้าไม่อัปโหลดไฟล์ ให้กรอก URL หรือ path ของไฟล์"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="ชื่อไฟล์">
          <Input name="fileName" defaultValue={resource?.fileName ?? ""} />
        </Field>
        <Field label="ขนาดไฟล์">
          <Input name="fileSize" defaultValue={resource?.fileSize ?? ""} placeholder="2.4 MB" />
        </Field>
        <StatusSelect
          name="status"
          label="สถานะ"
          defaultValue={resource?.status ?? "published"}
        />
      </div>
      <SubmitRow isPending={isPending} label="บันทึกสื่อ" />
    </form>
  );
}

function getNextTaskOrder(data: CourseBuilderData, taskType: CourseBuilderTaskType) {
  const taskOrders = data.tasks
    .filter((task) => task.taskType === taskType)
    .map((task) => task.sortOrder);
  return taskOrders.length ? Math.max(...taskOrders) + 1 : 1;
}

function TaskForm({
  data,
  lessons,
  task,
  taskType,
  sectionId,
  lessonId,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  lessons: CourseBuilderLesson[];
  task?: CourseBuilderTask;
  taskType: CourseBuilderTaskType;
  sectionId?: number;
  lessonId?: number;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaultSectionId = String(task?.sectionId ?? sectionId ?? "");
  const defaultLessonId = String(task?.lessonId ?? lessonId ?? "");
  const defaultSortOrder = task?.sortOrder ?? getNextTaskOrder(data, taskType);
  const firstAttachment = task?.attachments[0];
  const rubrics = task?.rubrics ?? [];

  return (
    <form
      className="flex flex-col gap-5"
      encType="multipart/form-data"
      onSubmit={onSubmit}
    >
      <HiddenCourseFields data={data} />
      <input type="hidden" name="taskType" value={taskType} />
      {task && <input type="hidden" name="taskId" value={task.id} />}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.45fr]">
        <Field label="หน่วย">
          <select
            name="sectionId"
            defaultValue={defaultSectionId}
            className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">ระดับหลักสูตร</option>
            {data.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="บทเรียน">
          <select
            name="lessonId"
            defaultValue={defaultLessonId}
            className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">ไม่ผูกบทเรียน</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ลำดับ">
          <Input name="sortOrder" type="number" min={1} defaultValue={defaultSortOrder} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <Field label={`ชื่อ${taskTypeLabels[taskType]}`}>
          <Input name="title" required defaultValue={task?.title ?? ""} />
        </Field>
        <StatusSelect
          name="status"
          label="สถานะ"
          defaultValue={task?.status ?? "published"}
        />
      </div>

      <Field label="คำอธิบาย">
        <textarea
          name="description"
          className={textAreaClassName}
          defaultValue={task?.description ?? ""}
        />
      </Field>

      <Field label="โจทย์ / คำชี้แจง">
        <textarea
          name="instructionHtml"
          className={cn(textAreaClassName, "min-h-32")}
          defaultValue={task?.instructionHtml ?? ""}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="คะแนนเต็ม">
          <Input
            name="maxScore"
            type="number"
            min={0}
            step="0.1"
            defaultValue={task?.maxScore ?? 100}
          />
        </Field>
        <Field label="คะแนนผ่าน (คะแนน)">
          <Input
            name="passingScore"
            type="number"
            min={0}
            step="0.1"
            defaultValue={task?.passingScore ?? 70}
          />
          <p className="text-xs text-muted-foreground">
            ใช้คะแนนดิบ เช่น คะแนนเต็ม 20 ผ่าน 14 เท่ากับ 70%
          </p>
        </Field>
        <Field label="น้ำหนัก (%)">
          <Input
            name="weightPercent"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={task?.weightPercent ?? 25}
          />
        </Field>
        <Field label="กำหนดส่งหลังลงทะเบียน">
          <Input
            name="dueDaysAfterEnrollment"
            type="number"
            min={0}
            defaultValue={task?.dueDaysAfterEnrollment ?? ""}
            placeholder="วัน"
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_0.7fr]">
        <Field label="วิธีส่งงาน">
          <select
            name="submissionMode"
            defaultValue={task?.submissionMode ?? "file_or_link"}
            className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            {Object.entries(submissionModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="จำนวนหลักฐานที่ต้องแนบ">
          <Input
            name="evidenceRequiredCount"
            type="number"
            min={0}
            defaultValue={task?.evidenceRequiredCount ?? 0}
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CheckboxField
          name="allowResubmission"
          label="อนุญาตให้ผู้เรียนส่งแก้ไขได้"
          defaultChecked={task?.allowResubmission ?? true}
        />
        <CheckboxField
          name="requireEvidence"
          label="ต้องแนบหลักฐานประกอบ"
          defaultChecked={task?.requireEvidence ?? false}
        />
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-secondary/20 p-4 md:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">อัปโหลดไฟล์โจทย์หรือใบงาน</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอ, ZIP และไฟล์ข้อความ ขนาดไม่เกิน 25 MB
                </p>
              </div>
            </div>
            <UploadField
              name="instructionFile"
              label="เลือกไฟล์โจทย์หรือใบงาน"
              description="รองรับ PDF, Word, Excel, PowerPoint, รูปภาพ, วิดีโอ, ZIP, TXT และ CSV"
              accept={builderUploadAccept}
              allowedExtensions={Array.from(allowedBuilderUploadExtensions)}
              maxBytes={maxBuilderUploadSizeBytes}
              currentFileName={task?.instructionFileName ?? null}
              currentFileUrl={task?.instructionFileUrl ?? null}
              isPending={isPending}
            />
            {task?.instructionFileName && (
              <p className="text-sm text-muted-foreground">
                ไฟล์โจทย์เดิม: {task.instructionFileName}
              </p>
            )}
          </div>
        </div>
        <Field label="URL ไฟล์โจทย์">
          <Input
            name="instructionFileUrl"
            defaultValue={task?.instructionFileUrl ?? ""}
            placeholder="/uploads/learning-tasks/..."
          />
        </Field>
        <Field label="ชื่อไฟล์โจทย์">
          <Input name="instructionFileName" defaultValue={task?.instructionFileName ?? ""} />
        </Field>

        <div className="rounded-lg border bg-secondary/20 p-4 md:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">อัปโหลดไฟล์แนบประกอบแบบฝึก</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  ใช้สำหรับตัวอย่างงาน ชุดข้อมูล ภาพประกอบ หรือไฟล์ต้นฉบับที่ผู้เรียนต้องดาวน์โหลด
                </p>
              </div>
            </div>
            <UploadField
              name="attachmentFile"
              label="เลือกไฟล์แนบประกอบ"
              description="ใช้สำหรับตัวอย่างงาน ชุดข้อมูล ภาพประกอบ หรือไฟล์ต้นฉบับ"
              accept={builderUploadAccept}
              allowedExtensions={Array.from(allowedBuilderUploadExtensions)}
              maxBytes={maxBuilderUploadSizeBytes}
              currentFileName={firstAttachment?.fileName ?? null}
              currentFileUrl={firstAttachment?.fileUrl ?? null}
              isPending={isPending}
            />
            {firstAttachment?.fileName && (
              <p className="text-sm text-muted-foreground">
                ไฟล์แนบเดิม: {firstAttachment.fileName}
              </p>
            )}
          </div>
        </div>
        <Field label="URL ไฟล์แนบ / ลิงก์ประกอบ">
          <Input name="attachmentUrl" defaultValue={firstAttachment?.fileUrl ?? ""} />
        </Field>
        <Field label="ชื่อไฟล์แนบ">
          <Input name="attachmentFileName" defaultValue={firstAttachment?.fileName ?? ""} />
        </Field>
        <Field label="ชื่อรายการไฟล์แนบ">
          <Input name="attachmentTitle" defaultValue={firstAttachment?.title ?? ""} />
        </Field>
        <Field label="ประเภทไฟล์แนบ">
          <select
            name="attachmentFileType"
            defaultValue={firstAttachment?.fileType ?? "other"}
            className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="pdf">PDF</option>
            <option value="doc">เอกสาร</option>
            <option value="sheet">ตารางคำนวณ</option>
            <option value="image">รูปภาพ</option>
            <option value="link">ลิงก์</option>
            <option value="other">อื่น ๆ</option>
          </select>
        </Field>
        <input
          type="hidden"
          name="resourceUrl"
          value={firstAttachment?.fileUrl ?? task?.resourceUrl ?? ""}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <p className="font-semibold">Rubric การให้คะแนน</p>
          <p className="mt-1 text-sm text-muted-foreground">
            กำหนดหัวข้อประเมินเพื่อให้ครูตรวจงานได้เป็นมาตรฐานเดียวกัน
          </p>
        </div>
        {[1, 2, 3, 4].map((index) => {
          const rubric = rubrics[index - 1];
          return (
            <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_120px]">
              <div className="grid gap-3">
                <Input
                  name={`rubricTitle${index}`}
                  defaultValue={rubric?.title ?? ""}
                  placeholder={`หัวข้อ rubric ${index}`}
                />
                <Input
                  name={`rubricDescription${index}`}
                  defaultValue={rubric?.description ?? ""}
                  placeholder="คำอธิบาย"
                />
              </div>
              <Input
                name={`rubricScore${index}`}
                type="number"
                min={0}
                step="0.1"
                defaultValue={rubric?.maxScore ?? ""}
                placeholder="คะแนน"
              />
            </div>
          );
        })}
      </div>

      <SubmitRow isPending={isPending} label={`บันทึก${taskTypeLabels[taskType]}`} />
    </form>
  );
}

function AssessmentForm({
  data,
  lessons,
  assessment,
  target,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  lessons: CourseBuilderLesson[];
  assessment?: CourseBuilderAssessment;
  target?: string;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaultTarget =
    target ??
    (assessment?.lessonId
      ? `lesson:${assessment.lessonId}`
      : assessment?.sectionId
        ? `section:${assessment.sectionId}`
        : "course");
  const sourceAssessments = [
    ...data.courseAssessments,
    ...data.sections.flatMap((section) => [
      ...section.assessments,
      ...section.lessons.flatMap((lesson) => lesson.assessments),
    ]),
  ].filter((item) => item.id !== assessment?.id && item.type !== "assignment" && item.type !== "final_project");

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <HiddenCourseFields data={data} />
      {assessment && <input type="hidden" name="assessmentId" value={assessment.id} />}
      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr_0.4fr]">
        <Field label="ผูกกับ">
          <Select name="target" defaultValue={defaultTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกตำแหน่ง" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="course">ระดับหลักสูตร</SelectItem>
                {data.sections.map((section) => (
                  <SelectItem key={section.id} value={`section:${section.id}`}>
                    หน่วย: {section.title}
                  </SelectItem>
                ))}
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={`lesson:${lesson.id}`}>
                    บทเรียน: {lesson.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ประเภท">
          <Select name="type" defaultValue={assessment?.type ?? "pre_test"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(assessmentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="ลำดับ">
          <Input
            name="sortOrder"
            type="number"
            min={1}
            defaultValue={assessment?.sortOrder ?? ""}
          />
        </Field>
      </div>
      <Field label="ชื่อกิจกรรมวัดผล">
        <Input name="title" required defaultValue={assessment?.title ?? ""} />
      </Field>
      <Field label="คำอธิบาย / คำชี้แจง">
        <textarea
          name="description"
          className={textAreaClassName}
          defaultValue={assessment?.description ?? ""}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="เกณฑ์ผ่าน (%)">
          <Input
            name="passingScore"
            type="number"
            min={0}
            max={100}
            defaultValue={assessment?.passingScore ?? 70}
          />
        </Field>
        <Field label="ทำได้กี่ครั้ง">
          <Input
            name="maxAttempts"
            type="number"
            min={1}
            defaultValue={assessment?.maxAttempts ?? ""}
            placeholder="ไม่จำกัด"
          />
        </Field>
        <Field label="จำนวนข้อที่ใช้สอบ">
          <Input
            name="questionLimit"
            type="number"
            min={1}
            defaultValue={assessment?.questionLimit ?? ""}
            placeholder="ใช้ทุกข้อ"
          />
        </Field>
        <Field label="จำกัดเวลา (นาที)">
          <Input
            name="timeLimitMinutes"
            type="number"
            min={1}
            defaultValue={assessment?.timeLimitMinutes ?? ""}
            placeholder="ไม่จำกัด"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ใช้คลังคำถามร่วมกับ">
          <Select name="sharedQuestionSourceId" defaultValue={String(assessment?.sharedQuestionSourceId ?? 0)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="ใช้คำถามของแบบทดสอบนี้" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="0">ใช้คำถามของแบบทดสอบนี้</SelectItem>
                {sourceAssessments.map((source) => (
                  <SelectItem key={source.id} value={String(source.id)}>
                    {assessmentTypeLabels[source.type]}: {source.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div className="rounded-md border bg-secondary/30 p-3 text-sm leading-6 text-muted-foreground">
          ก่อนเรียนจะไม่นำคะแนนไปตัดสินผล ส่วนหลังเรียนสามารถเลือกใช้คลังคำถามเดียวกับก่อนเรียนและสุ่มข้อสอบตามจำนวนที่กำหนดได้
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="แสดงเฉลย">
          <Select name="showAnswers" defaultValue={assessment?.showAnswers ?? "after_close"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกการแสดงเฉลย" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(showAnswerLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <StatusSelect
          name="status"
          label="สถานะ"
          defaultValue={assessment?.status ?? "draft"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <CheckboxField
          name="isRequired"
          label="เป็นกิจกรรมบังคับ"
          defaultChecked={assessment?.isRequired ?? true}
        />
        <CheckboxField
          name="randomizeQuestions"
          label="สุ่มข้อสอบ"
          defaultChecked={assessment?.randomizeQuestions ?? false}
        />
        <CheckboxField
          name="randomizeOptions"
          label="สุ่มตัวเลือก"
          defaultChecked={assessment?.randomizeOptions ?? false}
        />
      </div>
      <SubmitRow isPending={isPending} label="บันทึกกิจกรรมวัดผล" />
    </form>
  );
}

function QuestionManager({
  data,
  assessment,
  question,
  isPending,
  onEditQuestion,
  onDeleteQuestion,
  onImportSubmit,
  onSubmit,
}: {
  data: CourseBuilderData;
  assessment: CourseBuilderAssessment;
  question?: CourseBuilderQuestion;
  isPending: boolean;
  onEditQuestion: (question: CourseBuilderQuestion) => void;
  onDeleteQuestion: (question: CourseBuilderQuestion) => void;
  onImportSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [questionView, setQuestionView] = useState<"answerKey" | "learner">("answerKey");
  const optionDefaults =
    question?.options.length
      ? question.options
      : [
          { optionText: "ถูก", isCorrect: false },
          { optionText: "ผิด", isCorrect: false },
          { optionText: "", isCorrect: false },
          { optionText: "", isCorrect: false },
          { optionText: "", isCorrect: false },
        ];
  const totalScore = assessment.questions.reduce((sum, item) => sum + item.score, 0);
  const optionLabels = ["ก", "ข", "ค", "ง", "จ"];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">รายการคำถาม</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {assessment.questions.length} ข้อ · รวม {formatBuilderNumber(totalScore)} คะแนน · เกณฑ์ผ่าน {assessment.passingScore}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={questionView === "answerKey" ? "default" : "outline"}
              size="sm"
              onClick={() => setQuestionView("answerKey")}
            >
              <CheckCircle2 className="size-4" />
              ตรวจทานพร้อมเฉลย
            </Button>
            <Button
              type="button"
              variant={questionView === "learner" ? "default" : "outline"}
              size="sm"
              onClick={() => setQuestionView("learner")}
            >
              <Eye className="size-4" />
              มุมมองผู้สอบ
            </Button>
            {question && <Badge variant="secondary">กำลังแก้ไขคำถาม</Badge>}
          </div>
        </div>
        <Separator className="my-4" />
        {assessment.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีคำถามในแบบทดสอบนี้</p>
        ) : (
          <div className="flex flex-col gap-3">
            {assessment.questions.map((item, index) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{index + 1}</Badge>
                      <Badge variant="outline">{questionTypeLabels[item.questionType]}</Badge>
                      <Badge variant={item.status === "active" ? "secondary" : "outline"}>
                        {item.status === "active" ? "ใช้งาน" : "ปิดใช้"}
                      </Badge>
                      <Badge variant="outline">{formatBuilderNumber(item.score)} คะแนน</Badge>
                    </div>
                    <p className="mt-2 font-medium">{item.questionText}</p>
                    {item.options.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {item.options.map((option, optionIndex) => {
                          const isCorrect = option.isCorrect;
                          const showAnswer = questionView === "answerKey";

                          return (
                            <div
                              key={option.id}
                              className={cn(
                                "flex items-start gap-3 rounded-md border p-3 text-sm",
                                showAnswer && isCorrect
                                  ? "border-primary/45 bg-primary/10"
                                  : "bg-background",
                              )}
                            >
                              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                                {optionLabels[optionIndex] ?? optionIndex + 1}
                              </span>
                              <label className="flex min-w-0 flex-1 items-start gap-2">
                                {questionView === "learner" && (
                                  <input
                                    type={item.questionType === "multiple_choice" ? "checkbox" : "radio"}
                                    disabled
                                    className="mt-1 size-4 shrink-0"
                                  />
                                )}
                                <span className="break-words leading-6">{option.optionText}</span>
                              </label>
                              {showAnswer && isCorrect && (
                                <Badge className="shrink-0">
                                  <CheckCircle2 className="size-3" />
                                  เฉลย
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        คำถามนี้ไม่มีตัวเลือก ระบบจะแสดงช่องคำตอบตามประเภทคำถามให้ผู้สอบ
                      </p>
                    )}
                    {questionView === "answerKey" && item.explanation && (
                      <div className="mt-3 rounded-md border bg-secondary/35 p-3 text-sm leading-6">
                        <span className="font-medium">คำอธิบายเฉลย: </span>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditQuestion(item)}
                    >
                      <Edit data-icon="inline-start" />
                      แก้
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteQuestion(item)}
                    >
                      <Trash2 data-icon="inline-start" />
                      ลบ
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        className="flex flex-col gap-4 rounded-md border bg-secondary/20 p-4"
        encType="multipart/form-data"
        onSubmit={onImportSubmit}
      >
        <HiddenCourseFields data={data} />
        <input type="hidden" name="assessmentId" value={assessment.questionSourceAssessmentId} />
        <div>
          <p className="font-medium">นำเข้าข้อสอบ 4 ตัวเลือกหลายข้อ</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            วางข้อความหรืออัปโหลดไฟล์ .txt/.csv ระบบจะตรวจว่าทุกข้อมีตัวเลือก ก ข ค ง และมีเฉลยก่อนบันทึกเข้าคลังข้อสอบ
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <Field label="ข้อความข้อสอบ">
            <textarea
              name="importText"
              className={cn(textAreaClassName, "min-h-44 font-mono text-xs leading-6")}
              placeholder={`1. โปรแกรมใดใช้สำหรับจัดทำเอกสาร?\nก. Microsoft Word\nข. Microsoft Excel\nค. Microsoft PowerPoint\nง. Microsoft Access\nเฉลย: ก\nอธิบาย: Microsoft Word ใช้สำหรับงานเอกสาร`}
            />
          </Field>
          <div className="grid content-start gap-4">
            <Field label="ไฟล์นำเข้า">
              <Input name="questionImportFile" type="file" accept=".txt,.csv" />
            </Field>
            <div className="rounded-md border bg-background p-3 text-xs leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">CSV columns</p>
              <p>question, choice_a, choice_b, choice_c, choice_d, answer, score, explanation</p>
              <p className="mt-2">answer ใช้ ก/ข/ค/ง หรือ A/B/C/D ได้</p>
            </div>
          </div>
        </div>
        <SubmitRow isPending={isPending} label="นำเข้าข้อสอบเข้าคลัง" />
      </form>

      <form className="flex flex-col gap-4 rounded-md border p-4" onSubmit={onSubmit}>
        <HiddenCourseFields data={data} />
        <input type="hidden" name="assessmentId" value={assessment.questionSourceAssessmentId} />
        {question && <input type="hidden" name="questionId" value={question.id} />}
        <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_0.4fr]">
          <Field label="ประเภทคำถาม">
            <Select name="questionType" defaultValue={question?.questionType ?? "single_choice"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกประเภทคำถาม" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(questionTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field label="สถานะ">
            <Select name="status" defaultValue={question?.status ?? "active"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">ใช้งาน</SelectItem>
                  <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                  <SelectItem value="archived">เก็บเข้าคลัง</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field label="ลำดับ">
            <Input name="sortOrder" type="number" min={1} defaultValue={question?.sortOrder ?? ""} />
          </Field>
        </div>
        <Field label="คำถาม">
          <textarea
            name="questionText"
            required
            className={textAreaClassName}
            defaultValue={question?.questionText ?? ""}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-[0.4fr_1fr]">
          <Field label="คะแนน">
            <Input name="score" type="number" min={0} step="0.5" defaultValue={question?.score ?? 1} />
          </Field>
          <Field label="คำอธิบายเฉลย">
            <Input name="explanation" defaultValue={question?.explanation ?? ""} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <Label>ตัวเลือกและเฉลย</Label>
          {Array.from({ length: 5 }).map((_, index) => {
            const option = optionDefaults[index];
            return (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  name="optionText"
                  defaultValue={option?.optionText ?? ""}
                  placeholder={`ตัวเลือกที่ ${index + 1}`}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="correctOption"
                    value={String(index)}
                    defaultChecked={option?.isCorrect ?? false}
                    className="size-4 rounded border-input"
                  />
                  เฉลย
                </label>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            คำถามแบบอัตนัย/อัปโหลดไฟล์ไม่จำเป็นต้องมีตัวเลือก
          </p>
        </div>
        <SubmitRow isPending={isPending} label={question ? "บันทึกคำถาม" : "เพิ่มคำถาม"} />
      </form>
    </div>
  );
}

function DeleteSummary({ target }: { target: DeleteTarget }) {
  const label =
    target.entity === "section"
      ? target.section.title
      : target.entity === "lesson"
        ? target.lesson.title
        : target.entity === "resource"
          ? target.resource.title
          : target.entity === "assessment"
            ? target.assessment.title
            : target.entity === "task"
              ? target.task.title
              : target.question.questionText;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        คุณต้องการลบรายการนี้หรือไม่
      </p>
      <div className="rounded-md border bg-secondary/40 p-3 font-medium">{label}</div>
      <p className="text-sm text-muted-foreground">
        ระบบจะตรวจสอบหลักฐานการเรียนก่อน ถ้ามีข้อมูลผู้เรียนแล้วจะเก็บเข้าคลังแทน
      </p>
    </div>
  );
}

function DeleteForm({
  data,
  target,
  isPending,
  onSubmit,
}: {
  data: CourseBuilderData;
  target: DeleteTarget;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, action: BuilderAction) => void;
}) {
  const action =
    target.entity === "section"
      ? deleteCourseSectionAction
      : target.entity === "lesson"
        ? deleteLessonAction
        : target.entity === "resource"
          ? deleteLessonResourceAction
          : target.entity === "assessment"
            ? deleteAssessmentAction
            : target.entity === "task"
              ? archiveLearningTaskAction
              : deleteQuestionAction;
  const idName =
    target.entity === "section"
      ? "sectionId"
      : target.entity === "lesson"
        ? "lessonId"
        : target.entity === "resource"
          ? "resourceId"
          : target.entity === "assessment"
            ? "assessmentId"
            : target.entity === "task"
              ? "taskId"
              : "questionId";
  const idValue =
    target.entity === "section"
      ? target.section.id
      : target.entity === "lesson"
        ? target.lesson.id
        : target.entity === "resource"
          ? target.resource.id
          : target.entity === "assessment"
            ? target.assessment.id
            : target.entity === "task"
              ? target.task.id
              : target.question.id;

  return (
    <form className="flex justify-end gap-2" onSubmit={(event) => onSubmit(event, action)}>
      <HiddenCourseFields data={data} />
      <input type="hidden" name={idName} value={idValue} />
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "กำลังลบ..." : "ยืนยันลบ"}
      </Button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StatusSelect({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: BuilderPublishStatus;
}) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="เลือกสถานะ" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="draft">ฉบับร่าง</SelectItem>
            <SelectItem value="published">เผยแพร่</SelectItem>
            <SelectItem value="archived">เก็บเข้าคลัง</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input"
      />
      {label}
    </label>
  );
}

function SubmitRow({ isPending, label }: { isPending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t pt-4">
      <Button type="submit" disabled={isPending}>
        {isPending ? "กำลังบันทึก..." : label}
      </Button>
    </div>
  );
}
