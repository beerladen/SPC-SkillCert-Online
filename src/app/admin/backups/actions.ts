"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  createBackupJob,
  getActiveBackupJobCount,
  isBackupJobType,
  markBackupJobFailed,
  saveBackupSettings,
} from "@/lib/backup-repositories";
import { startBackupWorker } from "@/lib/backup-worker";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function googleDriveSettingsFromForm(formData: FormData) {
  return {
    enabled: formData.get("googleEnabled") === "on",
    remoteName: text(formData, "remoteName", "gdrive"),
    folderMode: formData.get("folderMode") === "folder_id" ? ("folder_id" as const) : ("path" as const),
    folder: text(formData, "driveFolder", "SPC-SkillCert-Backups"),
    folderId: text(formData, "driveFolderId"),
    rcloneConfigPath: text(formData, "rcloneConfigPath"),
  };
}

export async function startBackupAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const type = String(formData.get("type") ?? "");
  const shouldDownload = formData.get("download") === "1";

  if (!isBackupJobType(type)) {
    redirect("/admin/backups?error=invalid-type");
  }

  const activeCount = await getActiveBackupJobCount();
  if (activeCount > 0) {
    redirect("/admin/backups?error=running");
  }

  const jobId = await createBackupJob({ type, userId: user.id });

  try {
    await startBackupWorker(jobId);
    await logAudit({
      userId: user.id,
      action: "backup.started",
      entityType: "backup_job",
      entityId: jobId,
      detail: { type, storage: "local" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot start backup worker.";
    await markBackupJobFailed(jobId, message);
    await logAudit({
      userId: user.id,
      action: "backup.start_failed",
      entityType: "backup_job",
      entityId: jobId,
      detail: { type, message },
    });
    revalidatePath("/admin/backups");
    redirect("/admin/backups?error=start-failed");
  }

  revalidatePath("/admin/backups");
  const params = new URLSearchParams({
    started: type,
    job: String(jobId),
  });
  if (shouldDownload) {
    params.set("download", "1");
  }

  redirect(`/admin/backups?${params.toString()}`);
}

export async function saveBackupSettingsAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const type = text(formData, "scheduleType", "full");
  const intent = text(formData, "intent", "save");
  let successUrl = "/admin/backups?settings=saved";

  if (!isBackupJobType(type)) {
    redirect("/admin/backups?settings=invalid");
  }

  try {
    await saveBackupSettings({
      userId: user.id,
      googleDrive: googleDriveSettingsFromForm(formData),
      schedule: {
        enabled: formData.get("scheduleEnabled") === "on",
        type,
        time: text(formData, "scheduleTime", "02:00"),
      },
    });
    await logAudit({
      userId: user.id,
      action: "backup.settings_updated",
      entityType: "backup_settings",
      detail: {
        googleEnabled: formData.get("googleEnabled") === "on",
        scheduleEnabled: formData.get("scheduleEnabled") === "on",
        scheduleType: type,
      },
    });

    if (intent === "test") {
      const { testGoogleDriveConnection } = await import("@/lib/backup-google-drive-test");
      const result = await testGoogleDriveConnection(googleDriveSettingsFromForm(formData));
      const params = new URLSearchParams({
        settings: "saved",
        driveTest: result.ok ? "success" : "failed",
        message: result.message,
      });
      if (result.destination) params.set("destination", result.destination);
      successUrl = `/admin/backups?${params.toString()}`;
    }
  } catch (error) {
    const message = error instanceof Error ? encodeURIComponent(error.message) : "unknown";
    redirect(`/admin/backups?settings=failed&message=${message}`);
  }

  revalidatePath("/admin/backups");
  redirect(successUrl);
}
