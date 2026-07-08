import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";
import type {
  BackupJobStatus,
  BackupJobStatusPayload,
  BackupJobType,
} from "@/lib/backup-repositories";

export async function getBackupJobStatus(
  jobId: number,
): Promise<BackupJobStatusPayload | null> {
  const rows = await queryRows<
    RowDataPacket & {
      id: number;
      type: BackupJobType;
      status: BackupJobStatus;
      file_name: string | null;
      message: string | null;
      error_message: string | null;
    }
  >(
    `SELECT id, type, status, file_name, message, error_message
     FROM backup_jobs
     WHERE id = ?
     LIMIT 1`,
    [jobId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    type: row.type,
    status: row.status,
    fileName: row.file_name,
    downloadUrl: row.status === "success" ? `/admin/backups/${row.id}/download` : null,
    message: row.message,
    errorMessage: row.error_message,
  };
}
