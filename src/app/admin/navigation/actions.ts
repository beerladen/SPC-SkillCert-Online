"use server";

import { revalidatePath } from "next/cache";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { executeQuery, queryRows } from "@/lib/db";
import {
  ensureAdminNavigationTables,
  normalizeAllowedRoles,
} from "@/lib/admin-navigation-repositories";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function optionalId(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(text(formData, key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function statusValue(formData: FormData) {
  return text(formData, "status", "active") === "inactive" ? "inactive" : "active";
}

function badgeKeyValue(formData: FormData) {
  const value = text(formData, "badgeKey");
  return ["pendingRegistrations", "pendingPayments"].includes(value) ? value : null;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function revalidateNavigation() {
  revalidatePath("/admin/navigation");
  revalidatePath("/admin/dashboard");
}

export async function saveAdminNavigationSectionAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  await ensureAdminNavigationTables();

  const id = optionalId(formData, "id");
  const code = normalizeCode(text(formData, "code"));
  const title = nullableText(formData, "title");
  const sortOrder = numberValue(formData, "sortOrder", 0);
  const status = statusValue(formData);

  if (!code) throw new Error("กรุณากรอกรหัสกลุ่มเมนู เช่น system หรือ reports");

  let entityId = id ?? 0;
  if (id) {
    await executeQuery<ResultSetHeader>(
      `UPDATE admin_navigation_sections
       SET code = ?, title = ?, sort_order = ?, status = ?
       WHERE id = ?`,
      [code, title, sortOrder, status, id],
    );
  } else {
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO admin_navigation_sections (code, title, sort_order, status, is_system)
       VALUES (?, ?, ?, ?, 0)`,
      [code, title, sortOrder, status],
    );
    entityId = result.insertId;
  }

  await logAudit({
    userId: user.id,
    action: id ? "admin_navigation.section_updated" : "admin_navigation.section_created",
    entityType: "admin_navigation_section",
    entityId,
    detail: { code, title, sortOrder, status },
  });
  await revalidateNavigation();
}

export async function deleteAdminNavigationSectionAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  await ensureAdminNavigationTables();
  const id = optionalId(formData, "id");
  if (!id) throw new Error("ไม่พบกลุ่มเมนูที่ต้องการลบ");

  const rows = await queryRows<RowDataPacket & { item_count: number; code: string }>(
    `SELECT s.code, COUNT(i.id) AS item_count
     FROM admin_navigation_sections s
     LEFT JOIN admin_navigation_items i ON i.section_id = s.id
     WHERE s.id = ?
     GROUP BY s.id, s.code`,
    [id],
  );

  if (Number(rows[0]?.item_count ?? 0) > 0) {
    throw new Error("ยังมีรายการเมนูในกลุ่มนี้ กรุณาย้ายหรือลบรายการเมนูก่อน");
  }

  await executeQuery<ResultSetHeader>("DELETE FROM admin_navigation_sections WHERE id = ?", [id]);
  await logAudit({
    userId: user.id,
    action: "admin_navigation.section_deleted",
    entityType: "admin_navigation_section",
    entityId: id,
    detail: { code: rows[0]?.code ?? null },
  });
  await revalidateNavigation();
}

export async function saveAdminNavigationItemAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  await ensureAdminNavigationTables();

  const id = optionalId(formData, "id");
  const sectionId = optionalId(formData, "sectionId");
  const title = text(formData, "title");
  const href = text(formData, "href");
  const iconKey = text(formData, "iconKey", "Circle") || "Circle";
  const badgeKey = badgeKeyValue(formData);
  const allowedRoles = normalizeAllowedRoles(formData.getAll("roles").map(String)).join(",");
  const sortOrder = numberValue(formData, "sortOrder", 0);
  const status = statusValue(formData);

  if (!sectionId) throw new Error("กรุณาเลือกกลุ่มเมนู");
  if (!title) throw new Error("กรุณากรอกชื่อเมนู");
  if (!href.startsWith("/")) throw new Error("URL เมนูต้องขึ้นต้นด้วย / เช่น /admin/reports");

  let entityId = id ?? 0;
  if (id) {
    await executeQuery<ResultSetHeader>(
      `UPDATE admin_navigation_items
       SET section_id = ?, title = ?, href = ?, icon_key = ?, badge_key = ?,
           allowed_roles = ?, sort_order = ?, status = ?
       WHERE id = ?`,
      [sectionId, title, href, iconKey, badgeKey, allowedRoles, sortOrder, status, id],
    );
  } else {
    const [result] = await executeQuery<ResultSetHeader>(
      `INSERT INTO admin_navigation_items
         (section_id, title, href, icon_key, badge_key, allowed_roles, sort_order, status, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [sectionId, title, href, iconKey, badgeKey, allowedRoles, sortOrder, status],
    );
    entityId = result.insertId;
  }

  await logAudit({
    userId: user.id,
    action: id ? "admin_navigation.item_updated" : "admin_navigation.item_created",
    entityType: "admin_navigation_item",
    entityId,
    detail: { sectionId, title, href, iconKey, badgeKey, allowedRoles, sortOrder, status },
  });
  await revalidateNavigation();
}

export async function deleteAdminNavigationItemAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  await ensureAdminNavigationTables();
  const id = optionalId(formData, "id");
  if (!id) throw new Error("ไม่พบรายการเมนูที่ต้องการลบ");

  const rows = await queryRows<RowDataPacket & { title: string; href: string }>(
    "SELECT title, href FROM admin_navigation_items WHERE id = ? LIMIT 1",
    [id],
  );

  await executeQuery<ResultSetHeader>("DELETE FROM admin_navigation_items WHERE id = ?", [id]);
  await logAudit({
    userId: user.id,
    action: "admin_navigation.item_deleted",
    entityType: "admin_navigation_item",
    entityId: id,
    detail: { title: rows[0]?.title ?? null, href: rows[0]?.href ?? null },
  });
  await revalidateNavigation();
}
