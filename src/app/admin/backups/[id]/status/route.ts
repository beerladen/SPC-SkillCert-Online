import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getBackupJobStatus } from "@/lib/backup-status-repositories";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireCurrentUser(["admin"]);

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Invalid backup id." }, { status: 400 });
  }

  const job = await getBackupJobStatus(jobId);
  if (!job) {
    return NextResponse.json({ error: "Backup job not found." }, { status: 404 });
  }

  return NextResponse.json(job, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
