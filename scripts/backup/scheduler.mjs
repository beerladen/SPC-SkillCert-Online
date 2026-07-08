import path from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const projectRoot = process.cwd();
const intervalMs = Number(process.env.BACKUP_SCHEDULER_INTERVAL_MS || 60_000);

dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });

function parseDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return {
    host: url.hostname || "localhost",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

async function connect() {
  return mysql.createConnection({
    ...parseDatabaseUrl(),
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isBackupJobType(value) {
  return ["database", "files", "full"].includes(value);
}

async function ensureTables(connection) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS backup_settings (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL,
      value_type ENUM('text', 'boolean', 'number', 'json') NOT NULL DEFAULT 'text',
      updated_by BIGINT UNSIGNED NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await connection.execute(
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
      INDEX idx_backup_jobs_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

async function readSettings(connection) {
  const [rows] = await connection.execute(
    "SELECT setting_key, setting_value FROM backup_settings",
  );
  const settings = new Map(rows.map((row) => [row.setting_key, row.setting_value ?? ""]));
  const type = settings.get("backup.schedule.type") || "full";

  return {
    googleEnabled: parseBoolean(settings.get("backup.google.enabled")),
    remoteName: settings.get("backup.google.remote_name") || "gdrive",
    scheduleEnabled: parseBoolean(settings.get("backup.schedule.enabled")),
    scheduleType: isBackupJobType(type) ? type : "full",
    scheduleTime: settings.get("backup.schedule.time") || "02:00",
    lastRunDate: settings.get("backup.schedule.last_run_date") || null,
  };
}

function bangkokParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function scheduleMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return 120;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function hasActiveJob(connection) {
  const [rows] = await connection.execute(
    "SELECT COUNT(*) AS total FROM backup_jobs WHERE status IN ('queued', 'running')",
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function saveLastRunDate(connection, date) {
  await connection.execute(
    `INSERT INTO backup_settings (setting_key, setting_value, value_type)
     VALUES ('backup.schedule.last_run_date', ?, 'text')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), value_type = VALUES(value_type)`,
    [date],
  );
}

function startWorker(jobId) {
  const child = spawn(process.execPath, ["scripts/backup/run-backup.mjs", "--job-id", String(jobId)], {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      BACKUP_RUNNER_PARENT: "scheduler",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function tick() {
  const connection = await connect();

  try {
    await ensureTables(connection);
    const settings = await readSettings(connection);
    if (!settings.scheduleEnabled) return;

    const now = bangkokParts();
    if (settings.lastRunDate === now.date) return;
    if (now.minutes < scheduleMinutes(settings.scheduleTime)) return;
    if (await hasActiveJob(connection)) return;

    const cloudStatus = settings.googleEnabled ? "pending" : "skipped";
    const [result] = await connection.execute(
      `INSERT INTO backup_jobs (type, status, storage, cloud_status, cloud_remote, message)
       VALUES (?, 'queued', 'local', ?, ?, 'รอเริ่มสำรองข้อมูลจากตัวตั้งเวลา')`,
      [
        settings.scheduleType,
        cloudStatus,
        settings.googleEnabled ? settings.remoteName : null,
      ],
    );
    await saveLastRunDate(connection, now.date);
    startWorker(result.insertId);
    console.log(`[backup-scheduler] started job ${result.insertId} (${settings.scheduleType})`);
  } finally {
    await connection.end();
  }
}

let running = false;

async function safeTick() {
  if (running) return;
  running = true;
  try {
    await tick();
  } catch (error) {
    console.error("[backup-scheduler]", error);
  } finally {
    running = false;
  }
}

console.log("[backup-scheduler] running");
await safeTick();
const timer = setInterval(safeTick, intervalMs);

function stop() {
  clearInterval(timer);
  console.log("[backup-scheduler] stopped");
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
