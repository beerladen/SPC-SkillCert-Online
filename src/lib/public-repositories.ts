import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  getPublicHomeAnnouncements,
  type AnnouncementRecord,
} from "@/lib/announcement-repositories";

export interface PublicSiteSettings {
  name: string;
  shortName: string;
  phone: string;
  email: string;
  address: string;
}

export interface PublicHomeHeroSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
}

export interface PublicCategory {
  id: number;
  slug: string;
  name: string;
  icon: string;
  description: string;
}

export interface PublicInstructor {
  id: number;
  name: string;
  role: string;
  initials: string;
}

export interface PublicCourse {
  id: number;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImage: string;
  registrationFee: number;
  originalFee: number | null;
  duration: string;
  durationMinutes: number;
  capacity: number | null;
  registered: number;
  format: string;
  level: string;
  status: "draft" | "open" | "nearly_full" | "closed" | "archived";
  startDate: string;
  certificate: boolean;
  lessonCount: number;
  rating: number;
  reviewCount: number;
  category: PublicCategory;
  instructor: PublicInstructor;
}

export type PublicAnnouncement = AnnouncementRecord;

export interface PublicStats {
  openCourses: number;
  learners: number;
  certificates: number;
  verifications: number;
}

export interface PublicCourseDetail extends PublicCourse {
  outcomes: string[];
  requirements: string[];
  audience: string[];
  curriculum: Array<{
    title: string;
    description: string;
    duration: string;
    lessons: string[];
  }>;
  assessment: {
    preTest: string;
    quizzes: string;
    postTest: string;
    passingScore: string;
    progressRequired: string;
  };
}

const defaultSite: PublicSiteSettings = {
  name: "ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์",
  shortName: "SPC SkillCert Online",
  phone: "02-000-0000",
  email: "training@spc.ac.th",
  address: "ศูนย์อบรมวิชาชีพระยะสั้น",
};

const defaultHomeHero: PublicHomeHeroSettings = {
  enabled: true,
  title: "ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์",
  subtitle: "SPC SkillCert Online",
  description: "เรียนออนไลน์ ได้มาตรฐาน พัฒนาทักษะวิชาชีพ พร้อมวัดผลและออกใบประกาศนียบัตรที่ตรวจสอบได้",
  imageUrl: "/images/spc-hero-vocational-training.png",
  primaryLabel: "ดูหลักสูตรที่เปิดรับสมัคร",
  primaryUrl: "/courses",
  secondaryLabel: "ตรวจสอบใบประกาศนียบัตร",
  secondaryUrl: "/verify-certificate",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function courseFormat(value: string) {
  if (value === "live_online") return "ออนไลน์สด";
  if (value === "recorded") return "เรียนจากคลิป";
  return "ออนไลน์";
}

function mapCourse(row: RowDataPacket): PublicCourse {
  const durationMinutes = Number(row.duration_minutes ?? 0);
  return {
    id: Number(row.id),
    title: row.title ?? "",
    slug: row.slug ?? "",
    shortDescription: row.short_description ?? "",
    description: row.description ?? row.short_description ?? "",
    coverImage: row.cover_image_url || "/images/spc-hero-vocational-training.png",
    registrationFee: Number(row.registration_fee ?? 0),
    originalFee: row.original_fee === null ? null : Number(row.original_fee),
    duration: durationMinutes > 0 ? `${Math.ceil(durationMinutes / 60)} ชั่วโมง` : "ตลอดเวลา",
    durationMinutes,
    capacity: row.capacity === null ? null : Number(row.capacity),
    registered: Number(row.registered_count ?? 0),
    format: courseFormat(row.format),
    level: row.level ?? "beginner",
    status: row.status ?? "draft",
    startDate: formatDate(row.starts_at),
    certificate: Boolean(row.certificate_enabled ?? true),
    lessonCount: Number(row.lesson_count ?? 0),
    rating: Number(row.rating ?? 4.8),
    reviewCount: Number(row.review_count ?? row.registered_count ?? 0),
    category: {
      id: Number(row.category_id ?? 0),
      slug: row.category_slug ?? "",
      name: row.category_name ?? "ไม่ระบุหมวดหมู่",
      icon: row.category_icon ?? "□",
      description: row.category_description ?? "",
    },
    instructor: {
      id: Number(row.instructor_id ?? 0),
      name: row.instructor_name ?? "ไม่ระบุผู้สอน",
      role: row.instructor_position ?? "ผู้สอน",
      initials: initials(row.instructor_name ?? "SPC"),
    },
  };
}

async function getCourseRows(whereSql = "", values: Array<string | number> = []) {
  return queryRows<RowDataPacket>(
    `SELECT c.id, c.title, c.slug, c.short_description, c.description,
            c.cover_image_url, c.registration_fee, c.original_fee, c.duration_minutes,
            c.capacity, c.format, c.level, c.status, c.starts_at,
            cat.id AS category_id, cat.slug AS category_slug, cat.name AS category_name,
            cat.icon AS category_icon, cat.description AS category_description,
            i.id AS instructor_id, i.display_name AS instructor_name, i.position AS instructor_position,
            COUNT(DISTINCT e.id) AS registered_count,
            COUNT(DISTINCT l.id) AS lesson_count,
            COALESCE(ccr.certificate_enabled, TRUE) AS certificate_enabled
     FROM courses c
     JOIN categories cat ON cat.id = c.category_id
     JOIN instructors i ON i.id = c.instructor_id
     LEFT JOIN course_completion_rules ccr ON ccr.course_id = c.id
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
     LEFT JOIN course_sections s ON s.course_id = c.id AND s.status = 'published' AND s.deleted_at IS NULL
     LEFT JOIN lessons l ON l.section_id = s.id AND l.status = 'published' AND l.deleted_at IS NULL
     WHERE c.deleted_at IS NULL ${whereSql}
     GROUP BY c.id
     ORDER BY FIELD(c.status, 'open', 'nearly_full', 'closed', 'draft', 'archived'), c.published_at DESC, c.id DESC`,
    values,
  );
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const rows = await queryRows<RowDataPacket & { setting_key: string; setting_value: string }>(
    "SELECT setting_key, setting_value FROM site_settings",
  ).catch(() => []);

  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    name: map.get("site.name") || defaultSite.name,
    shortName: map.get("site.short_name") || defaultSite.shortName,
    phone: map.get("site.phone") || defaultSite.phone,
    email: map.get("site.email") || defaultSite.email,
    address: map.get("site.address") || defaultSite.address,
  };
}

