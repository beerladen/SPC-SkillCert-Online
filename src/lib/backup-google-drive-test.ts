import "server-only";

import { execFile } from "node:child_process";
import path from "node:path";
import type { BackupGoogleDriveSettings } from "@/lib/backup-repositories";

export interface GoogleDriveTestResult {
  ok: boolean;
  message: string;
  destination: string;
}

function getTestScriptPath() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "scripts",
    "backup",
    "test-google-drive.mjs",
  );
}

function safeResult(message: string): GoogleDriveTestResult {
  return {
    ok: false,
    message,
    destination: "",
  };
}

export async function testGoogleDriveConnection(
  settings: BackupGoogleDriveSettings,
): Promise<GoogleDriveTestResult> {
  if (settings.folderMode === "folder_id" && !settings.folderId.trim()) {
    return safeResult("ยังไม่ได้กรอก Folder ID");
  }

  const payload = Buffer.from(JSON.stringify(settings), "utf8").toString("base64url");

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [getTestScriptPath(), payload],
      {
        cwd: /*turbopackIgnore: true*/ process.cwd(),
        windowsHide: true,
        timeout: 45000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve(safeResult((stderr.trim() || error.message).slice(0, 500)));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as GoogleDriveTestResult;
          resolve({
            ok: Boolean(parsed.ok),
            message: String(parsed.message || "ทดสอบไม่สำเร็จ").slice(0, 500),
            destination: String(parsed.destination || ""),
          });
        } catch {
          resolve(safeResult("ตัวทดสอบ Google Drive ส่งผลลัพธ์กลับมาไม่ถูกต้อง"));
        }
      },
    );
  });
}
