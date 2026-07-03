import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificatePrintButton } from "@/components/certificates/certificate-print-button";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCertificateObjectDefinitionsForDocument,
  getCertificateObjectElementStyle,
  certificateTextElementDefinitions,
  getCertificateTextElementStyle,
  getCertificateTextElementText,
  type CertificateObjectElementLayout,
} from "@/lib/certificate-layout";
import { verifyCertificate } from "@/lib/certificate-repositories";
import { certificateStatusLabel } from "@/lib/certificate-status";
import { createQrCodeDataUrl } from "@/lib/qr-code";

export const dynamic = "force-dynamic";

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
}

function SignatureBlock({
  signatureUrl,
  name,
  position,
  label,
  layout,
}: {
  signatureUrl: string | null;
  name: string;
  position: string;
  label: string;
  layout: CertificateObjectElementLayout;
}) {
  return (
    <div className="text-center" style={{ color: layout.color }}>
      <div className="mx-auto mb-1 flex w-[80%] items-end justify-center" style={{ height: `${layout.signatureHeight}px` }}>
        {signatureUrl && (
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${signatureUrl})` }}
            aria-label={label}
          />
        )}
      </div>
      <div className="mx-auto mb-2 h-px bg-[#8a651d]" style={{ width: `${layout.lineWidth}%` }} />
      {name ? (
        <p className="font-bold leading-tight" style={{ fontSize: `${layout.nameFontSize}px` }}>
          ({name})
        </p>
      ) : (
        <p className="font-bold leading-tight" style={{ fontSize: `${layout.nameFontSize}px` }}>
          (................................)
        </p>
      )}
      <p className="mt-1 font-medium leading-tight" style={{ fontSize: `${layout.positionFontSize}px` }}>
        {position}
      </p>
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

  const verificationUrl = `${appBaseUrl()}/verify-certificate?certificateNo=${encodeURIComponent(
    certificate.certificateNo,
  )}`;
  const qrCodeUrl = await createQrCodeDataUrl(verificationUrl, 132);
  const crispTextShadow = "0 1px 0 rgba(255,255,255,0.95), 0 0 1px rgba(255,255,255,0.8)";
  const certificateFont =
    "var(--font-noto-sans-thai), 'Noto Sans Thai', 'Sarabun', 'Tahoma', system-ui, sans-serif";
  const certificateTextValues = {
    certificateNo: certificate.certificateNo,
    issuerName: certificate.issuerName,
    learnerName: certificate.learnerName,
    courseTitle: certificate.courseTitle,
    issuedAt: certificate.issuedAt,
  };
  const objectDefinitions = getCertificateObjectDefinitionsForDocument(certificate.documentType);
  const documentObjects = certificate.layoutConfig.objects[certificate.documentType];

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
            {certificateTextElementDefinitions.map((definition) => {
              const element = certificate.layoutConfig.elements[definition.key];
              const text = getCertificateTextElementText(
                definition.key,
                certificate.documentType,
                certificateTextValues,
                certificate.layoutConfig,
              );

              return (
                <div
                  key={definition.key}
                  className="absolute whitespace-pre-line break-words"
                  style={{
                    ...getCertificateTextElementStyle(element),
                    overflowWrap: "anywhere",
                    textShadow: crispTextShadow,
                  }}
                >
                  {text}
                </div>
              );
            })}

            {objectDefinitions.map((definition) => {
              const element = documentObjects[definition.key];

              if (definition.kind === "qr") {
                return (
                  <div
                    key={definition.key}
                    className="absolute grid justify-items-center gap-1 rounded-md bg-white/86 p-3 shadow-sm backdrop-blur-sm"
                    style={getCertificateObjectElementStyle(element)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt="QR ตรวจสอบใบประกาศออนไลน์"
                      style={{ width: `${element.qrSize}px`, height: `${element.qrSize}px` }}
                    />
                    <p className="font-semibold" style={{ color: element.color, fontSize: `${element.labelFontSize}px` }}>
                      ตรวจสอบออนไลน์
                    </p>
                  </div>
                );
              }

              const signer =
                definition.key === "registrarSigner"
                  ? {
                      signatureUrl: certificate.registrarSignatureUrl,
                      name: certificate.registrarName,
                      position: certificate.registrarPosition,
                      label: "ลายเซ็นต์นายทะเบียน",
                    }
                  : {
                      signatureUrl: certificate.directorSignatureUrl,
                      name: certificate.directorName,
                      position: certificate.directorPosition,
                      label: "ลายเซ็นต์ผู้อำนวยการ",
                    };

              return (
                <div key={definition.key} className="absolute" style={getCertificateObjectElementStyle(element)}>
                  <SignatureBlock
                    signatureUrl={signer.signatureUrl}
                    name={signer.name}
                    position={signer.position}
                    label={signer.label}
                    layout={element}
                  />
                </div>
              );
            })}
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
