import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export type AnnouncementStatus = "draft" | "published" | "archived";

export interface AnnouncementRecord {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImageUrl: string;
  category: string;
  isFeatured: boolean;
  showOnHome: boolean;
  ctaLabel: string;
  ctaUrl: string;
  courseId: number | null;
  courseTitle: string | null;
  status: AnnouncementStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  createdByName: string | null;
  updatedByName: string | null;
  publishedDate: string;
  publishedDateTime: string;
}

export interface AnnouncementCourseOption {
  id: number;
  title: string;
  slug: string;
}

const fallbackAnnouncementImage = "/images/spc-hero-vocational-training.png";

function mapAnnouncement(row: RowDataPacket): AnnouncementRecord {
  return {
    id: Number(row.id),
    title: row.title ?? "",
    slug: row.slug ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    coverImageUrl: row.cover_image_url || fallbackAnnouncementImage,
    category: row.category ?? "general",
    isFeatured: Boolean(row.is_featured),
    showOnHome: Boolean(row.show_on_home),
    ctaLabel: row.cta_label ?? "",
    ctaUrl: row.cta_url ?? "",
    courseId: row.course_id === null ? null : Number(row.course_id),
    courseTitle: row.course_title ?? null,
    status: row.status ?? "draft",
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    viewCount: Number(row.view_count ?? 0),
    createdByName: row.created_by_name ?? null,
    updatedByName: row.updated_by_name ?? null,
    publishedDate: formatDate(row.published_at),
    publishedDateTime: formatDateTime(row.published_at),
  };
}

const announcementSelect = `
  SELECT a.id, a.title, a.slug, a.summary, a.content, a.cover_image_url,
         a.category, a.is_featured, a.show_on_home, a.cta_label, a.cta_url,
         a.course_id, c.title AS course_title, a.status, a.published_at,
         a.expires_at, a.view_count,
         creator.name AS created_by_name,
         updater.name AS updated_by_name
  FROM announcements a
  LEFT JOIN courses c ON c.id = a.course_id
  LEFT JOIN users creator ON creator.id = a.created_by
  LEFT JOIN users updater ON updater.id = a.updated_by
`;

export async function getAdminAnnouncements() {
  const rows = await queryRows<RowDataPacket>(
    `${announcementSelect}
     ORDER BY a.is_featured DESC, a.published_at DESC, a.id DESC`,
  );
  return rows.map(mapAnnouncement);
}

export async function getPublicHomeAnnouncements(limit = 7) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.trunc(limit))) : 7;
  const rows = await queryRows<RowDataPacket>(
    `${announcementSelect}
     WHERE a.status = 'published'
       AND a.show_on_home = TRUE
       AND (a.published_at IS NULL OR a.published_at <= NOW())
       AND (a.expires_at IS NULL OR a.expires_at >= NOW())
     ORDER BY a.is_featured DESC, a.published_at DESC, a.id DESC
     LIMIT ${safeLimit}`,
  );
  return rows.map(mapAnnouncement);
}

export async function getPublicAnnouncements() {
  const rows = await queryRows<RowDataPacket>(
    `${announcementSelect}
     WHERE a.status = 'published'
       AND (a.published_at IS NULL OR a.published_at <= NOW())
       AND (a.expires_at IS NULL OR a.expires_at >= NOW())
     ORDER BY a.is_featured DESC, a.published_at DESC, a.id DESC`,
  );
  return rows.map(mapAnnouncement);
}

export async function getPublicAnnouncementBySlug(slug: string) {
  const rows = await queryRows<RowDataPacket>(
    `${announcementSelect}
     WHERE a.slug = :slug
       AND a.status = 'published'
       AND (a.published_at IS NULL OR a.published_at <= NOW())
       AND (a.expires_at IS NULL OR a.expires_at >= NOW())
     LIMIT 1`,
    { slug },
  );
  return rows[0] ? mapAnnouncement(rows[0]) : null;
}

export async function incrementAnnouncementViewCount(id: number) {
  await executeQuery<ResultSetHeader>(
    "UPDATE announcements SET view_count = view_count + 1 WHERE id = :id",
    { id },
  );
}

export async function getAnnouncementCourseOptions(): Promise<AnnouncementCourseOption[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT id, title, slug
     FROM courses
     WHERE deleted_at IS NULL
       AND status <> 'archived'
     ORDER BY title`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title ?? "",
    slug: row.slug ?? "",
  }));
}

export async function slugExists(slug: string, currentId: number | null) {
  const rows = await queryRows<RowDataPacket & { id: number }>(
    "SELECT id FROM announcements WHERE slug = :slug LIMIT 1",
    { slug },
  );
  const match = rows[0];
  return Boolean(match && (!currentId || Number(match.id) !== currentId));
}
