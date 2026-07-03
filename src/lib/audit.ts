import "server-only";

import { headers } from "next/headers";
import type { ResultSetHeader } from "mysql2/promise";
import { executeQuery } from "@/lib/db";

export async function logAudit(input: {
  userId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  detail?: Record<string, unknown> | null;
}) {
  const headerStore = await headers().catch(() => null);
  const ipAddress = headerStore?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await executeQuery<ResultSetHeader>(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.userId ?? null,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
      ipAddress,
    ],
  ).catch(() => {});
}
