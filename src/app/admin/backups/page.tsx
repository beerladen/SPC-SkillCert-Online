import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Download,
  FolderArchive,
  HardDriveDownload,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { saveBackupSettingsAction, startBackupAction } from "@/app/admin/backups/actions";
import { BackupAutoDownload } from "@/components/admin/backup-auto-download";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireCurrentUser } from "@/lib/auth";
import {
  getBackupDashboardData,
  type BackupDashboardData,
  type BackupJob,
  type BackupCloudStatus,
  type BackupJobStatus,
  type BackupJobType,
} from "@/lib/backup-repositories";

export const dynamic = "force-dynamic";

const typeLabels: Record<BackupJobType, string> = {
  database: "ฐานข้อมูล",
  files: "ไฟล์อัปโหลด",
  full: "สำรองครบชุด",
};

const statusLabels: Record<BackupJobStatus, string> = {
  queued: "รอเริ่ม",
  running: "กำลังสำรอง",
  success: "สำเร็จ",
  failed: "ไม่สำเร็จ",
};

const cloudStatusLabels: Record<BackupCloudStatus, string> = {
  skipped: "ไม่ได้อัปโหลด",
  pending: "รออัปโหลด",
  uploading: "กำลังอัปโหลด",
  success: "อัปโหลดแล้ว",
  failed: "อัปโหลดไม่สำเร็จ",
};

