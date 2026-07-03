import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificatePrintButton } from "@/components/certificates/certificate-print-button";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { verifyCertificate } from "@/lib/certificate-repositories";
import { certificateStatusLabel } from "@/lib/certificate-status";
import { createQrCodeDataUrl } from "@/lib/qr-code";

export const dynamic = "force-dynamic";

function fittedTextSize(text: string, sizes: { short: number; medium: number; long: number }) {
  const length = Array.from(text).length;
  if (length > 42) return sizes.long;
  if (length > 28) return sizes.medium;
  return sizes.short;
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
}

function SignatureBlock({
  signatureUrl,
  name,
  position,
  label,
}: {
  signatureUrl: string | null;
  name: string;
  position: string;
  label: string;
}) {
  return (
    <div className="text-center text-[#061426]">
      <div className="mx-auto mb-1 flex h-[58px] w-[80%] items-end justify-center">
        {signatureUrl && (
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${signatureUrl})` }}
            aria-label={label}
          />
        )}
      </div>
      <div className="mx-auto mb-2 h-px w-[74%] bg-[#8a651d]" />
      {name ? (
        <p className="text-[17px] font-bold leading-tight">({name})</p>
      ) : (
        <p className="text-[17px] font-bold leading-tight">(................................)</p>
      )}
      <p className="mt-1 text-[16px] font-medium leading-tight">{position}</p>
    </div>
  );
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ certificateNo: string }>;
}) {
  const { certificateNo } = await params;
  const certificate = await verifyCertificate(decodeURIComponent(certificateNo));
  if (!certificate) notFound();

  const learnerFontSize = fittedTextSize(certificate.learnerName, {
    short: 45,
    medium: 41,
    long: 37,
  });
  const courseFontSize = fittedTextSize(certificate.courseTitle, {
    short: 22,
    medium: 20,
    long: 18,
  });
  const verificationUrl = `${appBaseUrl()}/verify-certificate?certificateNo=${encodeURIComponent(
    certificate.certificateNo,
  )}`;
  const qrCodeUrl = await createQrCodeDataUrl(verificationUrl, 132);
  const isFormalCertificate = certificate.documentType === "certificate";
  const documentTitle = isFormalCertificate ? "ประกาศนียบัตรวิชาชีพเฉพาะ" : "เกียรติบัตร";
  const completionText = isFormalCertificate ? "สำเร็จการศึกษาหลักสูตรวิชา" : "ผ่านการอบรมหลักสูตร";
  const crispTextShadow = "0 1px 0 rgba(255,255,255,0.95), 0 0 1px rgba(255,255,255,0.8)";
  const certificateFont =
    "var(--font-noto-sans-thai), 'Noto Sans Thai', 'Sarabun', 'Tahoma', system-ui, sans-serif";

  return (
    <div className="min-h-screen bg-[#f3fbfb]">
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/verify-certificate?certificateNo=${encodeURIComponent(certificate.certificateNo)}`}>
                ตรวจสอบใบประกาศ
              </Link>
            </Button>
            <CertificatePrintButton />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={certificate.status === "issued" ? "default" : "secondary"}>
              {certificate.status === "issued" ? "สถานะถูกต้อง" : certificateStatusLabel(certificate.status)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              ใช้คำสั่งพิมพ์ของเบราว์เซอร์เพื่อบันทึกเป็น PDF ขนาด A4 แนวนอน
            </p>
          </div>
        </div>

        <section className="mx-auto w-full max-w-[1124px] overflow-x-auto pb-2 print:max-w-none print:overflow-visible print:pb-0">
          <div
            className="certificate-sheet relative aspect-[1.4137/1] w-[1124px] max-w-none overflow-hidden rounded-lg bg-white bg-cover bg-center shadow-xl ring-1 ring-border print:rounded-none print:shadow-none print:ring-0"
            style={{
              backgroundImage: `url(${certificate.backgroundUrl})`,
              fontFamily: certificateFont,
            }}
          >
            <div className="absolute left-1/2 top-[26.5%] w-[68%] -translate-x-1/2 text-center text-[#0b1638]">
              <p className="text-[38px] font-bold leading-tight" style={{ textShadow: crispTextShadow }}>
                {certificate.issuerName}
              </p>
              <p className="mt-2 text-[27px] font-semibold leading-tight text-[#0b1638]">
                {documentTitle}
              </p>
              <p className="mt-3 text-[20px] font-medium leading-tight text-[#1f2a44]">
                ฉบับนี้ให้ไว้เพื่อแสดงว่า
              </p>
            </div>

            <div className="absolute left-1/2 top-[43.5%] w-[72%] -translate-x-1/2 text-center">
              <p
                className="break-words font-extrabold text-[#0b1638]"
                style={{
                  fontSize: learnerFontSize,
                  lineHeight: 1.16,
                  overflowWrap: "anywhere",
                  textShadow: crispTextShadow,
                }}
              >
                {certificate.learnerName}
              </p>
            </div>

            <div className="absolute left-1/2 top-[55.5%] w-[70%] -translate-x-1/2 text-center text-[#0b1638]">
              <p className="text-[19px] font-medium leading-tight">{completionText}</p>
              <p
                className="mt-1 break-words font-semibold text-[#0b1638]"
                style={{
                  fontSize: courseFontSize,
                  lineHeight: 1.25,
                  overflowWrap: "anywhere",
                  textShadow: crispTextShadow,
                }}
              >
                {certificate.courseTitle}
              </p>
              <p className="mt-3 text-[19px] font-medium leading-tight text-[#1f2a44]">
                เมื่อวันที่ {certificate.issuedAt}
              </p>
              <p className="mt-3 text-[18px] font-medium leading-tight text-[#1f2a44]">
                ขอให้มีความสุขสวัสดีวัฒนา
              </p>
            </div>

            {isFormalCertificate ? (
              <>
                <div className="absolute left-[22%] top-[74.5%] w-[28%]">
                  <SignatureBlock
                    signatureUrl={certificate.registrarSignatureUrl}
                    name={certificate.registrarName}
                    position={certificate.registrarPosition}
                    label="ลายเซ็นต์นายทะเบียน"
                  />
                </div>
                <div className="absolute left-[58%] top-[74.5%] w-[28%]">
                  <SignatureBlock
                    signatureUrl={certificate.directorSignatureUrl}
                    name={certificate.directorName}
                    position={certificate.directorPosition}
                    label="ลายเซ็นต์ผู้อำนวยการ"
                  />
                </div>
              </>
            ) : (
              <div className="absolute left-1/2 top-[74.5%] w-[38%] -translate-x-1/2">
                <SignatureBlock
                  signatureUrl={certificate.directorSignatureUrl}
                  name={certificate.directorName}
                  position={certificate.directorPosition}
                  label="ลายเซ็นต์ผู้อำนวยการ"
                />
              </div>
            )}

            <div className="absolute left-[8.5%] top-[84.5%] rounded-md bg-white/86 px-4 py-3 text-[#061426] shadow-sm backdrop-blur-sm">
              <p className="text-[12px] font-semibold text-[#111827]">เลขที่ใบประกาศ</p>
              <p className="font-mono text-[15px] font-bold">{certificate.certificateNo}</p>
            </div>

            <div className="absolute right-[8.5%] top-[80.5%] grid justify-items-center gap-1 rounded-md bg-white/86 p-3 text-[#061426] shadow-sm backdrop-blur-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR ตรวจสอบใบประกาศออนไลน์" className="size-[78px]" />
              <p className="text-[12px] font-semibold">ตรวจสอบออนไลน์</p>
            </div>
          </div>
        </section>
      </main>

      <div className="print:hidden">
        <SiteFooter />
      </div>

      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }

        .certificate-sheet {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media print {
          html,
          body {
            width: 297mm;
            height: 210mm;
            background: #fff !important;
          }

          .certificate-sheet {
            width: 297mm;
            height: 210mm;
          }
        }
      `}</style>
    </div>
  );
}
