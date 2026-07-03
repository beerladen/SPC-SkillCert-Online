"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Award,
  Calculator,
  CheckCircle2,
  Edit,
  Eye,
  ImageIcon,
  Layers,
  PenLine,
  Plus,
  Save,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import {
  archiveCourseAction,
  deleteCourseAction,
  saveCourseAction,
} from "@/app/admin/courses/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UploadField } from "@/components/ui/upload-field";
import type {
  CourseCategoryOption,
  CourseInstructorOption,
  CourseManagementData,
  CertificateDocumentType,
  CourseManagementFormat,
  CourseManagementLevel,
  CourseManagementRow,
  CourseManagementStatus,
  PromotionDiscountType,
} from "@/lib/db-repositories";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AdminCoursesWorkspaceProps {
  data: CourseManagementData;
  loadError?: string;
}

const statusOptions: Array<{ value: CourseManagementStatus; label: string }> = [
  { value: "draft", label: "ฉบับร่าง" },
  { value: "open", label: "เปิดรับสมัคร" },
  { value: "nearly_full", label: "ใกล้เต็ม" },
  { value: "closed", label: "ปิดรับสมัคร" },
  { value: "archived", label: "เก็บเข้าคลัง" },
];

const formatOptions: Array<{ value: CourseManagementFormat; label: string }> = [
  { value: "online", label: "ออนไลน์" },
  { value: "live_online", label: "ออนไลน์ + สด" },
  { value: "recorded", label: "เรียนย้อนหลัง" },
];

const levelOptions: Array<{ value: CourseManagementLevel; label: string }> = [
  { value: "beginner", label: "เริ่มต้น" },
  { value: "intermediate", label: "กลาง" },
  { value: "advanced", label: "สูง" },
];

const discountTypeOptions: Array<{ value: PromotionDiscountType; label: string }> = [
  { value: "amount", label: "ลดเป็นจำนวนเงิน" },
  { value: "percent", label: "ลดเป็นเปอร์เซ็นต์" },
];

const certificateDocumentTypeOptions: Array<{
  value: CertificateDocumentType;
  label: string;
  description: string;
}> = [
  {
    value: "honor_certificate",
    label: "เกียรติบัตร",
    description: "เหมาะกับหลักสูตรอบรมทั่วไป ลงนามผู้อำนวยการ 1 ตำแหน่ง",
  },
  {
    value: "certificate",
    label: "ใบประกาศนียบัตร",
    description: "เหมาะกับหลักสูตรที่มีการวัดผลจริง ลงนามนายทะเบียนและผู้อำนวยการ",
  },
];

const textAreaClassName =
  "min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const maxCoverImageSizeBytes = 4 * 1024 * 1024;
const allowedCoverImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedCoverImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function getCoverImageValidationMessage(file: File) {
  if (file.size > maxCoverImageSizeBytes) {
    return "ไฟล์ภาพปกต้องมีขนาดไม่เกิน 4MB กรุณาย่อขนาดภาพก่อนอัปโหลด";
  }

  if (!allowedCoverImageTypes.has(file.type) && !allowedCoverImageExtensions.has(getFileExtension(file.name))) {
    return "รองรับเฉพาะภาพปกชนิด JPG, PNG หรือ WebP";
  }

  return null;
}

