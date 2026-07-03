"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Edit, Eye, FileImage, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/admin/announcements/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadField } from "@/components/ui/upload-field";
import type {
  AnnouncementCourseOption,
  AnnouncementRecord,
  AnnouncementStatus,
} from "@/lib/announcement-repositories";

type EditorState = AnnouncementRecord | "new" | null;

const statusLabels: Record<AnnouncementStatus, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่",
  archived: "เก็บถาวร",
};

const categoryLabels: Record<string, string> = {
  general: "ทั่วไป",
  registration: "เปิดรับสมัคร",
  course: "หลักสูตร",
  certificate: "ใบประกาศ",
  event: "กิจกรรม",
};

const successMessages: Record<string, string> = {
  saved: "บันทึกข่าวประชาสัมพันธ์เรียบร้อยแล้ว",
  deleted: "ลบข่าวประชาสัมพันธ์เรียบร้อยแล้ว",
};

function statusVariant(status: AnnouncementStatus) {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

function datetimeLocal(value: string | null) {
  if (!value) return "";
  return value.replace(" ", "T").slice(0, 16);
}

export function AdminAnnouncementsWorkspace({
  rows,
  courses,
  updated,
}: {
  rows: AnnouncementRecord[];
  courses: AnnouncementCourseOption[];
  updated?: string;
}) {
  const [editing, setEditing] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<AnnouncementRecord | null>(null);
  const successMessage = updated ? successMessages[updated] : "";

  const columns: Array<AdminDataTableColumn<AnnouncementRecord>> = [
    {
      id: "cover",
      header: "ภาพ",
      className: "w-[118px]",
      render: (row) => (
        <Link
          href={`/news/${row.slug}`}
          target="_blank"
          className="relative block aspect-[16/9] w-24 overflow-hidden rounded-md border bg-secondary"
        >
          <Image src={row.coverImageUrl} alt={row.title} fill sizes="96px" className="object-cover" />
        </Link>
      ),
    },
    {
      id: "title",
      header: "ข่าวประชาสัมพันธ์",
      render: (row) => (
        <div className="max-w-xl min-w-0">
          <p className="line-clamp-1 font-semibold">{row.title}</p>
          <p className="line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{row.summary}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      className: "w-48",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={statusVariant(row.status)}>{statusLabels[row.status]}</Badge>
          {row.showOnHome && <Badge variant="secondary">หน้าแรก</Badge>}
          {row.isFeatured && <Badge variant="outline">ข่าวเด่น</Badge>}
        </div>
      ),
    },
    {
      id: "category",
      header: "หมวด",
      className: "w-36",
      render: (row) => <Badge variant="outline">{categoryLabels[row.category] ?? row.category}</Badge>,
    },
    {
      id: "published",
      header: "เผยแพร่",
      className: "w-44",
      render: (row) => (
        <div className="grid gap-1 text-sm">
          <span>{row.publishedDateTime}</span>
          {row.expiresAt && (
            <span className="text-xs text-muted-foreground">หมดอายุ {datetimeLocal(row.expiresAt).replace("T", " ")}</span>
          )}
        </div>
      ),
    },
    {
      id: "views",
      header: "วิว",
      className: "w-20 text-right",
      render: (row) => row.viewCount.toLocaleString("th-TH"),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[150px] text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="icon-sm" title="ดูหน้าเว็บ">
            <Link href={`/news/${row.slug}`} target="_blank">
              <Eye className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" title="แก้ไขข่าว" onClick={() => setEditing(row)}>
            <Edit className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" title="ลบข่าว" onClick={() => setDeleting(row)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      {successMessage && (
        <ActionFeedback variant="success" title="ดำเนินการสำเร็จ" message={successMessage} />
      )}

      <Card className="min-w-0 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Megaphone className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">จัดการข่าวประชาสัมพันธ์หน้าแรก</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                เพิ่มข่าวพร้อมภาพประกอบเพื่อแสดงต่อจาก Hero บนหน้าแรก และเผยแพร่ในหน้ารวมข่าวของเว็บไซต์
              </p>
              <p className="mt-1 text-sm font-medium text-primary">
                ขนาดภาพแนะนำ: 1200 x 675 px อัตราส่วน 16:9, ไฟล์ JPG/PNG/WebP ไม่เกิน 5 MB และวางจุดสำคัญไว้กลางภาพ
              </p>
            </div>
          </div>
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            เพิ่มข่าว
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="min-w-0 p-5">
          <AdminDataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) => `${row.title} ${row.summary} ${row.slug} ${row.category} ${row.status}`}
            searchPlaceholder="ค้นหาข่าว หัวข้อ URL หรือหมวดหมู่"
            filter={{
              label: "สถานะ",
              getValue: (row) => row.status,
              options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
            }}
            pageSize={8}
            emptyText="ยังไม่มีข่าวประชาสัมพันธ์"
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "เพิ่มข่าวประชาสัมพันธ์" : "แก้ไขข่าวประชาสัมพันธ์"}
        description="ภาพข่าวบนหน้าแรกใช้พื้นที่ 16:9 จึงควรเตรียมภาพ 1200 x 675 px เพื่อให้ไม่ถูกตัดจนเสียองค์ประกอบ"
        size="lg"
      >
        {editing && <AnnouncementForm announcement={editing} courses={courses} />}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="ลบข่าวประชาสัมพันธ์"
        description="ข่าวนี้จะหายจากหน้าแรกและหน้ารวมข่าวทันทีหลังยืนยัน"
      >
        {deleting && (
          <form action={deleteAnnouncementAction} className="grid gap-4">
            <input type="hidden" name="id" value={deleting.id} />
            <div className="rounded-lg border bg-secondary/30 p-4 text-sm leading-6">
              ต้องการลบข่าว <span className="font-semibold">{deleting.title}</span> ใช่หรือไม่
            </div>
            <Button type="submit" variant="destructive" className="w-fit">
              <Trash2 className="size-4" />
              ลบข่าว
            </Button>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}

function AnnouncementForm({
  announcement,
  courses,
}: {
  announcement: AnnouncementRecord | "new";
  courses: AnnouncementCourseOption[];
}) {
  const isNew = announcement === "new";
  const currentCover = isNew ? "" : announcement.coverImageUrl;

  return (
    <form action={saveAnnouncementAction} className="grid gap-5">
      <input type="hidden" name="id" value={isNew ? "" : announcement.id} />
      <input type="hidden" name="currentCoverImageUrl" value={currentCover} />

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">หัวข้อข่าว</Label>
            <Input id="title" name="title" defaultValue={isNew ? "" : announcement.title} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">URL ข่าว</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={isNew ? "" : announcement.slug}
              placeholder="เช่น july-online-course-registration"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              เว้นว่างได้ ระบบจะสร้างให้อัตโนมัติ แนะนำใช้ภาษาอังกฤษ ตัวเลข และขีดกลาง
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>ภาพประกอบ</Label>
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border bg-secondary">
            {currentCover ? (
              <Image src={currentCover} alt="ภาพข่าวปัจจุบัน" fill sizes="220px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <FileImage className="size-8" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="coverImageFile">อัปโหลดภาพข่าว</Label>
        <UploadField
          id="coverImageFile"
          name="coverImageFile"
          label="อัปโหลดภาพข่าว"
          description="แนะนำ 1200 x 675 px อัตราส่วน 16:9 ไฟล์ JPG, PNG หรือ WebP"
          accept=".jpg,.jpeg,.png,.webp"
          allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
          maxBytes={5 * 1024 * 1024}
          currentFileName={currentCover ? "ภาพข่าวปัจจุบัน" : null}
          currentFileUrl={currentCover || null}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          แนะนำ 1200 x 675 px อัตราส่วน 16:9 ขั้นต่ำประมาณ 900 x 506 px ไฟล์ไม่เกิน 5 MB
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="category">หมวดข่าว</Label>
          <select
            id="category"
            name="category"
            defaultValue={isNew ? "general" : announcement.category}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">สถานะ</Label>
          <select
            id="status"
            name="status"
            defaultValue={isNew ? "published" : announcement.status}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="courseId">เชื่อมหลักสูตร</Label>
          <select
            id="courseId"
            name="courseId"
            defaultValue={isNew ? "" : String(announcement.courseId ?? "")}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">ไม่เชื่อมหลักสูตร</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="publishedAt">วันที่เผยแพร่</Label>
          <Input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={isNew ? "" : datetimeLocal(announcement.publishedAt)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="expiresAt">วันหมดอายุข่าว</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={isNew ? "" : datetimeLocal(announcement.expiresAt)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="summary">คำโปรยข่าว</Label>
        <textarea
          id="summary"
          name="summary"
          className="min-h-20 rounded-md border bg-background p-3 text-sm"
          defaultValue={isNew ? "" : announcement.summary}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="content">เนื้อหาข่าว</Label>
        <textarea
          id="content"
          name="content"
          className="min-h-40 rounded-md border bg-background p-3 text-sm leading-6"
          defaultValue={isNew ? "" : announcement.content}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ctaLabel">ข้อความปุ่ม</Label>
          <Input id="ctaLabel" name="ctaLabel" defaultValue={isNew ? "อ่านรายละเอียด" : announcement.ctaLabel} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ctaUrl">ลิงก์ปุ่ม</Label>
          <Input id="ctaUrl" name="ctaUrl" defaultValue={isNew ? "/courses" : announcement.ctaUrl} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border bg-secondary/30 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input name="showOnHome" type="checkbox" defaultChecked={isNew ? true : announcement.showOnHome} />
          แสดงหน้าแรก
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="isFeatured" type="checkbox" defaultChecked={isNew ? false : announcement.isFeatured} />
          ข่าวเด่น
        </label>
      </div>

      <Button type="submit" className="w-fit">
        <Save className="size-4" />
        บันทึกข่าว
      </Button>
    </form>
  );
}
