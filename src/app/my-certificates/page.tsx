import Link from "next/link";
import { Clock3, Download, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { requireCurrentUser } from "@/lib/auth";
import {
  certificateApprovalStatusLabel,
  getLearnerCertificateApprovalStatuses,
} from "@/lib/certificate-approval-repositories";
import { getLearnerCertificates } from "@/lib/certificate-repositories";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage() {
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const [certificates, approvalStatuses] = await Promise.all([
    getLearnerCertificates(user.id),
    getLearnerCertificateApprovalStatuses(user.id),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-3xl font-bold">ใบประกาศนียบัตรของฉัน</h1>
          <p className="mt-2 text-muted-foreground">
            ดาวน์โหลดและตรวจสอบใบประกาศนียบัตรที่ได้รับจากการอบรม
          </p>
        </div>

        {approvalStatuses.length > 0 && (
          <section className="grid gap-4">
            <div>
              <h2 className="text-xl font-semibold">สถานะใบประกาศของฉัน</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ติดตามขั้นตอนเสนออนุมัติ ตรวจสอบ และออกใบประกาศนียบัตร
              </p>
            </div>
            <div className="grid gap-3">
              {approvalStatuses.map((item) => (
                <Card key={`${item.reportNo}-${item.courseTitle}`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Clock3 className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.courseTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.reportNo} / เริ่มเสนอเมื่อ {item.createdAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{certificateApprovalStatusLabel(item.status)}</Badge>
                      {item.certificateNo && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/certificates/${encodeURIComponent(item.certificateNo)}`} target="_blank">
                            <Download className="size-4" />
                            ดาวน์โหลด
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {certificates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              ยังไม่มีใบประกาศนียบัตรในบัญชีนี้
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {certificates.map((certificate) => (
              <Card key={certificate.certificateNo}>
                <CardHeader>
                  <CardTitle>{certificate.courseTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[120px_1fr]">
                  <div className="flex aspect-square items-center justify-center rounded-lg border bg-secondary">
                    <QrCode className="size-14 text-primary" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{certificate.certificateNo}</p>
                    <p className="font-semibold">{certificate.learnerName}</p>
                    <p className="text-sm text-muted-foreground">
                      วันที่ออก {certificate.issuedAt}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild disabled={!certificate.pdfUrl}>
                        <Link href={certificate.pdfUrl ?? "#"} target="_blank">
                          <Download data-icon="inline-start" />
                          ดู/ดาวน์โหลด
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/verify-certificate?certificateNo=${encodeURIComponent(certificate.certificateNo)}`}>
                          ตรวจสอบ
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
