import "server-only";

import fs from "node:fs/promises";
import type { RowDataPacket } from "mysql2/promise";
import { resolveSafeBackupFile } from "@/lib/backup-paths";
import { queryRows } from "@/lib/db";
import type { BackupJobStatus } from "@/lib/backup-repositories";

export async function getBackupDownloadRecord(jobId: number) {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      status: BackupJobStatus;
      file_path: string | null;
      file_name: string | null;
      file_size: number | null;
    }
  >(
    `SELECT id, status, file_path, file_name, file_size
     FROM backup_jobs
     WHERE id = ?
       AND status = 'success'
     LIMIT 1`,
    [jobId],
  );

  const row = rows[0];
  const safePath = resolveSafeBackupFile(row?.file_path);
  if (!row || !safePath) return null;

  const stat = await fs.stat(/*turbopackIgnore: true*/ safePath).catch(() => null);
  if (!stat?.isFile()) return null;

  return {
    id: Number(row.id),
    path: safePath,
    fileName: row.file_name ?? safePath.split(/[\\/]/).pop() ?? "backup.gz",
    fileSize: Number(row.file_size ?? stat.size),
  };
}
