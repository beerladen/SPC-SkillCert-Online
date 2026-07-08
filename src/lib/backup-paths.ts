import "server-only";

import path from "node:path";

export function getBackupRoot() {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return path.resolve(/*turbopackIgnore: true*/ configured);
  }

  if (process.platform === "win32") {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".backups");
  }

  return "/var/backups/spc-skillcert";
}

export function getUploadRoot() {
  const configured = process.env.UPLOAD_DIR?.trim() || "public/uploads";
  return path.isAbsolute(configured)
    ? path.resolve(/*turbopackIgnore: true*/ configured)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
}

export function resolveSafeBackupFile(filePath: string | null | undefined) {
  if (!filePath) return null;

  const root = path.resolve(/*turbopackIgnore: true*/ getBackupRoot());
  const resolved = path.resolve(/*turbopackIgnore: true*/ filePath);
  const withinRoot = resolved === root || resolved.startsWith(`${root}${path.sep}`);

  return withinRoot ? resolved : null;
}
