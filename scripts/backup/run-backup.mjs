import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import { createGzip } from "node:zlib";
import path from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const projectRoot = process.cwd();

dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

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

function getBackupRoot() {
  if (process.env.BACKUP_DIR?.trim()) {
    return path.resolve(process.env.BACKUP_DIR.trim());
  }

  if (process.platform === "win32") {
    return path.resolve(projectRoot, ".backups");
  }

  return "/var/backups/spc-skillcert";
}

function getUploadRoot() {
  const configured = process.env.UPLOAD_DIR?.trim() || "public/uploads";
  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(projectRoot, configured);
}

function timestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return parts.join("");
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function fileSize(targetPath) {
  const stat = await fs.stat(targetPath);
  return stat.size;
}

async function checksumSha256(targetPath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(targetPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      windowsHide: true,
    });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-4000)}`));
      }
    });
  });
}

function getMysqldumpCommand() {
  if (process.env.MYSQLDUMP_PATH?.trim()) {
    return process.env.MYSQLDUMP_PATH.trim();
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\xampp\\mysql\\bin\\mysqldump.exe",
      "C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysqldump.exe",
      "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
    ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found) return found;
  }

  return "mysqldump";
}

function getRcloneCommand() {
  return process.env.RCLONE_PATH?.trim() || "rclone";
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function getBackupSettings(connection) {
  const [rows] = await connection.execute(
    "SELECT setting_key, setting_value FROM backup_settings",
  );
  const settings = new Map(rows.map((row) => [row.setting_key, row.setting_value ?? ""]));

  return {
    googleDrive: {
      enabled: parseBoolean(settings.get("backup.google.enabled")),
      remoteName: settings.get("backup.google.remote_name") || "gdrive",
      folderMode: settings.get("backup.google.folder_mode") === "folder_id" ? "folder_id" : "path",
      folder: settings.get("backup.google.folder") || "SPC-SkillCert-Backups",
      folderId: settings.get("backup.google.folder_id") || "",
      rcloneConfigPath: settings.get("backup.google.rclone_config_path") || "",
    },
  };
}

function normalizeDriveFolder(folder) {
  return String(folder || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function remoteDestination(settings, fileName) {
  const folder = normalizeDriveFolder(settings.folder);
  return `${settings.remoteName}:${folder ? `${folder}/${fileName}` : fileName}`;
}

async function uploadToGoogleDrive(connection, jobId, targetPath, sha256) {
  const settings = (await getBackupSettings(connection)).googleDrive;
  if (!settings.enabled) {
    return {
      enabled: false,
      status: "skipped",
      remote: null,
      path: null,
      error: null,
    };
  }

  await updateJob(connection, jobId, {
    cloud_status: "uploading",
    cloud_remote: settings.remoteName,
    cloud_error: null,
    message: "กำลังอัปโหลดไฟล์สำรองไป Google Drive",
  });

  const fileName = path.basename(targetPath);
  const checksumPath = `${targetPath}.sha256`;
  await fs.writeFile(checksumPath, `${sha256}  ${fileName}\n`, "utf8");

  const rclone = getRcloneCommand();
  const baseArgs = [];
  if (settings.rcloneConfigPath) {
    baseArgs.push("--config", settings.rcloneConfigPath);
  }
  if (settings.folderMode === "folder_id" && settings.folderId) {
    baseArgs.push("--drive-root-folder-id", settings.folderId);
  }

  const mainDestination = remoteDestination(settings, fileName);
  const checksumDestination = remoteDestination(settings, path.basename(checksumPath));

  await runCommand(rclone, [
    ...baseArgs,
    "copyto",
    targetPath,
    mainDestination,
    "--checksum",
    "--transfers",
    "1",
    "--checkers",
    "4",
  ]);

  await runCommand(rclone, [
    ...baseArgs,
    "copyto",
    checksumPath,
    checksumDestination,
    "--checksum",
    "--transfers",
    "1",
    "--checkers",
    "4",
  ]);

  return {
    enabled: true,
    status: "success",
    remote: settings.remoteName,
    path: mainDestination,
    error: null,
  };
}

async function createDatabaseDump(targetPath) {
  const config = parseDatabaseUrl();
  await ensureDir(path.dirname(targetPath));

  const mysqldump = getMysqldumpCommand();
  const args = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--events",
    "--default-character-set=utf8mb4",
    "--no-tablespaces",
    config.database,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(mysqldump, args, {
      env: {
        ...process.env,
        MYSQL_PWD: config.password,
      },
      shell: false,
      windowsHide: true,
    });
    const gzip = createGzip({ level: 9 });
    const output = createWriteStream(targetPath);
    let stderr = "";
    let processClosed = false;
    let outputFinished = false;
    let failed = false;

    function fail(error) {
      if (failed) return;
      failed = true;
      reject(error);
    }

    function done() {
      if (!failed && processClosed && outputFinished) {
        resolve();
      }
    }

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", fail);
    child.on("close", (code) => {
      processClosed = true;
      if (code !== 0) {
        fail(new Error(`${mysqldump} exited with code ${code}: ${stderr.slice(-4000)}`));
        return;
      }
      done();
    });

    gzip.on("error", fail);
    output.on("error", fail);
    output.on("finish", () => {
      outputFinished = true;
      done();
    });

    child.stdout.pipe(gzip).pipe(output);
  });
}

async function createUploadsArchive(targetPath) {
  const uploadRoot = getUploadRoot();
  await fs.access(uploadRoot);
  await ensureDir(path.dirname(targetPath));

  const tar = process.env.TAR_PATH?.trim() || "tar";
  await runCommand(tar, [
    "-czf",
    targetPath,
    "-C",
    path.dirname(uploadRoot),
    path.basename(uploadRoot),
  ]);
}

async function createFullArchive(targetPath, jobId, stamp) {
  const backupRoot = getBackupRoot();
  const tempDir = path.join(backupRoot, "tmp", `job-${jobId}-${stamp}`);
  await ensureDir(tempDir);

  try {
    const databasePath = path.join(tempDir, `database-${stamp}.sql.gz`);
    const filesPath = path.join(tempDir, `uploads-${stamp}.tar.gz`);
    await createDatabaseDump(databasePath);
    await createUploadsArchive(filesPath);

    const manifest = {
      createdAt: new Date().toISOString(),
      project: "spc-skillcert-online",
      database: parseDatabaseUrl().database,
      uploadRoot: getUploadRoot(),
      artifacts: [
        {
          name: path.basename(databasePath),
          size: await fileSize(databasePath),
          sha256: await checksumSha256(databasePath),
        },
        {
          name: path.basename(filesPath),
          size: await fileSize(filesPath),
          sha256: await checksumSha256(filesPath),
        },
      ],
    };

    await fs.writeFile(
      path.join(tempDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    await ensureDir(path.dirname(targetPath));
    const tar = process.env.TAR_PATH?.trim() || "tar";
    await runCommand(tar, ["-czf", targetPath, "-C", tempDir, "."]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function connect() {
  const config = parseDatabaseUrl();
  return mysql.createConnection({
    ...config,
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });
}

async function updateJob(connection, jobId, fields) {
  const entries = Object.entries(fields);
  const sql = entries.map(([key]) => `${key} = ?`).join(", ");
  await connection.execute(`UPDATE backup_jobs SET ${sql} WHERE id = ?`, [
    ...entries.map(([, value]) => value),
    jobId,
  ]);
}

async function main() {
  const jobId = Number(argValue("--job-id"));
  if (!Number.isFinite(jobId) || jobId <= 0) {
    throw new Error("Missing --job-id.");
  }

  const connection = await connect();
  const [rows] = await connection.execute(
    "SELECT id, type FROM backup_jobs WHERE id = ? LIMIT 1",
    [jobId],
  );
  const job = rows[0];
  if (!job) {
    await connection.end();
    throw new Error(`Backup job ${jobId} not found.`);
  }

  await updateJob(connection, jobId, {
    status: "running",
    message: "กำลังสร้างไฟล์สำรอง",
    started_at: new Date(),
    error_message: null,
  });

  const stamp = timestamp();
  const backupRoot = getBackupRoot();
  const type = job.type;
  let targetPath;

  try {
    if (type === "database") {
      targetPath = path.join(backupRoot, "db", `spc-database-${stamp}.sql.gz`);
      await createDatabaseDump(targetPath);
    } else if (type === "files") {
      targetPath = path.join(backupRoot, "files", `spc-uploads-${stamp}.tar.gz`);
      await createUploadsArchive(targetPath);
    } else if (type === "full") {
      targetPath = path.join(backupRoot, "full", `spc-full-${stamp}.tar.gz`);
      await createFullArchive(targetPath, jobId, stamp);
    } else {
      throw new Error(`Unsupported backup type: ${type}`);
    }

    const size = await fileSize(targetPath);
    const sha256 = await checksumSha256(targetPath);
    let cloudResult = {
      enabled: false,
      status: "skipped",
      remote: null,
      path: null,
      error: null,
    };

    try {
      cloudResult = await uploadToGoogleDrive(connection, jobId, targetPath, sha256);
    } catch (cloudError) {
      cloudResult = {
        enabled: true,
        status: "failed",
        remote: null,
        path: null,
        error: cloudError instanceof Error ? cloudError.message.slice(0, 4000) : String(cloudError),
      };
    }

    await updateJob(connection, jobId, {
      status: "success",
      storage: cloudResult.status === "success" ? "google_drive" : "local",
      file_path: targetPath,
      file_name: path.basename(targetPath),
      file_size: size,
      checksum_sha256: sha256,
      cloud_status: cloudResult.status,
      cloud_remote: cloudResult.remote,
      cloud_path: cloudResult.path,
      cloud_error: cloudResult.error,
      uploaded_at: cloudResult.status === "success" ? new Date() : null,
      error_message: null,
      message:
        cloudResult.status === "success"
          ? "สำรองข้อมูลสำเร็จและอัปโหลดไป Google Drive แล้ว"
          : cloudResult.status === "failed"
            ? "สำรองในเครื่องสำเร็จ แต่อัปโหลด Google Drive ไม่สำเร็จ"
            : "สำรองข้อมูลสำเร็จ",
      finished_at: new Date(),
    });
  } catch (error) {
    await updateJob(connection, jobId, {
      status: "failed",
      message: "สำรองข้อมูลไม่สำเร็จ",
      error_message: error instanceof Error ? error.message.slice(0, 4000) : String(error),
      finished_at: new Date(),
    });
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