export function AdminCoursesWorkspace({ data, loadError }: AdminCoursesWorkspaceProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(data.categories);
  const [activeCourse, setActiveCourse] = useState<CourseManagementRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CourseManagementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseManagementRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isArchiving, startArchiveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const openCreateForm = () => {
    setActionMessage(null);
    setActiveCourse(null);
    setFormOpen(true);
  };

  const openEditForm = (course: CourseManagementRow) => {
    setActionMessage(null);
    setActiveCourse(course);
    setFormOpen(true);
  };

  const columns: Array<AdminDataTableColumn<CourseManagementRow>> = [
    {
      id: "course",
      header: "หลักสูตร",
      className: "min-w-80",
      render: (course) => (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{course.title}</p>
          <p className="text-xs text-muted-foreground">{course.slug}</p>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {course.shortDescription ?? "ยังไม่มีคำอธิบายย่อ"}
          </p>
        </div>
      ),
    },
    {
      id: "category",
      header: "หมวดหมู่",
      render: (course) => (
        <div className="flex flex-col gap-2">
          <Badge variant="outline">
            {course.categoryIcon} {course.categoryName}
          </Badge>
          {course.promotionName && (
            <Badge variant="secondary">
              <Tags data-icon="inline-start" />
              {course.promotionName}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "instructor",
      header: "ผู้สอน",
      render: (course) => (
        <div>
          <p className="font-medium">{course.instructorName}</p>
          <p className="text-xs text-muted-foreground">{course.instructorEmail}</p>
          {course.coInstructors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {course.coInstructors.slice(0, 2).map((instructor) => (
                <Badge key={instructor.id} variant="outline" className="max-w-36 truncate">
                  ร่วม: {instructor.displayName}
                </Badge>
              ))}
              {course.coInstructors.length > 2 && (
                <Badge variant="outline">+{course.coInstructors.length - 2}</Badge>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "fee",
      header: "ค่าลงทะเบียน",
      render: (course) => (
        <div>
          <p className="font-semibold">{formatBaht(course.registrationFee)}</p>
          {course.originalFee && (
            <p className="text-xs text-muted-foreground line-through">
              {formatBaht(course.originalFee)}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      render: (course) => <CourseStatusPill status={course.status} />,
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "sticky right-0 z-10 w-[190px] min-w-[190px] bg-card text-right shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.45)]",
      render: (course) => (
        <div className="flex justify-end gap-1">
          <CourseActionIcon label="โครงสร้างหลักสูตร" asChild>
            <Link href={`/admin/courses/${course.slug}/builder`}>
              <Layers />
            </Link>
          </CourseActionIcon>
          <CourseActionIcon label="ดูหน้าเว็บ" asChild>
            <Link href={`/courses/${course.slug}`}>
              <Eye />
            </Link>
          </CourseActionIcon>
          <CourseActionIcon
            label="แก้ไขหลักสูตร"
            variant="default"
            onClick={() => openEditForm(course)}
          >
            <Edit />
          </CourseActionIcon>
          <CourseActionIcon label="เก็บเข้าคลัง" onClick={() => setArchiveTarget(course)}>
            <Archive />
          </CourseActionIcon>
          <CourseActionIcon
            label="ลบหลักสูตร"
            onClick={() => setDeleteTarget(course)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </CourseActionIcon>
        </div>
      ),
    },
  ];

  const confirmArchive = () => {
    if (!archiveTarget) {
      return;
    }

    startArchiveTransition(() => {
      void archiveCourseAction(archiveTarget.id).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setArchiveTarget(null);
          router.refresh();
        }
      });
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }

    startDeleteTransition(() => {
      void deleteCourseAction(deleteTarget.id).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setDeleteTarget(null);
          router.refresh();
        }
      });
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">หลักสูตร</h2>
            <p className="text-sm text-muted-foreground">
              จัดการหลักสูตร หมวดหมู่ ผู้สอน ค่าลงทะเบียน และโปรโมชันจากฐานข้อมูลจริง
            </p>
          </div>
          <Button data-testid="course-create-button" onClick={openCreateForm}>
            <Plus data-icon="inline-start" />
            เพิ่มหลักสูตร
          </Button>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {actionMessage && (
          <ActionFeedback variant="success" title="ดำเนินการสำเร็จ" message={actionMessage} />
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <CourseMetric title="หลักสูตรทั้งหมด" value={data.courses.length.toString()} />
          <CourseMetric
            title="เปิดรับสมัคร"
            value={data.courses
              .filter((course) => course.status === "open" || course.status === "nearly_full")
              .length.toString()}
          />
          <CourseMetric
            title="มีโปรโมชัน"
            value={data.courses.filter((course) => course.promotionName).length.toString()}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>รายการหลักสูตรทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={data.courses}
              columns={columns}
              getRowKey={(course) => String(course.id)}
              getSearchText={(course) =>
                `${course.title} ${course.slug} ${course.shortDescription ?? ""} ${course.categoryName} ${course.instructorName} ${course.instructorEmail}`
              }
              searchPlaceholder="ค้นหาหลักสูตร หมวดหมู่ หรือผู้สอน"
              filter={{
                label: "สถานะ",
                getValue: (course) => course.status,
                options: statusOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                })),
              }}
              pageSize={8}
            />
          </CardContent>
        </Card>
      </div>

      <CourseFormModal
        key={formOpen ? activeCourse?.id ?? "new-course" : "closed-course-form"}
        open={formOpen}
        course={activeCourse}
        categories={categories}
        instructors={data.instructors}
        onCategoryCreated={(category) =>
          setCategories((current) =>
            current.some((item) => item.id === category.id) ? current : [...current, category]
          )
        }
        onCategoryDeleted={(categoryId) =>
          setCategories((current) => current.filter((item) => item.id !== categoryId))
        }
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setActiveCourse(null);
          }
        }}
        onSaved={(message) => {
          setActionMessage(message);
          setFormOpen(false);
          setActiveCourse(null);
          router.refresh();
        }}
      />

      <AdminActionModal
        open={Boolean(archiveTarget)}
        title="เก็บหลักสูตรเข้าคลัง"
        description="หลักสูตรจะไม่ถูกใช้เป็นหลักสูตรเปิดรับสมัคร แต่ข้อมูลเดิมยังอยู่ในระบบ"
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" disabled={isArchiving} onClick={confirmArchive}>
              <Archive data-icon="inline-start" />
              ยืนยันเข้าคลัง
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6">
          {archiveTarget?.title}
        </p>
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(deleteTarget)}
        title="ลบหลักสูตรออกจากระบบ"
        description="ระบบจะซ่อนหลักสูตรนี้ออกจากหน้าจัดการและรายการที่ใช้งาน แต่ยังเก็บข้อมูลเดิมไว้เพื่อไม่กระทบประวัติผู้เรียน การลงทะเบียน และรายงาน"
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
              <Trash2 data-icon="inline-start" />
              ยืนยันลบหลักสูตร
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6">
          {deleteTarget?.title}
        </p>
      </AdminActionModal>
    </>
  );
}

function CourseActionIcon({
  label,
  children,
  variant = "outline",
  className,
  asChild = false,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  asChild?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          title={label}
          variant={variant}
          size="icon-sm"
          asChild={asChild}
          onClick={onClick}
          className={cn("shrink-0", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CourseFormModal({
  open,
  course,
  categories,
  instructors,
  onCategoryCreated,
  onCategoryDeleted,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  course: CourseManagementRow | null;
  categories: CourseCategoryOption[];
  instructors: CourseInstructorOption[];
  onCategoryCreated: (category: CourseCategoryOption) => void;
  onCategoryDeleted: (categoryId: number) => void;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const firstCategory = categories[0];
  const instructorOptions = useMemo<CourseInstructorOption[]>(() => {
    if (!course || instructors.some((instructor) => instructor.id === course.instructorId)) {
      return instructors;
    }

    return [
      {
        id: course.instructorId,
        userId: null,
        displayName: course.instructorName,
        email: course.instructorEmail,
        position: null,
        signatureUrl: null,
      },
      ...instructors,
    ];
  }, [course, instructors]);
  const firstInstructor = instructorOptions[0];
  const initialInstructor = course
    ? instructorOptions.find((instructor) => instructor.id === course.instructorId)
    : firstInstructor;
  const [categoryId, setCategoryId] = useState(
    String(course?.categoryId ?? firstCategory?.id ?? "")
  );
  const [instructorId, setInstructorId] = useState(
    String(course?.instructorId ?? firstInstructor?.id ?? "")
  );
  const [coInstructorIds, setCoInstructorIds] = useState<string[]>(
    course?.coInstructors.map((instructor) => String(instructor.id)) ?? []
  );
  const [instructorQuery, setInstructorQuery] = useState(initialInstructor?.displayName ?? "");
  const [status, setStatus] = useState<CourseManagementStatus>(course?.status ?? "draft");
  const [format, setFormat] = useState<CourseManagementFormat>(course?.format ?? "online");
  const [level, setLevel] = useState<CourseManagementLevel>(course?.level ?? "beginner");
  const [baseFee, setBaseFee] = useState(
    String(course?.originalFee ?? course?.registrationFee ?? 0)
  );
  const [promotionEnabled, setPromotionEnabled] = useState(Boolean(course?.promotionName));
  const [discountType, setDiscountType] = useState<PromotionDiscountType>(
    course?.discountType ?? "amount"
  );
  const [discountValue, setDiscountValue] = useState(String(course?.discountValue ?? 0));
  const [promotionStatus, setPromotionStatus] = useState<"active" | "inactive">(
    course?.promotionStatus ?? "active"
  );
  const [certificateDocumentType, setCertificateDocumentType] = useState<CertificateDocumentType>(
    course?.certificateDocumentType ?? "honor_certificate"
  );
  const [formCategories, setFormCategories] = useState(categories);
  const [capacityUnlimited, setCapacityUnlimited] = useState(course?.capacity === null);
  const [alwaysAvailable, setAlwaysAvailable] = useState(!course?.startsAt && !course?.endsAt);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverFileLabel, setCoverFileLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"info" | "success" | "error" | "loading">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coverSectionRef = useRef<HTMLDivElement>(null);
  const [isDeletingCategory, startCategoryDeleteTransition] = useTransition();
  const coverPreview = coverPreviewUrl ?? course?.coverImageUrl ?? "";

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const filteredInstructors = useMemo(() => {
    const keyword = instructorQuery.trim().toLowerCase();

    if (!keyword) {
        return instructorOptions.slice(0, 8);
    }

    return instructorOptions
      .filter((instructor) =>
        `${instructor.displayName} ${instructor.email} ${instructor.position ?? ""}`
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 8);
  }, [instructorOptions, instructorQuery]);

  const coInstructorOptions = useMemo(
    () => instructorOptions.filter((instructor) => String(instructor.id) !== instructorId),
    [instructorId, instructorOptions]
  );

  const finalFee = useMemo(() => {
    const parsedBase = Number(baseFee || 0);
    const parsedDiscount = Number(discountValue || 0);

    if (!promotionEnabled || parsedDiscount <= 0) {
      return parsedBase;
    }

    const discountAmount =
      discountType === "percent"
        ? parsedBase * Math.min(parsedDiscount, 100) / 100
        : parsedDiscount;

    return Math.max(0, Math.round((parsedBase - discountAmount) * 100) / 100);
  }, [baseFee, discountType, discountValue, promotionEnabled]);

  const handleCoverFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    setCoverPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return file ? URL.createObjectURL(file) : null;
    });

    if (!file) {
      setCoverFileLabel(null);
      return;
    }

    const validationMessage = getCoverImageValidationMessage(file);
    setCoverFileLabel(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    setMessage(validationMessage);
    setActionStatus(validationMessage ? "error" : "info");

    const restoreCoverScroll = () => {
      const dialog = input.closest<HTMLElement>("section[role='dialog']");
      const coverSection = coverSectionRef.current;
      const scrollArea = coverSection?.closest<HTMLElement>("[data-modal-scroll-area='true']");

      if (dialog) {
        dialog.scrollTop = 0;
      }

      if (!coverSection || !scrollArea) {
        return;
      }

      const coverRect = coverSection.getBoundingClientRect();
      const scrollAreaRect = scrollArea.getBoundingClientRect();
      const nextScrollTop = scrollArea.scrollTop + coverRect.top - scrollAreaRect.top - 16;

      scrollArea.scrollTop = Math.max(0, nextScrollTop);
    };

    window.requestAnimationFrame(() => {
      input.blur();
      restoreCoverScroll();
      window.setTimeout(restoreCoverScroll, 80);
    });
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const coverInput = form.elements.namedItem("coverImageFile");
    const coverFile =
      coverInput instanceof HTMLInputElement ? coverInput.files?.[0] ?? null : null;

    if (coverFile) {
      const validationMessage = getCoverImageValidationMessage(coverFile);

      if (validationMessage) {
        setMessage(validationMessage);
        setActionStatus("error");
        return;
      }
    }

    const formData = new FormData(form);
    setMessage(coverFile ? "กำลังอัปโหลดภาพปกและบันทึกข้อมูลหลักสูตร..." : "กำลังบันทึกข้อมูลหลักสูตร...");
    setActionStatus("loading");
    setIsSubmitting(true);

    void saveCourseAction(formData)
      .then((result) => {
        setMessage(result.message);
        setActionStatus(result.ok ? "success" : "error");

        if (result.ok) {
          onSaved(result.message);
        }
      })
      .catch((error: unknown) => {
        setActionStatus("error");
        setMessage(
          error instanceof Error
            ? `บันทึกหลักสูตรไม่สำเร็จ: ${error.message}`
            : "บันทึกหลักสูตรไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง"
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const deleteSelectedCategory = () => {
    const parsedCategoryId = Number(categoryId);
    const selectedCategory = formCategories.find((category) => category.id === parsedCategoryId);

    if (!selectedCategory) {
      setCategoryMessage("กรุณาเลือกหมวดหมู่ที่ต้องการลบ");
      return;
    }

    if (!window.confirm(`ลบหมวดหมู่ "${selectedCategory.name}" ใช่หรือไม่`)) {
      return;
    }

    startCategoryDeleteTransition(() => {
      void fetch("/api/admin/categories", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: parsedCategoryId }),
      })
        .then((response) => response.json())
        .then((result: { ok: boolean; message: string }) => {
          setCategoryMessage(result.message);

          if (!result.ok) {
            return;
          }

          const nextCategories = formCategories.filter(
            (category) => category.id !== parsedCategoryId
          );
          setFormCategories(nextCategories);
          onCategoryDeleted(parsedCategoryId);
          setCategoryId(String(nextCategories[0]?.id ?? ""));
        })
        .catch((error: unknown) => {
          setCategoryMessage(
            error instanceof Error ? error.message : "ลบหมวดหมู่ไม่สำเร็จ"
          );
        });
    });
  };

  const selectedInstructor = instructorOptions.find((instructor) => String(instructor.id) === instructorId);

  return (
    <AdminActionModal
      open={open}
      title={course ? "แก้ไขหลักสูตร" : "เพิ่มหลักสูตรใหม่"}
      description="เลือกหมวดหมู่ เพิ่มหมวดหมู่ใหม่ ค้นหาผู้สอนจากสมาชิก และกำหนดโปรโมชันได้ในหน้าต่างเดียว"
      size="lg"
      onOpenChange={onOpenChange}
    >
      <form
        data-testid="course-form"
        className="flex flex-col gap-6"
        encType="multipart/form-data"
        onSubmit={submitForm}
      >
        <input type="hidden" name="courseId" value={course?.id ?? ""} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="instructorId" value={instructorId} />
        <input
          type="hidden"
          name="coInstructorIds"
          value={coInstructorIds.filter((id) => id !== instructorId).join(",")}
        />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="level" value={level} />
        <input type="hidden" name="discountType" value={discountType} />
        <input type="hidden" name="promotionStatus" value={promotionStatus} />
        <input type="hidden" name="promotionId" value={course?.promotionId ?? ""} />
        <input type="hidden" name="certificateDocumentType" value={certificateDocumentType} />

        {message && (
          <ActionFeedback
            variant={actionStatus}
            title={
              actionStatus === "loading"
                ? "กำลังบันทึกข้อมูล"
                : actionStatus === "success"
                  ? "บันทึกสำเร็จ"
                  : actionStatus === "error"
                    ? "บันทึกไม่สำเร็จ"
                    : "ตรวจสอบไฟล์"
            }
            message={message}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FieldBlock label="ชื่อหลักสูตร" htmlFor="title">
            <Input id="title" name="title" defaultValue={course?.title ?? ""} required />
          </FieldBlock>

          <FieldBlock label="Slug URL" htmlFor="slug" hint="เว้นว่างได้ ระบบจะสร้างให้อัตโนมัติ">
            <Input id="slug" name="slug" defaultValue={course?.slug ?? ""} />
          </FieldBlock>
        </div>

        <FieldBlock label="คำอธิบายย่อ" htmlFor="shortDescription">
          <Input
            id="shortDescription"
            name="shortDescription"
            defaultValue={course?.shortDescription ?? ""}
            placeholder="ข้อความสั้นสำหรับแสดงบนหน้าแรกและหน้ารวมหลักสูตร"
          />
        </FieldBlock>

        <FieldBlock label="รายละเอียดหลักสูตร" htmlFor="description">
          <textarea
            id="description"
            name="description"
            className={textAreaClassName}
            defaultValue={course?.description ?? ""}
          />
        </FieldBlock>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldBlock label="หมวดหมู่">
            <Select
              value={categoryId}
              onValueChange={(value) => {
                if (value) {
                  setCategoryId(value);
                }
              }}
            >
              <SelectTrigger data-testid="course-category-select" className="w-full">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {formCategories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="mt-3 rounded-md border border-dashed p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  ลบได้เฉพาะหมวดหมู่ที่ยังไม่มีหลักสูตรใช้งานอยู่
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!categoryId || isDeletingCategory}
                  onClick={deleteSelectedCategory}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  ลบหมวดหมู่
                </Button>
              </div>
              {categoryMessage && (
                <p className="mt-2 text-xs text-muted-foreground">{categoryMessage}</p>
              )}
            </div>
          </FieldBlock>

          <InlineCategoryCreator
            onCreated={(category) => {
              setCategoryId(String(category.id));
              setFormCategories((current) =>
                current.some((item) => item.id === category.id) ? current : [...current, category]
              );
              onCategoryCreated(category);
            }}
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="instructorSearch">ผู้สอน</Label>
            <p className="text-xs text-muted-foreground">
              ค้นหาจากสมาชิกที่มีบทบาทผู้สอนเท่านั้น
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border px-3">
            <Search data-icon="inline-start" className="text-muted-foreground" />
            <Input
              id="instructorSearch"
              value={instructorQuery}
              onChange={(event) => {
                setInstructorQuery(event.target.value);
                setInstructorId("");
              }}
              data-testid="course-instructor-search"
              className="border-0 px-0 shadow-none focus-visible:ring-0"
              placeholder="พิมพ์ชื่อหรืออีเมลผู้สอน"
            />
          </div>
          <div className="mt-3 grid gap-2">
            {filteredInstructors.map((instructor) => (
              <button
                key={instructor.id}
                type="button"
                data-testid={`course-instructor-option-${instructor.id}`}
                className={cn(
                  "rounded-md border p-3 text-left text-sm transition hover:bg-secondary/60",
                  String(instructor.id) === instructorId && "border-primary bg-primary/5"
                )}
                onClick={() => {
                  setInstructorId(String(instructor.id));
                  setInstructorQuery(instructor.displayName);
                }}
              >
                <span className="font-medium">{instructor.displayName}</span>
                <span className="ml-2 text-muted-foreground">{instructor.email}</span>
                {instructor.position && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {instructor.position}
                  </span>
                )}
                <span className="mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                  {instructor.signatureUrl ? "มีลายเซ็นรายงาน" : "ยังไม่มีลายเซ็น"}
                </span>
              </button>
            ))}
            {filteredInstructors.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                ไม่พบผู้สอน ต้องเพิ่มสมาชิกบทบาทผู้สอนก่อน
              </p>
            )}
          </div>
          {selectedInstructor && (
            <div className="mt-3 rounded-md border bg-secondary/20 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-primary">เลือกแล้ว: {selectedInstructor.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ลายเซ็นนี้จะใช้เป็นลายเซ็นเจ้าของหลักสูตรในรายงานรับรอง
                  </p>
                </div>
                <div className="flex min-h-16 min-w-48 items-center justify-center rounded-md border bg-background px-3 py-2">
                  {selectedInstructor.signatureUrl ? (
                    <div
                      aria-label="ลายเซ็นครูเจ้าของหลักสูตร"
                      className="h-14 w-44 bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${selectedInstructor.signatureUrl}")` }}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <PenLine className="size-4" />
                      ยังไม่มีลายเซ็น
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-secondary/20 p-4">
          <div className="flex flex-col gap-1">
            <Label>ผู้สอนร่วม</Label>
            <p className="text-xs text-muted-foreground">
              เพิ่มครูผู้สอนร่วมเพื่อช่วยจัดการบทเรียน ตรวจใบงาน แบบฝึก และดูรายงานของหลักสูตรนี้
            </p>
          </div>
          <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable] md:grid-cols-2">
            {coInstructorOptions.map((instructor) => {
              const id = String(instructor.id);
              const checked = coInstructorIds.includes(id);

              return (
                <label
                  key={instructor.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition hover:bg-secondary/60",
                    checked && "border-primary bg-primary/5"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(event) => {
                      setCoInstructorIds((current) =>
                        event.target.checked
                          ? Array.from(new Set([...current, id]))
                          : current.filter((item) => item !== id)
                      );
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{instructor.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {instructor.email}
                    </span>
                    {instructor.position && (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {instructor.position}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            {coInstructorOptions.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground md:col-span-2">
                ยังไม่มีครูผู้สอนอื่นให้เลือกเป็นผู้สอนร่วม
              </p>
            )}
          </div>
          {coInstructorIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {coInstructorIds.map((id) => {
                const instructor = instructorOptions.find((option) => String(option.id) === id);
                return instructor ? (
                  <Badge key={id} variant="outline">
                    {instructor.displayName}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FieldBlock label="สถานะ">
            <Select value={status} onValueChange={(value) => setStatus(value as CourseManagementStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldBlock>

          <FieldBlock label="รูปแบบเรียน">
            <Select value={format} onValueChange={(value) => setFormat(value as CourseManagementFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldBlock>

          <FieldBlock label="ระดับ">
            <Select value={level} onValueChange={(value) => setLevel(value as CourseManagementLevel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {levelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldBlock>
        </div>

        <div className="rounded-lg border bg-secondary/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Award className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">รูปแบบเอกสารเมื่อผ่านหลักสูตร</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                เลือกให้สอดคล้องกับลักษณะหลักสูตร ระบบจะนำค่านี้ไปใช้กับรายงานเสนออนุมัติและหน้าใบประกาศออนไลน์
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {certificateDocumentTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "rounded-lg border p-4 text-left transition hover:bg-background",
                  certificateDocumentType === option.value && "border-primary bg-primary/5 text-primary"
                )}
                onClick={() => setCertificateDocumentType(option.value)}
              >
                <span className="font-semibold">{option.label}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <FieldBlock label="ระยะเวลา (ชั่วโมง)" htmlFor="durationHours">
            <Input
              id="durationHours"
              name="durationHours"
              type="number"
              min="0"
              step="0.5"
              defaultValue={course ? String(course.durationMinutes / 60) : "6"}
              required
            />
          </FieldBlock>
          <FieldBlock label="จำนวนรับ" htmlFor="capacity">
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min="0"
              disabled={capacityUnlimited}
              defaultValue={course?.capacity ?? 30}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={capacityUnlimited}
                onChange={(event) => setCapacityUnlimited(event.target.checked)}
              />
              ไม่จำกัดจำนวนผู้เรียน
            </label>
          </FieldBlock>
          <FieldBlock label="เริ่มอบรม" htmlFor="startsAt">
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              disabled={alwaysAvailable}
              defaultValue={toDateTimeLocal(course?.startsAt)}
            />
          </FieldBlock>
          <FieldBlock label="สิ้นสุด" htmlFor="endsAt">
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              disabled={alwaysAvailable}
              defaultValue={toDateTimeLocal(course?.endsAt)}
            />
          </FieldBlock>
          <div className="rounded-lg border bg-secondary/30 p-3 md:col-span-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={alwaysAvailable}
                onChange={(event) => setAlwaysAvailable(event.target.checked)}
              />
              <span>
                <span className="block font-medium">อบรมได้ตลอดเวลา</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  เหมาะกับหลักสูตรออนไลน์ที่เข้าเรียนได้ทุกเวลา ระบบจะไม่บันทึกวันเริ่มและวันสิ้นสุด
                </span>
              </span>
            </label>
          </div>
        </div>

        <div ref={coverSectionRef} className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <ImageIcon className="size-5" />
            </div>
            <div>
              <p className="font-medium">ภาพปกหลักสูตร</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ขนาดที่เหมาะสมคืออัตราส่วน 16:9 เช่น 1200x675 หรือ 1600x900 พิกเซล
                รองรับ JPG, PNG, WebP ขนาดไม่เกิน 4MB
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="overflow-hidden rounded-lg border bg-secondary/40">
              {coverPreview ? (
                <div
                  className="aspect-video bg-cover bg-center"
                  style={{ backgroundImage: `url("${coverPreview}")` }}
                  aria-label="ตัวอย่างภาพปกหลักสูตร"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                  ยังไม่มีภาพปก
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
              <p className="font-medium">ตรวจภาพก่อนบันทึก</p>
              <p className="mt-1 text-muted-foreground">
                ภาพที่เลือกใหม่จะแสดงตัวอย่างทันที และจะบันทึกจริงเมื่อกดบันทึกหลักสูตร
              </p>
              <div className="mt-3 rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                {coverFileLabel ? `ไฟล์ที่เลือก: ${coverFileLabel}` : "ยังไม่ได้เลือกไฟล์ใหม่"}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <UploadField
              id="coverImageFile"
              name="coverImageFile"
              label="อัปโหลดภาพปกใหม่"
              description="เลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 4 MB"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
              maxBytes={maxCoverImageSizeBytes}
              currentFileName={course?.coverImageUrl ? "ภาพปกปัจจุบัน" : null}
              currentFileUrl={course?.coverImageUrl ?? null}
              isPending={isSubmitting}
              onChange={handleCoverFileChange}
            />
            <FieldBlock
              label="หรือใช้ URL ภาพเดิม/ภาพภายนอก"
              htmlFor="coverImageUrl"
              hint="ถ้าอัปโหลดไฟล์ ระบบจะใช้ไฟล์ที่อัปโหลดแทน URL นี้"
            >
              <Input
                id="coverImageUrl"
                name="coverImageUrl"
                defaultValue={course?.coverImageUrl ?? ""}
                placeholder="URL รูปภาพ หรือเว้นว่างเพื่อใช้ภาพเริ่มต้น"
              />
            </FieldBlock>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">ค่าลงทะเบียนและโปรโมชัน</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ระบบจะคำนวณราคาสุทธิและส่งไปแสดงเป็นราคาเดิม/ราคาหลังลดบนหน้าหลักสูตร
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="promotionEnabled"
                data-testid="course-promotion-toggle"
                checked={promotionEnabled}
                onChange={(event) => setPromotionEnabled(event.target.checked)}
              />
              เปิดโปรโมชัน
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <FieldBlock label="ค่าลงทะเบียนปกติ" htmlFor="baseFee">
              <Input
                id="baseFee"
                name="baseFee"
                type="number"
                min="0"
                value={baseFee}
                onChange={(event) => setBaseFee(event.target.value)}
                required
              />
            </FieldBlock>
            <FieldBlock label="ส่วนลด">
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <Input
                  name="discountValue"
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  disabled={!promotionEnabled}
                />
                <Select
                  value={discountType}
                  onValueChange={(value) => setDiscountType(value as PromotionDiscountType)}
                  disabled={!promotionEnabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {discountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </FieldBlock>
            <div className="rounded-lg border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator data-icon="inline-start" />
                ค่าลงทะเบียนสุทธิ
              </p>
              <p className="mt-2 text-2xl font-bold">{formatBaht(finalFee)}</p>
              {promotionEnabled && Number(baseFee) > finalFee && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatBaht(Number(baseFee))}
                </p>
              )}
            </div>
          </div>

          {promotionEnabled && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FieldBlock label="ชื่อโปรโมชัน" htmlFor="promotionName">
                <Input
                  id="promotionName"
                  name="promotionName"
                  defaultValue={course?.promotionName ?? ""}
                  placeholder="เช่น Early Bird รุ่นกรกฎาคม"
                />
              </FieldBlock>
              <FieldBlock label="สถานะโปรโมชัน">
                <Select
                  value={promotionStatus}
                  onValueChange={(value) => setPromotionStatus(value as "active" | "inactive")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">ใช้งาน</SelectItem>
                      <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock label="เริ่มโปรโมชัน" htmlFor="promotionStartsAt">
                <Input
                  id="promotionStartsAt"
                  name="promotionStartsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(course?.promotionStartsAt)}
                />
              </FieldBlock>
              <FieldBlock label="สิ้นสุดโปรโมชัน" htmlFor="promotionEndsAt">
                <Input
                  id="promotionEndsAt"
                  name="promotionEndsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(course?.promotionEndsAt)}
                />
              </FieldBlock>
              <FieldBlock label="รายละเอียดโปรโมชัน" htmlFor="promotionDescription">
                <textarea
                  id="promotionDescription"
                  name="promotionDescription"
                  className={textAreaClassName}
                  defaultValue={course?.promotionDescription ?? ""}
                />
              </FieldBlock>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            type="submit"
            data-testid="course-submit-button"
            disabled={isSubmitting || !categoryId || !instructorId}
          >
            <Save data-icon="inline-start" />
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกหลักสูตร"}
          </Button>
        </div>
      </form>
    </AdminActionModal>
  );
}

function InlineCategoryCreator({
  onCreated,
}: {
  onCreated: (category: CourseCategoryOption) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📚");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitCategory = () => {
    startTransition(() => {
      void fetch("/api/admin/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          icon,
        }),
      })
        .then((response) => response.json())
        .then((result: { ok: boolean; message: string; category?: CourseCategoryOption }) => {
          if (result.ok && result.category) {
            onCreated(result.category);
            setMessage(result.message);
            setName("");
            return;
          }

          setMessage(result.message);
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "เพิ่มหมวดหมู่ไม่สำเร็จ");
        });
    });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="newCategoryName">เพิ่มหมวดหมู่ทันที</Label>
        <p className="text-xs text-muted-foreground">เพิ่มแล้วระบบจะเลือกหมวดหมู่นั้นให้ทันที</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[70px_1fr_auto]">
            <Input
              id="newCategoryIcon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              data-testid="course-new-category-icon"
              aria-label="ไอคอนหมวดหมู่"
            />
            <Input
              id="newCategoryName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              data-testid="course-new-category-name"
              placeholder="ชื่อหมวดหมู่ใหม่"
            />
        <Button
          type="button"
          variant="outline"
          data-testid="course-new-category-submit"
          disabled={isPending || !name.trim()}
          onClick={submitCategory}
        >
          <Plus data-icon="inline-start" />
          เพิ่ม
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function CourseStatusPill({ status }: { status: CourseManagementStatus }) {
  const label = statusOptions.find((option) => option.value === status)?.label ?? status;
  const variant = status === "closed" || status === "archived" ? "secondary" : "default";

  return (
    <Badge variant={variant}>
      {status === "archived" ? <Archive data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
      {label}
    </Badge>
  );
}

function CourseMetric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function FieldBlock({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.replace(" ", "T").slice(0, 16);
}
