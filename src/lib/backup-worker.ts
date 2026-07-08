import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export async function startBackupWorker(jobId: number) {
  const scriptPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "scripts",
    "backup",
    "run-backup.mjs",
  );
  await fs.access(/*turbopackIgnore: true*/ scriptPath);

  const child = spawn(process.execPath, [scriptPath, "--job-id", String(jobId)], {
    cwd: /*turbopackIgnore: true*/ process.cwd(),
    detached: true,
    env: {
      ...process.env,
      BACKUP_RUNNER_PARENT: "next",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  child.unref();
}
