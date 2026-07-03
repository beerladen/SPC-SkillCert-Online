/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { actOnCertificateApprovalStepAction } from "@/app/admin/certificates/actions";
import { CertificateApprovalReportDocument } from "@/components/certificates/certificate-approval-report-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  certificateApprovalStatusLabel,
  certificateApprovalStepStatusLabel,
  getCertificateApprovalTokenView,
} from "@/lib/certificate-approval-repositories";

export const dynamic = "force-dynamic";

interface CertificateApprovalTokenPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ updated?: string }>;
}

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "127.0.0.1:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export default async function CertificateApprovalTokenPage({
  params,
  searchParams,
}: CertificateApprovalTokenPageProps) {
  const { token } = await params;
  const { updated } = await searchParams;
  const view = await getCertificateApprovalTokenView(decodeURIComponent(token));

  if (!view) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const currentStep = view.currentStep;
  const canAct = view.tokenKind === "step" && currentStep?.status === "pending";

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto grid max-w-[1120px] gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm print:hidden">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{view.report.reportNo}</Badge>
              <Badge>{certificateApprovalStatusLabel(view.report.status)}</Badge>
            </div>
            <h1 className="text-xl font-semibold">ระบบอนุมัติใบประกาศนียบัตร</h1>
            <p className="mt-1 text-sm text-muted-foreground">{view.report.courseTitle}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              กลับหน้าเว็บไซต์
            </Link>
          </Button>
        </div>

        {updated === "1" && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary print:hidden">
            บันทึกผลการดำเนินการเรียบร้อยแล้ว
          </div>
        )}

        <section className="rounded-lg border bg-card p-5 shadow-sm print:hidden">
          {currentStep ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">ขั้นตอนปัจจุบัน</p>
                  <h2 className="text-lg font-semibold">{currentStep.roleLabel}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    สถานะ: {certificateApprovalStepStatusLabel(currentStep.status)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ผู้ลงนาม: {currentStep.signerName || "-"} / {currentStep.signerPosition || currentStep.roleLabel}
                  </p>
                </div>
                <Badge variant={currentStep.status === "approved" ? "default" : "secondary"}>
                  {certificateApprovalStepStatusLabel(currentStep.status)}
                </Badge>
              </div>

              {currentStep.status === "approved" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-4">
                    <CheckCircle2 className="size-5 text-primary" />
                    <div>
                      <p className="font-semibold">อนุมัติเรียบร้อยแล้ว</p>
                      <p className="text-muted-foreground">
                        ระบบบันทึกผลอนุมัติและแสดงลายเซ็นต์ในรายงานเสนออนุมัติแล้ว
                      </p>
                    </div>
                  </div>
                  {currentStep.signatureUrl && (
                    <img
                      src={currentStep.signatureUrl}
                      alt={`ลายเซ็นต์${currentStep.roleLabel}`}
                      className="mt-3 h-14 max-w-[220px] object-contain"
                    />
                  )}
                </div>
              )}

              {canAct ? (
                <form action={actOnCertificateApprovalStepAction} className="grid gap-4">
                  <input type="hidden" name="token" value={token} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                      ชื่อผู้ดำเนินการ
                      <input
                        name="actorName"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        placeholder="เช่น นายสมชาย ใจดี"
                        defaultValue={currentStep.signerName ?? ""}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      หมายเหตุ
                      <input
                        name="note"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        placeholder="ระบุหมายเหตุเพิ่มเติมถ้ามี"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="decision" value="approve">
                      <CheckCircle2 className="size-4" />
                      อนุมัติ/ผ่านการตรวจสอบ
                    </Button>
                    <Button type="submit" name="decision" value="return" variant="outline">
                      <RotateCcw className="size-4" />
                      ส่งกลับแก้ไข
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  ขั้นตอนนี้ยังไม่เปิดให้ดำเนินการ หรือมีการดำเนินการเรียบร้อยแล้ว
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              ลิงก์นี้เป็นลิงก์ตรวจสอบรายงาน สามารถดูรายละเอียดและรายชื่อผู้ผ่านการอบรมได้
            </div>
          )}
        </section>

        <CertificateApprovalReportDocument detail={view} baseUrl={baseUrl} showApprovalLinks={false} />
      </div>
    </main>
  );
}
