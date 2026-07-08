import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export type BackupJobType = "database" | "files" | "full";
export type BackupJobStatus = "queued" | "running" | "success" | "failed";
export type BackupStorage = "local" | "google_drive";
export type BackupCloudStatus = "skipped" | "pending" | "uploading" | "success" | "failed";

export interface BackupGoogleDriveSettings {
  enabled: boolean;
  remoteName: string;
  folderMode: "path" | "folder_id";
  folder: string;
  folderId: string;
  rcloneConfigPath: string;
}

export interface BackupScheduleSettings {
  enabled: boolean;
  type: BackupJobType;
  time: string;
  lastRunDate: string | null;
}

export interface BackupSettings {
  googleDrive: BackupGoogleDriveSettings;
  schedule: BackupScheduleSettings;
}

export interface RcloneStatus {
  available: boolean;
  version: string | null;
  message: string;
}

export interface BackupJob {
  id: number;
  type: BackupJobType;
  status: BackupJobStatus;
  storage: BackupStorage;
  cloudStatus: BackupCloudStatus;
  cloudRemote: string | null;
  cloudPath: string | null;
  cloudError: string | null;
  uploadedAt: string | null;
  fileName: string | null;
  fileSize: number | null;
  checksumSha256: string | null;
  message: string | null;
  errorMessage: string | null;
  createdByName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
  downloadUrl: string | null;
}

export interface BackupDashboardData {
  backupRoot: string;
  uploadRoot: string;
  uploadRootExists: boolean;
  activeCount: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  latestSuccessAt: string | null;
  settings: BackupSettings;
  rcloneStatus: RcloneStatus;
  jobs: BackupJob[];
}

export interface BackupJobStatusPayload {
  id: number;
  type: BackupJobType;
  status: BackupJobStatus;
  fileName: string | null;
  downloadUrl: string | null;
  message: string | null;
  errorMessage: string | null;
}

interface BackupJobRow extends RowDataPacket {
  id: number;
  type: BackupJobType;
  status: BackupJobStatus;
  storage: BackupStorage;
  cloud_status: BackupCloudStatus;
  cloud_remote: string | null;
  cloud_path: string | null;
  cloud_error: string | null;
  uploaded_at: string | null;
  file_name: string | null;
  file_size: number | null;
  checksum_sha256: string | null;
  message: string | null;
  error_message: string | null;
  created_by_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  duration_seconds: number | null;
}

type SettingValueType = "text" | "boolean" | "number" | "json";

const defaultBackupSettings: BackupSettings = {
  googleDrive: {
    enabled: false,
    remoteName: "gdrive",
    folderMode: "path",
    folder: "SPC-SkillCert-Backups",
    folderId: "",
    rcloneConfigPath: "",
  },
  schedule: {
    enabled: false,
    type: "full",
    time: "02:00",
    lastRunDate: null,
  },
};

let ensurePromise: Promise<void> | null = null;

export function isBackupJobType(value: string): value is BackupJobType {
  return ["database", "files", "full"].includes(value);
}

function parseBoolean(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function settingValue(settings: Map<string, string>, key: string, fallback: string) {
  const value = settings.get(key);
  return value === undefined || value === null ? fallback : value;
}

function getBackupRootLabel() {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) return configured;
  return process.platform === "win32" ? ".backups" : "/var/backups/spc-skillcert";
}

