#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function output(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function getRcloneCommand() {
  return process.env.RCLONE_PATH?.trim() || "rclone";
}

function parseSettings() {
  const payload = process.argv[2];
  if (!payload) {
    throw new Error("ไม่พบข้อมูลตั้งค่า Google Drive สำหรับทดสอบ");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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

function baseArgs(settings) {
  const args = [];
  if (settings.rcloneConfigPath) {
    args.push("--config", settings.rcloneConfigPath);
  }
  if (settings.folderMode === "folder_id" && settings.folderId) {
    args.push("--drive-root-folder-id", settings.folderId);
  }
  return args;
}

function runRclone(args) {
  return new Promise((resolve, reject) => {
    execFile(getRcloneCommand(), args, { windowsHide: true, timeout: 30000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const settings = parseSettings();
  if (settings.folderMode === "folder_id" && !String(settings.folderId || "").trim()) {
    output({
      ok: false,
      message: "ยังไม่ได้กรอก Folder ID",
      destination: "",
    });
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spc-drive-test-"));
  const fileName = `spc-drive-test-${Date.now()}.txt`;
  const filePath = path.join(tempDir, fileName);
  const destination = remoteDestination(settings, fileName);

  try {
    await fs.writeFile(
      filePath,
      `SPC SkillCert Google Drive test\n${new Date().toISOString()}\n`,
      "utf8",
    );

    const args = baseArgs(settings);
    await runRclone([...args, "copyto", filePath, destination]);
    await runRclone([...args, "deletefile", destination]).catch(() => {});

    output({
      ok: true,
      message: "เชื่อมต่อ Google Drive สำเร็จ และลบไฟล์ทดสอบแล้ว",
      destination,
    });
  } catch (error) {
    output({
      ok: false,
      message: error instanceof Error ? error.message.slice(0, 500) : "ทดสอบไม่สำเร็จ",
      destination,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  output({
    ok: false,
    message: error instanceof Error ? error.message.slice(0, 500) : "ทดสอบไม่สำเร็จ",
    destination: "",
  });
});