export async function getPublicHomeHeroSettings(): Promise<PublicHomeHeroSettings> {
  const rows = await queryRows<RowDataPacket & { setting_key: string; setting_value: string }>(
    "SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE 'home.hero.%'",
  ).catch(() => []);

  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    enabled: (map.get("home.hero.enabled") ?? "true") !== "false",
    title: map.get("home.hero.title") || defaultHomeHero.title,
    subtitle: map.get("home.hero.subtitle") || defaultHomeHero.subtitle,
    description: map.get("home.hero.description") || defaultHomeHero.description,
    imageUrl: map.get("home.hero.image_url") || defaultHomeHero.imageUrl,
    primaryLabel: map.get("home.hero.primary_label") || defaultHomeHero.primaryLabel,
    primaryUrl: map.get("home.hero.primary_url") || defaultHomeHero.primaryUrl,
    secondaryLabel: map.get("home.hero.secondary_label") || defaultHomeHero.secondaryLabel,
    secondaryUrl: map.get("home.hero.secondary_url") || defaultHomeHero.secondaryUrl,
  };
}

export async function getPublicCategories(): Promise<PublicCategory[]> {
  const rows = await queryRows<RowDataPacket>(
    `SELECT id, name, slug, icon, description
     FROM categories
     WHERE deleted_at IS NULL
     ORDER BY sort_order, name`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    icon: row.icon ?? "□",
    description: row.description ?? "",
  }));
}

export async function getPublicCourses() {
  const rows = await getCourseRows("AND c.status IN ('open', 'nearly_full', 'closed')");
  return rows.map(mapCourse);
}