function getUploadRootLabel() {
  return process.env.UPLOAD_DIR?.trim() || "public/uploads";
}

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );

  if (Number(rows[0]?.total ?? 0) === 0) {
    await executeQuery<ResultSetHeader>(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export async function ensureBackupTables() {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await executeQuery<ResultSetHeader>(
      `CREATE TABLE IF NOT EXISTS backup_jobs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        type ENUM('database', 'files', 'full') NOT NULL,
        status ENUM('queued', 'running', 'success', 'failed') NOT NULL DEFAULT 'queued',
        storage ENUM('local', 'google_drive') NOT NULL DEFAULT 'local',
        file_path TEXT NULL,
        file_name VARCHAR(255) NULL,
        file_size BIGINT UNSIGNED NULL,
        checksum_sha256 CHAR(64) NULL,
        cloud_status ENUM('skipped', 'pending', 'uploading', 'success', 'failed') NOT NULL DEFAULT 'skipped',
        cloud_remote VARCHAR(120) NULL,
        cloud_path TEXT NULL,
        cloud_error TEXT NULL,
        uploaded_at DATETIME NULL,
        message TEXT NULL,
        error_message TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_backup_jobs_status (status, created_at),
        INDEX idx_backup_jobs_type (type, status, created_at),
        INDEX idx_backup_jobs_cloud_status (cloud_status, uploaded_at),
        INDEX idx_backup_jobs_created_by (created_by),
        CONSTRAINT fk_backup_jobs_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await executeQuery<ResultSetHeader>(
      `CREATE TABLE IF NOT EXISTS backup_settings (
        setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
        setting_value TEXT NULL,
        value_type ENUM('text', 'boolean', 'number', 'json') NOT NULL DEFAULT 'text',
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_backup_settings_updated_by (updated_by),
        CONSTRAINT fk_backup_settings_updated_by
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await ensureColumn(
      "backup_jobs",
      "cloud_status",
      "cloud_status ENUM('skipped', 'pending', 'uploading', 'success', 'failed') NOT NULL DEFAULT 'skipped' AFTER checksum_sha256",
    );
    await ensureColumn("backup_jobs", "cloud_remote", "cloud_remote VARCHAR(120) NULL AFTER cloud_status");
    await ensureColumn("backup_jobs", "cloud_path", "cloud_path TEXT NULL AFTER cloud_remote");
    await ensureColumn("backup_jobs", "cloud_error", "cloud_error TEXT NULL AFTER cloud_path");
    await ensureColumn("backup_jobs", "uploaded_at", "uploaded_at DATETIME NULL AFTER cloud_error");
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

function normalizeJob(row: BackupJobRow): BackupJob {
  const status = row.status;

  return {
    id: Number(row.id),
    type: row.type,
    status,
    storage: row.storage,
    cloudStatus: row.cloud_status ?? "skipped",
    cloudRemote: row.cloud_remote,
    cloudPath: row.cloud_path,
    cloudError: row.cloud_error,
    uploadedAt: formatDateTime(row.uploaded_at),
    fileName: row.file_name,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    checksumSha256: row.checksum_sha256,
    message: row.message,
    errorMessage: row.error_message,
    createdByName: row.created_by_name,
    startedAt: formatDateTime(row.started_at),
    finishedAt: formatDateTime(row.finished_at),
    createdAt: formatDateTime(row.created_at),
    durationSeconds:
      row.duration_seconds === null || row.duration_seconds === undefined
        ? null
        : Number(row.duration_seconds),
    downloadUrl: status === "success" ? `/admin/backups/${row.id}/download` : null,
  };
}

async function readSettingsMap() {
  await ensureBackupTables();

  const rows = await queryRows<RowDataPacket & { setting_key: string; setting_value: string | null }>(
    "SELECT setting_key, setting_value FROM backup_settings",
  );

  return new Map(rows.map((row) => [row.setting_key, row.setting_value ?? ""]));
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const settings = await readSettingsMap();
  const type = settingValue(settings, "backup.schedule.type", defaultBackupSettings.schedule.type);

  return {
    googleDrive: {
      enabled: parseBoolean(
        settings.get("backup.google.enabled"),
        defaultBackupSettings.googleDrive.enabled,
      ),
      remoteName: settingValue(
        settings,
        "backup.google.remote_name",
        defaultBackupSettings.googleDrive.remoteName,
      ),
      folderMode:
        settingValue(settings, "backup.google.folder_mode", "path") === "folder_id"
          ? "folder_id"
          : "path",
      folder: settingValue(settings, "backup.google.folder", defaultBackupSettings.googleDrive.folder),
      folderId: settingValue(settings, "backup.google.folder_id", ""),
      rcloneConfigPath: settingValue(settings, "backup.google.rclone_config_path", ""),
    },
    schedule: {
      enabled: parseBoolean(
        settings.get("backup.schedule.enabled"),
        defaultBackupSettings.schedule.enabled,
      ),
      type: isBackupJobType(type) ? type : defaultBackupSettings.schedule.type,
      time: settingValue(settings, "backup.schedule.time", defaultBackupSettings.schedule.time),
      lastRunDate: settings.get("backup.schedule.last_run_date") || null,
    },
  };
}

async function saveSetting(
  key: string,
  value: string,
  valueType: SettingValueType,
  userId: number,
) {
  await executeQuery<ResultSetHeader>(
    `INSERT INTO backup_settings (setting_key, setting_value, value_type, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       value_type = VALUES(value_type),
       updated_by = VALUES(updated_by)`,
    [key, value, valueType, userId],
  );
}

export async function saveBackupSettings(input: {
  userId: number;
  googleDrive: Omit<BackupGoogleDriveSettings, "remoteName" | "folder" | "folderId" | "rcloneConfigPath"> & {
    remoteName: string;
    folderMode: "path" | "folder_id";
    folder: string;
    folderId: string;
    rcloneConfigPath: string;
  };
  schedule: Omit<BackupScheduleSettings, "lastRunDate">;
}) {
  await ensureBackupTables();

  const remoteName = input.googleDrive.remoteName.trim() || "gdrive";
  if (!/^[A-Za-z0-9_.-]+$/.test(remoteName)) {
    throw new Error("ชื่อ Google Drive remote ใช้ได้เฉพาะตัวอักษร ตัวเลข จุด ขีดกลาง และขีดล่าง");
  }

  const scheduleTime = input.schedule.time.trim() || "02:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime)) {
    throw new Error("เวลาสำรองอัตโนมัติต้องอยู่ในรูปแบบ HH:MM");
  }

  if (!isBackupJobType(input.schedule.type)) {
    throw new Error("ประเภทสำรองอัตโนมัติไม่ถูกต้อง");
  }
  if (
    input.googleDrive.enabled &&
    input.googleDrive.folderMode === "folder_id" &&
    !input.googleDrive.folderId.trim()
  ) {
    throw new Error("กรุณากรอก Folder ID ของ Google Drive");
  }

  await saveSetting("backup.google.enabled", String(input.googleDrive.enabled), "boolean", input.userId);
  await saveSetting("backup.google.remote_name", remoteName, "text", input.userId);
  await saveSetting("backup.google.folder_mode", input.googleDrive.folderMode, "text", input.userId);
  await saveSetting(
    "backup.google.folder",
    input.googleDrive.folder.trim() || "SPC-SkillCert-Backups",
    "text",
    input.userId,
  );
  await saveSetting("backup.google.folder_id", input.googleDrive.folderId.trim(), "text", input.userId);
  await saveSetting(
    "backup.google.rclone_config_path",
    input.googleDrive.rcloneConfigPath.trim(),
    "text",
    input.userId,
  );
  await saveSetting("backup.schedule.enabled", String(input.schedule.enabled), "boolean", input.userId);
  await saveSetting("backup.schedule.type", input.schedule.type, "text", input.userId);
  await saveSetting("backup.schedule.time", scheduleTime, "text", input.userId);
}

export function getRcloneStatus(settings: BackupSettings): RcloneStatus {
  if (!settings.googleDrive.enabled) {
    return {
      available: false,
      version: null,
      message: "ยังไม่เปิดใช้งาน Google Drive",
    };
  }

  return {
    available: true,
    version: null,
    message: "เปิดใช้งานแล้ว กดบันทึกและทดสอบ Google Drive เพื่อตรวจ rclone, remote, Folder ID และสิทธิ์อัปโหลด",
  };
}

export async function getActiveBackupJobCount() {
  await ensureBackupTables();

  const rows = await queryRows<RowDataPacket & { total: number }>(
    "SELECT COUNT(*) AS total FROM backup_jobs WHERE status IN ('queued', 'running')",
  );

  return Number(rows[0]?.total ?? 0);
}

export async function createBackupJob(input: { type: BackupJobType; userId?: number | null }) {
  await ensureBackupTables();

  const settings = await getBackupSettings();
  const cloudStatus = settings.googleDrive.enabled ? "pending" : "skipped";

  const [result] = await executeQuery<ResultSetHeader>(
    `INSERT INTO backup_jobs (type, status, storage, cloud_status, cloud_remote, message, created_by)
     VALUES (?, 'queued', 'local', ?, ?, 'รอเริ่มสำรองข้อมูล', ?)`,
    [
      input.type,
      cloudStatus,
      settings.googleDrive.enabled ? settings.googleDrive.remoteName : null,
      input.userId ?? null,
    ],
  );

  return result.insertId;
}

export async function markBackupJobFailed(jobId: number, errorMessage: string) {
  await ensureBackupTables();

  await executeQuery<ResultSetHeader>(
    `UPDATE backup_jobs
     SET status = 'failed',
         message = 'เริ่มงานสำรองไม่สำเร็จ',
         error_message = ?,
         finished_at = NOW()
     WHERE id = ?`,
    [errorMessage.slice(0, 4000), jobId],
  );
}

export async function getBackupDashboardData(): Promise<BackupDashboardData> {
  await ensureBackupTables();

  const [rows, statRows, latestRows, settings] = await Promise.all([
    queryRows<BackupJobRow>(
      `SELECT bj.id,
              bj.type,
              bj.status,
              bj.storage,
              bj.cloud_status,
              bj.cloud_remote,
              bj.cloud_path,
              bj.cloud_error,
              bj.uploaded_at,
              bj.file_name,
              bj.file_size,
              bj.checksum_sha256,
              bj.message,
              bj.error_message,
              u.name AS created_by_name,
              bj.started_at,
              bj.finished_at,
              bj.created_at,
              CASE
                WHEN bj.started_at IS NULL THEN NULL
                ELSE TIMESTAMPDIFF(SECOND, bj.started_at, COALESCE(bj.finished_at, NOW()))
              END AS duration_seconds
       FROM backup_jobs bj
       LEFT JOIN users u ON u.id = bj.created_by
       ORDER BY bj.created_at DESC, bj.id DESC
       LIMIT 40`,
    ),
    queryRows<RowDataPacket & { status: BackupJobStatus; total: number }>(
      "SELECT status, COUNT(*) AS total FROM backup_jobs GROUP BY status",
    ),
    queryRows<RowDataPacket & { latest_success_at: string | null }>(
      "SELECT MAX(finished_at) AS latest_success_at FROM backup_jobs WHERE status = 'success'",
    ),
    getBackupSettings(),
  ]);
  const rcloneStatus = getRcloneStatus(settings);

  const statusCounts = new Map(
    statRows.map((row) => [row.status, Number(row.total ?? 0)] as const),
  );
  const successCount = statusCounts.get("success") ?? 0;
  const failedCount = statusCounts.get("failed") ?? 0;
  const activeCount = (statusCounts.get("queued") ?? 0) + (statusCounts.get("running") ?? 0);

  return {
    backupRoot: getBackupRootLabel(),
    uploadRoot: getUploadRootLabel(),
    uploadRootExists: true,
    activeCount,
    totalCount: Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0),
    successCount,
    failedCount,
    latestSuccessAt: formatDateTime(latestRows[0]?.latest_success_at ?? null),
    settings,
    rcloneStatus,
    jobs: rows.map(normalizeJob),
  };
}

export async function getBackupJobStatus(
  jobId: number,
): Promise<BackupJobStatusPayload | null> {
  await ensureBackupTables();

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
