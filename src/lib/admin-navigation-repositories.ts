import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";
import type { UserRole } from "@/lib/auth";

export interface AdminNavigationSection {
  id: number;
  code: string;
  title: string | null;
  sortOrder: number;
  status: "active" | "inactive";
  isSystem: boolean;
  itemCount: number;
}

export interface AdminNavigationItem {
  id: number;
  sectionId: number | null;
  sectionCode: string | null;
  sectionTitle: string | null;
  title: string;
  href: string;
  iconKey: string;
  badgeKey: "pendingRegistrations" | "pendingPayments" | null;
  allowedRoles: UserRole[];
  sortOrder: number;
  status: "active" | "inactive";
  isSystem: boolean;
}

export interface SidebarNavigationItem {
  title: string;
  href: string;
  iconKey: string;
  badgeKey?: "pendingRegistrations" | "pendingPayments";
}

export interface SidebarNavigationSection {
  title?: string;
  items: SidebarNavigationItem[];
}

interface SectionSeed {
  code: string;
  title: string | null;
  sortOrder: number;
  isSystem?: boolean;
}

interface ItemSeed {
  sectionCode: string;
  title: string;
  href: string;
  iconKey: string;
  badgeKey?: "pendingRegistrations" | "pendingPayments";
  allowedRoles?: string;
  sortOrder: number;
  isSystem?: boolean;
}

const defaultSections: SectionSeed[] = [
  { code: "dashboard", title: null, sortOrder: 1, isSystem: true },
  { code: "courses", title: "หลักสูตร", sortOrder: 2, isSystem: true },
  { code: "registrations", title: "ลงทะเบียน", sortOrder: 3, isSystem: true },
  { code: "system", title: "ระบบ", sortOrder: 4, isSystem: true },
  { code: "bottom", title: "เมนูล่าง", sortOrder: 99, isSystem: true },
];

const defaultItems: ItemSeed[] = [
  { sectionCode: "dashboard", title: "Dashboard", href: "/admin/dashboard", iconKey: "Home", sortOrder: 1, isSystem: true },
  { sectionCode: "courses", title: "จัดการหลักสูตร", href: "/admin/courses", iconKey: "BookOpen", sortOrder: 1, isSystem: true },
  { sectionCode: "courses", title: "จัดการการเรียนรู้", href: "/admin/learning", iconKey: "ClipboardList", sortOrder: 2, isSystem: true },
  { sectionCode: "courses", title: "ผู้เข้าอบรม", href: "/admin/enrollments", iconKey: "GraduationCap", sortOrder: 3, isSystem: true },
  { sectionCode: "courses", title: "วัดผล/ข้อสอบ", href: "/admin/assessments", iconKey: "FileQuestion", sortOrder: 4, isSystem: true },
  {
    sectionCode: "registrations",
    title: "รายการลงทะเบียน",
    href: "/admin/registrations",
    iconKey: "ClipboardCheck",
    badgeKey: "pendingRegistrations",
    sortOrder: 1,
    isSystem: true,
  },
  {
    sectionCode: "registrations",
    title: "ตรวจหลักฐานชำระเงิน",
    href: "/admin/payments",
    iconKey: "CreditCard",
    badgeKey: "pendingPayments",
    sortOrder: 2,
    isSystem: true,
  },
  { sectionCode: "registrations", title: "ใบประกาศนียบัตร", href: "/admin/certificates", iconKey: "Award", sortOrder: 3, isSystem: true },
  { sectionCode: "system", title: "รายงาน", href: "/admin/reports", iconKey: "BarChart3", sortOrder: 1, isSystem: true },
  { sectionCode: "system", title: "ผู้ใช้งาน", href: "/admin/users", iconKey: "Users", sortOrder: 2, isSystem: true },
  { sectionCode: "system", title: "จัดการเมนู", href: "/admin/navigation", iconKey: "Navigation", allowedRoles: "admin", sortOrder: 3, isSystem: true },
  { sectionCode: "system", title: "ตั้งค่าเว็บไซต์", href: "/admin/settings", iconKey: "Settings", sortOrder: 4, isSystem: true },
  { sectionCode: "system", title: "สำรองข้อมูล", href: "/admin/backups", iconKey: "Database", allowedRoles: "admin", sortOrder: 5, isSystem: true },
  { sectionCode: "system", title: "ข่าวประชาสัมพันธ์", href: "/admin/announcements", iconKey: "Newspaper", allowedRoles: "admin,staff", sortOrder: 6, isSystem: true },
  { sectionCode: "bottom", title: "ข้อความติดต่อ", href: "/feedback", iconKey: "MessageCircle", sortOrder: 1, isSystem: true },
  { sectionCode: "bottom", title: "คู่มือระบบ", href: "/help", iconKey: "HelpCircle", sortOrder: 2, isSystem: true },
];

