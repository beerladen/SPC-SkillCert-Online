import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getBackupDownloadRecord } from "@/lib/backup-download-repositories";

export const dynamic = "force-dynamic";

function safeDownloadName(fileName: string) {
  return fileName.replace(/["\r\n]/g, "_");
}

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

  const backup = await getBackupDownloadRecord(jobId);
  if (!backup) {
    return NextResponse.json({ error: "Backup file not found." }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(backup.path)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${safeDownloadName(backup.fileName)}"`,
      "content-length": String(backup.fileSize),
      "content-type": "application/gzip",
    },
  });
}
