import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getReportExportPayload } from "@/lib/admin-summary-repositories";

type ReportPayload = {
  reportType?: string;
  courseRows?: Array<Record<string, unknown>>;
  paymentRows?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
};

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(payload: ReportPayload) {
  if (payload.reportType === "registration_payment") {
    const rows = payload.paymentRows ?? payload.rows ?? [];
    const header = ["status", "payments", "registrations", "amount"];
    return [
      header.join(","),
      ...rows.map((row) => header.map((key) => csvValue(row[key])).join(",")),
    ].join("\r\n");
  }

  const rows = payload.courseRows ?? payload.rows ?? [];
  const header = ["courseTitle", "enrollments", "completed", "revenue", "certificates"];
  return [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvValue(row[key])).join(",")),
  ].join("\r\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);

  const { id } = await params;
  const exportId = Number(id);
  if (!Number.isFinite(exportId) || exportId <= 0) {
    return NextResponse.json({ error: "Invalid report export id." }, { status: 400 });
  }

  const report = await getReportExportPayload(exportId, user);
  if (!report) {
    return NextResponse.json({ error: "Report export not found." }, { status: 404 });
  }

  const payload = report.payload as ReportPayload;
  const csv = toCsv(payload);
  const filename =
    payload.reportType === "registration_payment"
      ? `spc-registration-payment-${report.id}.csv`
      : `spc-course-summary-${report.id}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
