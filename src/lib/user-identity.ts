import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";

export interface DuplicateIdentity {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  deletedAt: string | null;
}

function compactPhoneSql(column: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, '-', ''), ' ', ''), '(', ''), ')', ''), '.', '')`;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export async function findDuplicateEmail(email: string, excludeUserId?: number) {
  const rows = await queryRows<RowDataPacket & DuplicateIdentity>(
    `SELECT id, name, email, role, status, deleted_at AS deletedAt
     FROM users
     WHERE LOWER(email) = LOWER(?)
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [email.trim().toLowerCase(), excludeUserId ?? null, excludeUserId ?? null],
  );

  return rows[0] ?? null;
}

export async function findDuplicatePhone(phone: string | null | undefined, excludeUserId?: number) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const rows = await queryRows<RowDataPacket & DuplicateIdentity>(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.deleted_at AS deletedAt
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE ${compactPhoneSql("p.phone")} = ?
       AND (? IS NULL OR u.id <> ?)
     LIMIT 1`,
    [normalizedPhone, excludeUserId ?? null, excludeUserId ?? null],
  );

  return rows[0] ?? null;
}

export async function assertUniqueUserIdentity(input: {
  email: string;
  phone?: string | null;
  excludeUserId?: number;
}) {
  const duplicateEmail = await findDuplicateEmail(input.email, input.excludeUserId);
  if (duplicateEmail) {
    const deletedText = duplicateEmail.deletedAt ? "ที่เคยถูกปิดบัญชีไว้" : "";
    throw new Error(`อีเมลนี้มีบัญชีในระบบแล้ว${deletedText}: ${duplicateEmail.name}`);
  }

  const duplicatePhone = await findDuplicatePhone(input.phone, input.excludeUserId);
  if (duplicatePhone) {
    const deletedText = duplicatePhone.deletedAt ? "ที่เคยถูกปิดบัญชีไว้" : "";
    throw new Error(`เบอร์โทรนี้มีบัญชีในระบบแล้ว${deletedText}: ${duplicatePhone.name} (${duplicatePhone.email})`);
  }
}