export async function getPublicHomeData() {
  const [site, hero, categories, courses, statRows, announcements] = await Promise.all([
    getPublicSiteSettings(),
    getPublicHomeHeroSettings(),
    getPublicCategories(),
    getPublicCourses(),
    queryRows<RowDataPacket>(
      `SELECT
        (SELECT COUNT(*) FROM courses WHERE status IN ('open', 'nearly_full') AND deleted_at IS NULL) AS open_courses,
        (SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active' AND deleted_at IS NULL) AS learners,
        (SELECT COUNT(*) FROM certificates WHERE status = 'issued') AS certificates,
        (SELECT COUNT(*) FROM certificate_verification_logs) AS verifications`,
    ),
    getPublicHomeAnnouncements(5),
  ]);

  const stats: PublicStats = {
    openCourses: Number(statRows[0]?.open_courses ?? courses.length),
    learners: Number(statRows[0]?.learners ?? 0),
    certificates: Number(statRows[0]?.certificates ?? 0),
    verifications: Number(statRows[0]?.verifications ?? 0),
  };

  return {
    site,
    hero,
    categories,
    courses,
    featuredCourses: courses.slice(0, 3),
    stats,
    announcements,
  };
}

export async function getPublicCourseDetail(slug: string): Promise<PublicCourseDetail | null> {
  const rows = await getCourseRows("AND c.slug = ? AND c.status <> 'archived'", [slug]);
  const base = rows[0] ? mapCourse(rows[0]) : null;
  if (!base) return null;

  const [outcomes, requirements, audience, sections, assessmentRows, ruleRows] =
    await Promise.all([
      queryRows<RowDataPacket>(
        "SELECT outcome FROM course_outcomes WHERE course_id = ? ORDER BY sort_order",
        [base.id],
      ),
      queryRows<RowDataPacket>(
        "SELECT requirement FROM course_requirements WHERE course_id = ? ORDER BY sort_order",
        [base.id],
      ),
      queryRows<RowDataPacket>(
        "SELECT audience FROM course_audiences WHERE course_id = ? ORDER BY sort_order",
        [base.id],
      ),
      queryRows<RowDataPacket>(
        `SELECT s.id, s.title, s.description, s.hours, l.title AS lesson_title
         FROM course_sections s
         LEFT JOIN lessons l ON l.section_id = s.id AND l.status = 'published' AND l.deleted_at IS NULL
         WHERE s.course_id = ? AND s.status = 'published' AND s.deleted_at IS NULL
         ORDER BY s.sort_order, l.sort_order`,
        [base.id],
      ),
      queryRows<RowDataPacket>(
        `SELECT type, COUNT(*) AS total, MAX(passing_score) AS passing_score
         FROM assessments
         WHERE course_id = ? AND status = 'published' AND deleted_at IS NULL
         GROUP BY type`,
        [base.id],
      ),
      queryRows<RowDataPacket>(
        "SELECT required_progress_percent, required_post_test_score FROM course_completion_rules WHERE course_id = ? LIMIT 1",
        [base.id],
      ),
    ]);

  const sectionMap = new Map<number, PublicCourseDetail["curriculum"][number]>();
  sections.forEach((row) => {
    const id = Number(row.id);
    if (!sectionMap.has(id)) {
      sectionMap.set(id, {
        title: row.title,
        description: row.description ?? "",
        duration: Number(row.hours ?? 0) > 0 ? `${row.hours} ชั่วโมง` : "ตามบทเรียน",
        lessons: [],
      });
    }
    if (row.lesson_title) sectionMap.get(id)?.lessons.push(row.lesson_title);
  });

  const assessmentMap = new Map(assessmentRows.map((row) => [row.type, row]));
  const postRule = ruleRows[0];

  return {
    ...base,
    outcomes: outcomes.map((row) => row.outcome),
    requirements: requirements.map((row) => row.requirement),
    audience: audience.map((row) => row.audience),
    curriculum: Array.from(sectionMap.values()),
    assessment: {
      preTest: `${Number(assessmentMap.get("pre_test")?.total ?? 0)} ชุด`,
      quizzes: `${Number(assessmentMap.get("quiz")?.total ?? 0)} ชุด`,
      postTest: `${Number(assessmentMap.get("post_test")?.total ?? 0)} ชุด`,
      passingScore: `${Number(postRule?.required_post_test_score ?? 70)}%`,
      progressRequired: `เรียนครบ ${Number(postRule?.required_progress_percent ?? 80)}%`,
    },
  };
}
