"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader } from "mysql2/promise";
import { logAudit } from "@/lib/audit";
import { requireCurrentUser } from "@/lib/auth";
import { executeQuery } from "@/lib/db";
import { saveValidatedUpload } from "@/lib/upload-security";
import { slugExists, type AnnouncementStatus } from "@/lib/announcement-repositories";

const announcementCoverUploadPolicy = {
  maxBytes: 5 * 1024 * 1024,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
};

function text(formData: FormData, key: string, fallback = "") {
  const value = String(formData.get(key) ?? "").trim();
  return value || fallback;
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function optionalId(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" ? 1 : 0;
}

function normalizeStatus(formData: FormData): AnnouncementStatus {
  const status = text(formData, "status", "draft");
  return ["draft", "published", "archived"].includes(status)
    ? (status as AnnouncementStatus)
    : "draft";
}

function normalizeCategory(formData: FormData) {
  const category = text(formData, "category", "general");
  return ["general", "registration", "course", "certificate", "event"].includes(category)
    ? category
    : "general";
}

function normalizeDateTime(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  return value.replace("T", " ").slice(0, 19);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function uniqueSlug(baseValue: string, currentId: number | null) {
  const base = slugify(baseValue) || `news-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate, currentId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function validateCtaUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  throw new Error("ลิงก์ปุ่มอ่านต่อควรขึ้นต้นด้วย /, https:// หรือ http://");
}

async function refreshAnnouncementPages() {
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/admin/announcements");
}

export async function saveAnnouncementAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const id = optionalId(formData, "id");
  const title = text(formData, "title");
  const summary = text(formData, "summary");
  const content = text(formData, "content", summary);
  const requestedSlug = text(formData, "slug", title);
  const slug = await uniqueSlug(requestedSlug, id);
  const category = normalizeCategory(formData);
  const status = normalizeStatus(formData);
  const currentCoverImageUrl = text(formData, "currentCoverImageUrl");
  const ctaLabel = nullableText(formData, "ctaLabel");
  const ctaUrl = validateCtaUrl(nullableText(formData, "ctaUrl"));
  const courseId = optionalId(formData, "courseId");
  const publishedAt = normalizeDateTime(formData, "publishedAt") ?? (status === "published" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null);
  const expiresAt = normalizeDateTime(formData, "expiresAt");

  if (!title) throw new Error("กรุณากรอกหัวข้อข่าว");
  if (!summary) throw new Error("กรุณากรอกคำโปรยข่าว");

  const uploadedCover = await saveValidatedUpload(formData.get("coverImageFile"), {
    rootFolder: "announcements",
    publicBasePath: "/uploads/announcements",
    ownerSegment: slug,
    fallbackName: "announcement-cover",
    label: "ภาพประกอบข่าว",
    ...announcementCoverUploadPolicy,
  });
  const coverImageUrl = (uploadedCover?.fileUrl ?? currentCoverImageUrl) || null;

  let entityId = id ?? 0;
  if (id) {
    await executeQuery<ResultSetHeader>(
      `UPDATE announcements
       SET title = :title,
           slug = :slug,
           summary = :summary,
           content = :content,
           cover_image_url = :coverImageUrl,
           category = :category,
           is_featured = :isFeatured,
           show_on_home = :showOnHome,
           cta_label = :ctaLabel,
           cta_url = :ctaUrl,
           course_id = :courseId,
           status = :status,
           published_at = :publishedAt,
           expires_at = :expiresAt,
           updated_by = :updatedBy
       WHERE id = :id`,
      {
        id,
        title,
        slug,
        summary,
        content,
        coverImageUrl,
        category,
        isFeatured: checkbox(formData, "isFeatured"),
        showOnHome: checkbox(formData, "showOnHome"),
        ctaLabel,
        ctaUrl,
        courseId,
        status,
        publishedAt,
        expiresAt,
        updatedBy: user.id,
      },
    );
  } else {
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO announcements
         (title, slug, summary, content, cover_image_url, category, is_featured,
          show_on_home, cta_label, cta_url, course_id, status, published_at,
          expires_at, created_by, updated_by)
       VALUES
         (:title, :slug, :summary, :content, :coverImageUrl, :category, :isFeatured,
          :showOnHome, :ctaLabel, :ctaUrl, :courseId, :status, :publishedAt,
          :expiresAt, :createdBy, :updatedBy)`,
      {
        title,
        slug,
        summary,
        content,
        coverImageUrl,
        category,
        isFeatured: checkbox(formData, "isFeatured"),
        showOnHome: checkbox(formData, "showOnHome"),
        ctaLabel,
        ctaUrl,
        courseId,
        status,
        publishedAt,
        expiresAt,
        createdBy: user.id,
        updatedBy: user.id,
      },
    );
    entityId = result.insertId;
  }

  await logAudit({
    userId: user.id,
    action: id ? "announcement.updated" : "announcement.created",
    entityType: "announcement",
    entityId,
    detail: { title, slug, status, category, showOnHome: checkbox(formData, "showOnHome") },
  });

  await refreshAnnouncementPages();
  redirect("/admin/announcements?updated=saved");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const user = await requireCurrentUser(["admin", "staff"]);
  const id = optionalId(formData, "id");
  if (!id) throw new Error("ไม่พบข่าวที่ต้องการลบ");

  await executeQuery<ResultSetHeader>("DELETE FROM announcements WHERE id = :id", { id });
  await logAudit({
    userId: user.id,
    action: "announcement.deleted",
    entityType: "announcement",
    entityId: id,
  });

  await refreshAnnouncementPages();
  redirect("/admin/announcements?updated=deleted");
}
