"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";

type BackupStatus = "queued" | "running" | "success" | "failed";

interface BackupStatusPayload {
  id: number;
  status: BackupStatus;
  fileName: string | null;
  downloadUrl: string | null;
  message: string | null;
  errorMessage: string | null;
}

export function BackupAutoDownload({ jobId }: { jobId: number }) {
  const [job, setJob] = useState<BackupStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const response = await fetch(`/admin/backups/${jobId}/status`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("อ่านสถานะงานสำรองไม่ได้");
        }

        const payload = (await response.json()) as BackupStatusPayload;
        if (cancelled) return;

        setJob(payload);
        if (payload.status === "success" && payload.downloadUrl && !downloadedRef.current) {
          downloadedRef.current = true;
          const link = document.createElement("a");
          link.href = payload.downloadUrl;
          link.download = payload.fileName ?? "";
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        }

        if (payload.status === "failed") return;
        timer = setTimeout(poll, 2500);
      } catch (pollError) {
        if (cancelled) return;
        setError(pollError instanceof Error ? pollError.message : "ติดตามสถานะไม่สำเร็จ");
        timer = setTimeout(poll, 5000);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  if (error && !job) {
    return <ActionFeedback variant="error" title="ติดตามสถานะไม่ได้" message={error} />;
  }

  if (job?.status === "success") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">ไฟล์พร้อมแล้ว กำลังดาวน์โหลดลงเครื่อง</p>
            <p className="mt-1 break-all leading-6">{job.fileName ?? "ไฟล์สำรอง"}</p>
          </div>
        </div>
        {job.downloadUrl && (
          <Button asChild variant="outline">
            <a href={job.downloadUrl}>
              <Download className="size-4" />
              ดาวน์โหลดอีกครั้ง
            </a>
          </Button>
        )}
      </div>
    );
  }

  if (job?.status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">สำรองไม่สำเร็จ จึงยังดาวน์โหลดไม่ได้</p>
          <p className="mt-1 leading-6">{job.errorMessage ?? job.message ?? "กรุณาตรวจประวัติงานสำรอง"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
      <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin" />
      <div>
        <p className="font-semibold">กำลังเตรียมไฟล์ดาวน์โหลดลงเครื่อง</p>
        <p className="mt-1 leading-6">
          ระบบจะดาวน์โหลดให้อัตโนมัติเมื่อสำรองเสร็จ สามารถเปิดหน้านี้ค้างไว้ได้
        </p>
      </div>
    </div>
  );
}