function statusVariant(status: BackupJobStatus) {
  if (status === "success") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function cloudStatusVariant(status: BackupCloudStatus) {
  if (status === "success") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function formatBytes(value: number | null) {
  if (value === null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} นาที ${remainingSeconds} วินาที`;
}

function feedbackMessage(started?: string, error?: string) {
  if (started && typeLabels[started as BackupJobType]) {
    return {
      variant: "success" as const,
      title: "เริ่มสำรองแล้ว",
      message: `ระบบรับงานสำรอง${typeLabels[started as BackupJobType]}แล้ว สามารถติดตามสถานะได้จากหน้านี้`,
    };
  }

  if (error === "running") {
    return {
      variant: "loading" as const,
      title: "มีงานสำรองกำลังทำงาน",
      message: "กรุณารอให้งานปัจจุบันเสร็จก่อน แล้วค่อยเริ่มสำรองรายการใหม่",
    };
  }

  if (error === "start-failed") {
    return {
      variant: "error" as const,
      title: "เริ่มสำรองไม่สำเร็จ",
      message: "ระบบสร้างรายการแล้ว แต่เริ่มตัวทำงานสำรองไม่ได้ กรุณาตรวจสิทธิ์โฟลเดอร์และ Node.js บนเซิร์ฟเวอร์",
    };
  }

  if (error) {
    return {
      variant: "error" as const,
      title: "คำสั่งไม่ถูกต้อง",
      message: "ระบบไม่สามารถเริ่มสำรองจากคำสั่งนี้ได้",
    };
  }

  return null;
}

function settingsFeedbackMessage(settings?: string, message?: string) {
  if (settings === "saved") {
    return {
      variant: "success" as const,
      title: "บันทึกการตั้งค่าสำเร็จ",
      message: "ระบบบันทึกค่า Google Drive และเวลาสำรองอัตโนมัติแล้ว",
    };
  }

  if (settings === "failed") {
    return {
      variant: "error" as const,
      title: "บันทึกการตั้งค่าไม่สำเร็จ",
      message: message ? decodeURIComponent(message) : "กรุณาตรวจข้อมูลการตั้งค่าอีกครั้ง",
    };
  }

  if (settings === "invalid") {
    return {
      variant: "error" as const,
      title: "ประเภทสำรองไม่ถูกต้อง",
      message: "กรุณาเลือกประเภทสำรองอัตโนมัติใหม่อีกครั้ง",
    };
  }

  return null;
}

function driveTestFeedbackMessage(driveTest?: string, message?: string, destination?: string) {
  if (driveTest === "success") {
    return {
      variant: "success" as const,
      title: "ทดสอบ Google Drive สำเร็จ",
      message: `${message ?? "เชื่อมต่อสำเร็จ"}${destination ? ` (${destination})` : ""}`,
    };
  }

  if (driveTest === "failed") {
    return {
      variant: "error" as const,
      title: "ทดสอบ Google Drive ไม่สำเร็จ",
      message: message ?? "กรุณาตรวจ remote, Folder ID, สิทธิ์บัญชี Google และ rclone config",
    };
  }

  return null;
}

export default async function AdminBackupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    started?: string;
    error?: string;
    job?: string;
    download?: string;
    settings?: string;
    message?: string;
    driveTest?: string;
    destination?: string;
  }>;
}) {
  await requireCurrentUser(["admin"]);
  const [{ started, error, job, download, settings, message, driveTest, destination }, data] = await Promise.all([
    searchParams,
    getBackupDashboardData(),
  ]);
  const feedback = feedbackMessage(started, error);
  const settingsFeedback = settingsFeedbackMessage(settings, message);
  const driveTestFeedback = driveTestFeedbackMessage(driveTest, message, destination);
  const isBusy = data.activeCount > 0;
  const autoDownloadJobId = download === "1" ? Number(job) : NaN;

  return (
    <AdminLayout title="สำรองข้อมูล">
      <div className="grid gap-6">
        {feedback && (
          <ActionFeedback
            variant={feedback.variant}
            title={feedback.title}
            message={feedback.message}
          />
        )}

        {settingsFeedback && (
          <ActionFeedback
            variant={settingsFeedback.variant}
            title={settingsFeedback.title}
            message={settingsFeedback.message}
          />
        )}

        {driveTestFeedback && (
          <ActionFeedback
            variant={driveTestFeedback.variant}
            title={driveTestFeedback.title}
            message={driveTestFeedback.message}
          />
        )}

        {isBusy && (
          <ActionFeedback
            variant="loading"
            title="กำลังสำรองข้อมูล"
            message="ระบบกำลังสร้างไฟล์สำรองอยู่ เบราว์เซอร์ปิดได้โดยไม่กระทบงานสำรอง เมื่อกลับมาหน้านี้ให้กดรีเฟรชเพื่อตรวจสถานะ"
          />
        )}

        {Number.isFinite(autoDownloadJobId) && autoDownloadJobId > 0 && (
          <BackupAutoDownload jobId={autoDownloadJobId} />
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            icon={ShieldCheck}
            label="สำรองสำเร็จ"
            value={String(data.successCount)}
            tone="emerald"
          />
          <SummaryCard
            icon={LoaderCircle}
            label="กำลังทำงาน"
            value={String(data.activeCount)}
            tone="sky"
          />
          <SummaryCard
            icon={TriangleAlert}
            label="ไม่สำเร็จ"
            value={String(data.failedCount)}
            tone="rose"
          />
          <SummaryCard
            icon={HardDriveDownload}
            label="ล่าสุด"
            value={data.latestSuccessAt ?? "-"}
            tone="amber"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <BackupActionCard
            type="database"
            title="สำรองฐานข้อมูล"
            description="เก็บผู้ใช้ หลักสูตร การเรียน ใบประกาศ และประวัติส่งงานเป็นไฟล์ SQL แบบบีบอัด"
            icon={Database}
            disabled={isBusy}
            accentClass="border-sky-200 bg-sky-50/80 dark:border-sky-500/30 dark:bg-sky-500/10"
          />
          <BackupActionCard
            type="files"
            title="สำรองไฟล์อัปโหลด"
            description="รวมไฟล์ในโฟลเดอร์ uploads เช่น หลักฐานส่งงาน รูปภาพ ลายเซ็น และไฟล์ประกอบบทเรียน"
            icon={FolderArchive}
            disabled={isBusy}
            accentClass="border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          />
          <BackupActionCard
            type="full"
            title="สำรองครบชุด"
            description="รวมฐานข้อมูล ไฟล์อัปโหลด และข้อมูลตรวจสอบไฟล์ไว้ในชุดเดียว เหมาะก่อนอัปเดตเว็บ"
            icon={Archive}
            disabled={isBusy}
            accentClass="border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>ประวัติการสำรอง</CardTitle>
                <CardDescription>
                  ดาวน์โหลดได้เฉพาะผู้ดูแลระบบ ไฟล์ถูกเก็บไว้นอกพื้นที่เว็บสาธารณะ
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href="/admin/backups">
                  <RefreshCw className="size-4" />
                  รีเฟรชสถานะ
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.jobs.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  ยังไม่มีประวัติการสำรอง เริ่มจากปุ่มสำรองครบชุดก่อนอัปเดตเว็บไซต์ครั้งถัดไป
                </p>
              ) : (
                <div className="grid gap-3">
                  {data.jobs.map((job) => (
                    <BackupJobItem key={job.id} job={job} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <GoogleDriveSettingsCard data={data} />
        </div>
      </div>
    </AdminLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  }[tone];

  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BackupActionCard({
  type,
  title,
  description,
  icon: Icon,
  disabled,
  accentClass,
}: {
  type: BackupJobType;
  title: string;
  description: string;
  icon: typeof Database;
  disabled: boolean;
  accentClass: string;
}) {
  return (
    <Card className={`overflow-hidden border ${accentClass}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="rounded-lg bg-background/80 p-2 text-primary">
            <Icon className="size-5" />
          </span>
          {title}
        </CardTitle>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={startBackupAction}>
          <input type="hidden" name="type" value={type} />
          <div className="grid gap-2">
            <Button type="submit" disabled={disabled} className="w-full">
              <HardDriveDownload className="size-4" />
              เริ่มสำรอง
            </Button>
            <Button
              type="submit"
              name="download"
              value="1"
              disabled={disabled}
              variant="outline"
              className="w-full whitespace-normal bg-background/80"
            >
              <Download className="size-4" />
              สำรองและดาวน์โหลดลงเครื่อง
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function GoogleDriveSettingsCard({ data }: { data: BackupDashboardData }) {
  const { googleDrive, schedule } = data.settings;

  return (
    <Card className="min-w-0 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="size-5 text-primary" />
          Google Drive
        </CardTitle>
        <CardDescription>
          อัปโหลดไฟล์สำรองขึ้น Google Drive หลังสำรองเสร็จ และตั้งเวลาสำรองอัตโนมัติรายวัน
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="grid gap-3 rounded-lg border bg-secondary/30 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-background p-2 text-primary">
              <UploadCloud className="size-5" />
            </div>
            <div className="grid gap-1">
              <p className="font-semibold">สถานะ Google Drive</p>
              <p className="text-muted-foreground">{data.rcloneStatus.message}</p>
              {data.rcloneStatus.version && (
                <p className="text-xs text-muted-foreground">{data.rcloneStatus.version}</p>
              )}
              <Badge variant={data.rcloneStatus.available ? "default" : "destructive"}>
                {data.rcloneStatus.available ? "เปิดใช้งาน" : "ยังไม่เปิดใช้งาน"}
              </Badge>
            </div>
          </div>
        </div>

        <form action={saveBackupSettingsAction} className="grid gap-4">
          <label className="flex items-start gap-3 rounded-lg border p-4">
            <input
              name="googleEnabled"
              type="checkbox"
              defaultChecked={googleDrive.enabled}
              className="mt-1"
            />
            <span className="grid gap-1">
              <span className="font-semibold">อัปโหลดไฟล์สำรองไป Google Drive</span>
              <span className="text-muted-foreground">
                เมื่อเปิดใช้งาน งานสำรองทุกครั้งจะพยายามส่งสำเนาไปยัง Drive ที่กำหนด
              </span>
            </span>
          </label>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="backupRemoteName">ชื่อ remote</Label>
              <Input
                id="backupRemoteName"
                name="remoteName"
                defaultValue={googleDrive.remoteName}
                placeholder="gdrive"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                ต้องตรงกับชื่อ remote ที่ตั้งไว้ใน rclone เช่น gdrive
              </p>
            </div>

            <div className="grid gap-2">
              <Label>ตำแหน่งโฟลเดอร์ปลายทาง</Label>
              <div className="grid gap-2">
                <label className="flex items-start gap-3 rounded-lg border bg-background p-3">
                  <input
                    name="folderMode"
                    type="radio"
                    value="path"
                    defaultChecked={googleDrive.folderMode !== "folder_id"}
                    className="mt-1"
                  />
                  <span className="grid gap-1">
                    <span className="font-medium">ใช้ชื่อโฟลเดอร์ / path</span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      เหมาะเมื่อ remote เปิดเห็น Drive ปกติ เช่น SPC-SkillCert-Backups
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border bg-background p-3">
                  <input
                    name="folderMode"
                    type="radio"
                    value="folder_id"
                    defaultChecked={googleDrive.folderMode === "folder_id"}
                    className="mt-1"
                  />
                  <span className="grid gap-1">
                    <span className="font-medium">ใช้ Folder ID จาก Google Drive</span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      ใช้ ID ท้าย URL ของโฟลเดอร์ ระบบจะใช้เป็นรากของพื้นที่สำรอง
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backupDriveFolder">ชื่อโฟลเดอร์หรือ path สำรอง</Label>
              <Input
                id="backupDriveFolder"
                name="driveFolder"
                defaultValue={googleDrive.folder}
                placeholder="SPC-SkillCert-Backups"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                ถ้าเลือก Folder ID ช่องนี้จะเป็นโฟลเดอร์ย่อยภายใน Folder ID นั้น
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backupDriveFolderId">Folder ID ของ Google Drive</Label>
              <Input
                id="backupDriveFolderId"
                name="driveFolderId"
                defaultValue={googleDrive.folderId}
                placeholder="เช่น 1XyfxxxxxxxxxxxxxxxxxxxxxxxxxKHCh"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                คัดลอกจาก URL หลัง /folders/ ใช้เมื่อเลือกโหมด Folder ID เท่านั้น
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="backupRcloneConfig">ตำแหน่งไฟล์ rclone config</Label>
              <Input
                id="backupRcloneConfig"
                name="rcloneConfigPath"
                defaultValue={googleDrive.rcloneConfigPath}
                placeholder="เว้นว่างเพื่อใช้ค่าเริ่มต้นของระบบ"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-4">
            <label className="flex items-start gap-3">
              <input
                name="scheduleEnabled"
                type="checkbox"
                defaultChecked={schedule.enabled}
                className="mt-1"
              />
              <span className="grid gap-1">
                <span className="font-semibold">สำรองอัตโนมัติทุกวัน</span>
                <span className="text-muted-foreground">
                  ตัวตั้งเวลาบนเซิร์ฟเวอร์จะสร้างงานสำรองตามเวลาที่กำหนด
                </span>
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="backupScheduleType">ประเภทสำรอง</Label>
                <select
                  id="backupScheduleType"
                  name="scheduleType"
                  defaultValue={schedule.type}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="database">ฐานข้อมูล</option>
                  <option value="files">ไฟล์อัปโหลด</option>
                  <option value="full">สำรองครบชุด</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="backupScheduleTime">เวลา</Label>
                <Input
                  id="backupScheduleTime"
                  name="scheduleTime"
                  type="time"
                  defaultValue={schedule.time}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <Clock className="size-4" />
              <span>รันล่าสุดโดยระบบอัตโนมัติ: {schedule.lastRunDate ?? "-"}</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Button type="submit" name="intent" value="test" className="w-full whitespace-normal">
              <UploadCloud className="size-4" />
              บันทึกและทดสอบ Google Drive
            </Button>
            <Button
              type="submit"
              name="intent"
              value="save"
              variant="outline"
              className="w-full whitespace-normal bg-background/80"
            >
              <Save className="size-4" />
              บันทึกอย่างเดียว
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              การทดสอบจะอัปโหลดไฟล์ข้อความขนาดเล็กไปยังปลายทาง แล้วลบไฟล์ทดสอบออกทันที
            </p>
          </div>
        </form>

        <div className="grid gap-2 rounded-lg border p-4">
          <p className="font-semibold">ที่เก็บสำรองในเซิร์ฟเวอร์</p>
          <p className="break-all text-muted-foreground">{data.backupRoot}</p>
        </div>
        <div className="grid gap-2 rounded-lg border p-4">
          <p className="font-semibold">โฟลเดอร์ไฟล์อัปโหลด</p>
          <p className="break-all text-muted-foreground">{data.uploadRoot}</p>
          <Badge variant={data.uploadRootExists ? "default" : "destructive"} className="mt-1">
            {data.uploadRootExists ? "พบโฟลเดอร์แล้ว" : "ยังไม่พบโฟลเดอร์"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function BackupJobItem({ job }: { job: BackupJob }) {
  return (
    <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{typeLabels[job.type]} #{job.id}</Badge>
          <Badge variant={statusVariant(job.status)}>{statusLabels[job.status]}</Badge>
          <Badge variant={cloudStatusVariant(job.cloudStatus)}>
            Google Drive: {cloudStatusLabels[job.cloudStatus]}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatBytes(job.fileSize)}</span>
          <span className="text-xs text-muted-foreground">{job.createdAt}</span>
        </div>

        <p className="mt-2 truncate font-medium">{job.fileName ?? "-"}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>ใช้เวลา {formatDuration(job.durationSeconds)}</span>
          <span>ผู้สั่งงาน {job.createdByName ?? "-"}</span>
          {job.checksumSha256 && (
            <span className="inline-block max-w-full truncate sm:max-w-[24rem]">
              SHA256: {job.checksumSha256}
            </span>
          )}
        </div>
        {job.status === "running" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" />
            กำลังสร้างไฟล์
          </p>
        )}
        {job.status === "success" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3" />
            ตรวจสอบ checksum แล้ว
          </p>
        )}
        {job.errorMessage && (
          <p className="mt-2 line-clamp-2 text-xs text-destructive">{job.errorMessage}</p>
        )}
        {job.cloudPath && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{job.cloudPath}</p>
        )}
        {job.cloudError && (
          <p className="mt-1 line-clamp-2 text-xs text-destructive">{job.cloudError}</p>
        )}
      </div>

      <div className="flex justify-start md:justify-end">
        {job.downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={job.downloadUrl}>
              <Download className="size-4" />
              ดาวน์โหลด
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่มีไฟล์</span>
        )}
      </div>
    </div>
  );
}