let ensurePromise: Promise<void> | null = null;

export function normalizeAllowedRoles(value: string | string[] | null | undefined): UserRole[] {
  const roles = Array.isArray(value) ? value : String(value ?? "").split(",");
  const normalized = roles
    .map((role) => role.trim())
    .filter((role): role is UserRole => ["admin", "staff", "instructor", "student"].includes(role));
  return normalized.length ? Array.from(new Set(normalized)) : ["admin"];
}

export async function ensureAdminNavigationTables() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await executeQuery<ResultSetHeader>(
      `CREATE TABLE IF NOT EXISTS admin_navigation_sections (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(80) NOT NULL,
        title VARCHAR(120) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_admin_nav_section_code (code),
        INDEX idx_admin_nav_sections_status (status, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await executeQuery<ResultSetHeader>(
      `CREATE TABLE IF NOT EXISTS admin_navigation_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        section_id BIGINT UNSIGNED NULL,
        title VARCHAR(120) NOT NULL,
        href VARCHAR(255) NOT NULL,
        icon_key VARCHAR(80) NOT NULL DEFAULT 'Circle',
        badge_key VARCHAR(80) NULL,
        allowed_roles VARCHAR(120) NOT NULL DEFAULT 'admin,staff,instructor',
        sort_order INT NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_admin_nav_item_href (href),
        INDEX idx_admin_nav_items_status (status, sort_order),
        INDEX idx_admin_nav_items_section (section_id, sort_order),
        CONSTRAINT fk_admin_nav_items_section
          FOREIGN KEY (section_id) REFERENCES admin_navigation_sections(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    const rows = await queryRows<RowDataPacket & { total: number }>(
      "SELECT COUNT(*) AS total FROM admin_navigation_sections",
    );

    if (Number(rows[0]?.total ?? 0) === 0) {
      for (const section of defaultSections) {
        await executeQuery<ResultSetHeader>(
          `INSERT INTO admin_navigation_sections (code, title, sort_order, status, is_system)
           VALUES (?, ?, ?, 'active', ?)`,
          [section.code, section.title, section.sortOrder, section.isSystem ? 1 : 0],
        );
      }

      for (const item of defaultItems) {
        await executeQuery<ResultSetHeader>(
          `INSERT INTO admin_navigation_items
             (section_id, title, href, icon_key, badge_key, allowed_roles, sort_order, status, is_system)
           SELECT id, ?, ?, ?, ?, ?, ?, 'active', ?
           FROM admin_navigation_sections
           WHERE code = ?`,
          [
            item.title,
            item.href,
            item.iconKey,
            item.badgeKey ?? null,
            item.allowedRoles ?? "admin,staff,instructor",
            item.sortOrder,
            item.isSystem ? 1 : 0,
            item.sectionCode,
          ],
        );
      }
    }

    for (const section of defaultSections) {
      await executeQuery<ResultSetHeader>(
        `INSERT INTO admin_navigation_sections (code, title, sort_order, status, is_system)
         VALUES (?, ?, ?, 'active', ?)
         ON DUPLICATE KEY UPDATE code = code`,
        [section.code, section.title, section.sortOrder, section.isSystem ? 1 : 0],
      );
    }

    for (const item of defaultItems) {
      await executeQuery<ResultSetHeader>(
        `INSERT INTO admin_navigation_items
           (section_id, title, href, icon_key, badge_key, allowed_roles, sort_order, status, is_system)
         SELECT id, ?, ?, ?, ?, ?, ?, 'active', ?
         FROM admin_navigation_sections
         WHERE code = ?
         ON DUPLICATE KEY UPDATE href = href`,
        [
          item.title,
          item.href,
          item.iconKey,
          item.badgeKey ?? null,
          item.allowedRoles ?? "admin,staff,instructor",
          item.sortOrder,
          item.isSystem ? 1 : 0,
          item.sectionCode,
        ],
      );
    }

    await executeQuery<ResultSetHeader>(
      `UPDATE admin_navigation_items
       SET allowed_roles = 'admin,staff,instructor'
       WHERE href IN (
         '/admin/dashboard',
         '/admin/courses',
         '/admin/learning',
         '/admin/enrollments',
         '/admin/assessments',
         '/admin/reports'
       )`,
    );
    await executeQuery<ResultSetHeader>(
      `UPDATE admin_navigation_items
       SET allowed_roles = 'admin,staff'
       WHERE href IN (
         '/admin/registrations',
         '/admin/payments',
         '/admin/certificates',
         '/admin/users',
         '/admin/announcements'
       )`,
    );
    await executeQuery<ResultSetHeader>(
      `UPDATE admin_navigation_items
       SET allowed_roles = 'admin'
       WHERE href IN ('/admin/navigation', '/admin/settings', '/admin/backups')`,
    );
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

export async function getAdminNavigationManagerData() {
  await ensureAdminNavigationTables();

  const [sections, items] = await Promise.all([
    queryRows<
      RowDataPacket & {
        id: number;
        code: string;
        title: string | null;
        sort_order: number;
        status: "active" | "inactive";
        is_system: 0 | 1;
        item_count: number;
      }
    >(
      `SELECT s.id, s.code, s.title, s.sort_order, s.status, s.is_system,
              COUNT(i.id) AS item_count
       FROM admin_navigation_sections s
       LEFT JOIN admin_navigation_items i ON i.section_id = s.id
       GROUP BY s.id, s.code, s.title, s.sort_order, s.status, s.is_system
       ORDER BY s.sort_order, s.id`,
    ),
    queryRows<
      RowDataPacket & {
        id: number;
        section_id: number | null;
        section_code: string | null;
        section_title: string | null;
        title: string;
        href: string;
        icon_key: string;
        badge_key: "pendingRegistrations" | "pendingPayments" | null;
        allowed_roles: string;
        sort_order: number;
        status: "active" | "inactive";
        is_system: 0 | 1;
      }
    >(
      `SELECT i.id, i.section_id, s.code AS section_code, s.title AS section_title,
              i.title, i.href, i.icon_key, i.badge_key, i.allowed_roles,
              i.sort_order, i.status, i.is_system
       FROM admin_navigation_items i
       LEFT JOIN admin_navigation_sections s ON s.id = i.section_id
       ORDER BY COALESCE(s.sort_order, 999), i.sort_order, i.id`,
    ),
  ]);

  return {
    sections: sections.map((row): AdminNavigationSection => ({
      id: Number(row.id),
      code: row.code,
      title: row.title,
      sortOrder: Number(row.sort_order ?? 0),
      status: row.status,
      isSystem: Boolean(row.is_system),
      itemCount: Number(row.item_count ?? 0),
    })),
    items: items.map((row): AdminNavigationItem => ({
      id: Number(row.id),
      sectionId: row.section_id === null ? null : Number(row.section_id),
      sectionCode: row.section_code,
      sectionTitle: row.section_title,
      title: row.title,
      href: row.href,
      iconKey: row.icon_key,
      badgeKey: row.badge_key,
      allowedRoles: normalizeAllowedRoles(row.allowed_roles),
      sortOrder: Number(row.sort_order ?? 0),
      status: row.status,
      isSystem: Boolean(row.is_system),
    })),
  };
}

export async function getSidebarNavigation(role: UserRole) {
  await ensureAdminNavigationTables();

  const rows = await queryRows<
    RowDataPacket & {
      section_code: string;
      section_title: string | null;
      section_sort_order: number;
      title: string;
      href: string;
      icon_key: string;
      badge_key: "pendingRegistrations" | "pendingPayments" | null;
      item_sort_order: number;
    }
  >(
    `SELECT s.code AS section_code, s.title AS section_title, s.sort_order AS section_sort_order,
            i.title, i.href, i.icon_key, i.badge_key, i.sort_order AS item_sort_order
     FROM admin_navigation_sections s
     JOIN admin_navigation_items i ON i.section_id = s.id
     WHERE s.status = 'active'
       AND i.status = 'active'
       AND FIND_IN_SET(?, i.allowed_roles) > 0
     ORDER BY s.sort_order, s.id, i.sort_order, i.id`,
    [role],
  );

  const sectionMap = new Map<string, SidebarNavigationSection>();
  const bottomItems: SidebarNavigationItem[] = [];

  for (const row of rows) {
    const item: SidebarNavigationItem = {
      title: row.title,
      href: row.href,
      iconKey: row.icon_key,
      badgeKey: row.badge_key ?? undefined,
    };

    if (row.section_code === "bottom") {
      bottomItems.push(item);
      continue;
    }

    const section = sectionMap.get(row.section_code) ?? {
      title: row.section_title ?? undefined,
      items: [],
    };
    section.items.push(item);
    sectionMap.set(row.section_code, section);
  }

  return {
    sections: Array.from(sectionMap.values()).filter((section) => section.items.length > 0),
    bottomItems,
  };
}
