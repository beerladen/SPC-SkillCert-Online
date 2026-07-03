/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, QrCode, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  certificateApprovalStatusLabel,
  certificateApprovalStepStatusLabel,
  formatCertificateReportDuration,
  type CertificateApprovalReportDetail,
} from "@/lib/certificate-approval-repositories";
import { createQrCodeDataUrl } from "@/lib/qr-code";

interface CertificateApprovalReportDocumentProps {
  detail: CertificateApprovalReportDetail;
  baseUrl: string;
  showApprovalLinks?: boolean;
}

function stepVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "approved") return "default";
  if (status === "returned") return "destructive";
  return "secondary";
}

function stepIcon(status: string) {
  if (status === "approved") return <CheckCircle2 className="size-4" />;
  if (status === "returned") return <RotateCcw className="size-4" />;
  return <Clock className="size-4" />;
}

function formatScore(value: number | null) {
  if (value === null) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function stepDecisionLabel(stepKey: string) {
  if (stepKey === "academic") return "เห็นชอบ";
  if (stepKey === "registrar") return "ตรวจสอบถูกต้อง";
  return "อนุมัติ";
}

function documentTypeLabel(documentType: string) {
  return documentType === "certificate" ? "ใบประกาศนียบัตร" : "เกียรติบัตร";
}

export async function CertificateApprovalReportDocument({
  detail,
  baseUrl,
  showApprovalLinks = true,
}: CertificateApprovalReportDocumentProps) {
  const reportUrl = `${baseUrl}/certificate-approval/${encodeURIComponent(
    detail.report.verificationToken,
  )}`;
  const reportDocumentLabel = documentTypeLabel(detail.report.documentType);
  const reportQr = await createQrCodeDataUrl(reportUrl, 176);
  const stepQrs = await Promise.all(
    detail.steps.map(async (step) => ({
      stepKey: step.stepKey,
      url: `${baseUrl}/certificate-approval/${encodeURIComponent(step.token)}`,
      qr: await createQrCodeDataUrl(`${baseUrl}/certificate-approval/${encodeURIComponent(step.token)}`, 132),
    })),
  );

  return (
    <div className="grid gap-5">
      <section className="memo-sheet mx-auto w-full max-w-[210mm] bg-white p-8 text-[#111827] shadow-sm ring-1 ring-border print:shadow-none print:ring-0">
        <div className="grid grid-cols-[96px_1fr_118px] items-start gap-4">
          <div className="pt-2">
            <img
              src="/images/garuda-memo.webp"
              alt="ตราครุฑ"
              className="h-[1.5cm] w-[1.5cm] object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="pt-7 text-center text-3xl font-bold tracking-wide">บันทึกข้อความ</h1>
          </div>
          <div className="w-[118px] shrink-0 rounded-md border p-2 text-center text-[10px] leading-4">
            <img src={reportQr} alt="QR ตรวจสอบรายงาน" className="mx-auto size-[86px]" />
            <p className="mt-1 font-semibold">QR ตรวจสอบรายงาน</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-[15px] leading-7">
              <div className="flex border-b border-slate-300 pb-1">
                <span className="w-24 shrink-0 font-bold">ส่วนราชการ</span>
                <span>ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ วิทยาลัยสารพัดช่างสุรินทร์</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex border-b border-slate-300 pb-1">
                  <span className="w-10 shrink-0 font-bold">ที่</span>
                  <span>{detail.report.reportNo}</span>
                </div>
                <div className="flex border-b border-slate-300 pb-1">
                  <span className="w-14 shrink-0 font-bold">วันที่</span>
                  <span>{detail.report.createdAt}</span>
                </div>
              </div>
              <div className="flex border-b border-slate-300 pb-1">
                <span className="w-16 shrink-0 font-bold">เรื่อง</span>
                <span>ขอเสนออนุมัติออก{reportDocumentLabel}ผู้ผ่านการอบรม</span>
              </div>
              <div className="flex border-b border-slate-300 pb-1">
                <span className="w-16 shrink-0 font-bold">เรียน</span>
                <span>ผู้อำนวยการวิทยาลัยสารพัดช่างสุรินทร์</span>
              </div>
        </div>

        <div className="mt-8 space-y-4 text-[16px] leading-8">
          <p className="indent-12">
            ด้วยศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ ได้ดำเนินการจัดอบรมหลักสูตร{" "}
            <span className="font-bold">“{detail.report.courseTitle}”</span>{" "}
            รูปแบบออนไลน์ จำนวน {formatCertificateReportDuration(detail.report.durationMinutes)}
            โดยมีผู้เข้าอบรมผ่านเกณฑ์ตามที่หลักสูตรกำหนด จำนวน{" "}
            <span className="font-bold">{detail.report.totalLearners}</span> คน
          </p>
          <p className="indent-12">
            หลักสูตรดังกล่าวมีการเรียนผ่านบทเรียนออนไลน์ แบบทดสอบหลังเรียน
            แบบฝึกปฏิบัติ/ใบงาน และการตรวจประเมินผลจากครูผู้สอนครบถ้วนแล้ว
            จึงขอเสนอรายชื่อผู้ผ่านการอบรมเพื่อพิจารณาออก{reportDocumentLabel}
            ตามรายชื่อแนบท้ายบันทึกข้อความนี้
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b">
                <td className="w-40 bg-slate-50 px-3 py-2 font-semibold">หลักสูตร</td>
                <td className="px-3 py-2">{detail.report.courseTitle}</td>
              </tr>
              <tr className="border-b">
                <td className="bg-slate-50 px-3 py-2 font-semibold">ประเภทเอกสาร</td>
                <td className="px-3 py-2">{reportDocumentLabel}</td>
              </tr>
              <tr className="border-b">
                <td className="bg-slate-50 px-3 py-2 font-semibold">จำนวนชั่วโมง</td>
                <td className="px-3 py-2">
                  {formatCertificateReportDuration(detail.report.durationMinutes)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="bg-slate-50 px-3 py-2 font-semibold">เจ้าของหลักสูตร</td>
                <td className="px-3 py-2">{detail.report.ownerName ?? "-"}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 px-3 py-2 font-semibold">เกณฑ์ผ่าน</td>
                <td className="px-3 py-2">{detail.report.criteriaSummary}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-[16px] leading-8 indent-12">จึงเรียนมาเพื่อโปรดพิจารณา</p>

        <div className="mt-6 grid grid-cols-2 gap-6 text-center text-sm">
          <div />
          <div className="space-y-2">
            <div className="h-12" />
            <p>ลงชื่อ ...........................................................</p>
            <p>({detail.report.ownerName ?? "เจ้าของหลักสูตร"})</p>
            <p>เจ้าของหลักสูตร / ผู้เสนอรายงาน</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          {detail.steps.map((step) => (
            <div key={step.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {step.sortOrder}. {step.roleLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.actedName
                      ? `${step.actedName} / ${step.actedAt ?? "-"}`
                      : "ยังไม่ดำเนินการ"}
                  </p>
                </div>
                <Badge variant={stepVariant(step.status)}>
                  {stepIcon(step.status)}
                  {certificateApprovalStepStatusLabel(step.status)}
                </Badge>
              </div>
              {step.note && <p className="mt-2 text-sm text-muted-foreground">หมายเหตุ: {step.note}</p>}
              <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm md:grid-cols-[1fr_220px]">
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-5">
                    <span className="inline-flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded border border-slate-400 bg-white text-[13px] font-bold text-emerald-700">
                        {step.status === "approved" ? "✓" : ""}
                      </span>
                      {stepDecisionLabel(step.stepKey)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded border border-slate-400 bg-white text-[13px] font-bold text-red-700">
                        {step.status === "returned" ? "✓" : ""}
                      </span>
                      ส่งกลับแก้ไข
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {step.actedAt ? `ดำเนินการเมื่อ ${step.actedAt}` : "รอการดำเนินการตามลำดับ"}
                  </p>
                </div>

                <div className="text-center">
                  {step.status === "approved" && step.signatureUrl ? (
                    <img
                      src={step.signatureUrl}
                      alt={`ลายเซ็นต์${step.roleLabel}`}
                      className="mx-auto h-12 max-w-[190px] object-contain"
                    />
                  ) : (
                    <div className="mx-auto h-12 max-w-[190px] border-b border-slate-400" />
                  )}
                  <p className="mt-1 font-medium">
                    ({step.signerName || step.actedName || "................................"})
                  </p>
                  <p className="text-muted-foreground">{step.signerPosition || step.roleLabel}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showApprovalLinks && (
        <section className="mx-auto grid w-full max-w-[210mm] gap-3 rounded-lg border bg-card p-4 print:hidden">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <h2 className="font-semibold">ลิงก์และ QR สำหรับอนุมัติตามลำดับ</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {detail.steps.map((step) => {
              const qr = stepQrs.find((item) => item.stepKey === step.stepKey);
              return (
                <div key={step.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{step.roleLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {certificateApprovalStepStatusLabel(step.status)}
                      </p>
                    </div>
                    <Badge variant={stepVariant(step.status)}>{step.sortOrder}</Badge>
                  </div>
                  {qr && <img src={qr.qr} alt={`QR ${step.roleLabel}`} className="mx-auto my-3 size-28" />}
                  {qr && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={qr.url} target="_blank">
                        <ExternalLink className="size-4" />
                        เปิดลิงก์
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="memo-sheet mx-auto w-full max-w-[210mm] bg-white p-8 text-[#111827] shadow-sm ring-1 ring-border print:break-before-page print:shadow-none print:ring-0">
        <div className="flex items-start justify-between gap-6 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold">รายงานสรุปรายชื่อผู้ผ่านการอบรม</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              แนบท้ายบันทึกข้อความเลขที่ {detail.report.reportNo}
            </p>
            <p className="mt-1 font-semibold">{detail.report.courseTitle}</p>
          </div>
          <div className="text-right text-sm">
            <p>รวม {detail.items.length} คน</p>
            <p className="text-muted-foreground">{certificateApprovalStatusLabel(detail.report.status)}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-2 py-2 text-left">ลำดับ</th>
                <th className="border-b px-2 py-2 text-left">ชื่อ-นามสกุล</th>
                <th className="border-b px-2 py-2 text-left">เลขลงทะเบียน</th>
                <th className="border-b px-2 py-2 text-right">เรียนครบ</th>
                <th className="border-b px-2 py-2 text-right">หลังเรียน</th>
                <th className="border-b px-2 py-2 text-center">ใบงาน/แบบฝึก</th>
                <th className="border-b px-2 py-2 text-center">ผลประเมิน</th>
                <th className="border-b px-2 py-2 text-left">ใบประกาศ</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-2 py-2">{item.sortOrder}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium">{item.learnerName}</p>
                    <p className="text-[10px] text-muted-foreground">{item.learnerEmail ?? "-"}</p>
                  </td>
                  <td className="px-2 py-2">{item.registrationNo ?? "-"}</td>
                  <td className="px-2 py-2 text-right">{item.progressPercent}%</td>
                  <td className="px-2 py-2 text-right">{formatScore(item.postTestScore)}</td>
                  <td className="px-2 py-2 text-center">
                    ผ่าน {item.passedTasks}/{item.totalTasks}
                  </td>
                  <td className="px-2 py-2 text-center">ผ่าน</td>
                  <td className="px-2 py-2">{item.certificateNo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-sm">
          รวมผู้ผ่านการอบรมทั้งหมด {detail.items.length} คน ตรวจสอบจากระบบ SPC SkillCert Online
          ตามเลขที่รายงาน {detail.report.reportNo}
        </p>
      </section>

      <style>
        {`
          @media print {
            body {
              background: white !important;
            }
            .memo-sheet {
              width: 210mm;
              min-height: 297mm;
              box-shadow: none !important;
              border: 0 !important;
            }
          }
        `}
      </style>
    </div>
  );
}
