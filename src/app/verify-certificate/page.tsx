import Link from "next/link";
import { Award, CheckCircle2, QrCode, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { searchCertificates } from "@/lib/certificate-repositories";
import { certificateStatusLabel } from "@/lib/certificate-status";

export const dynamic = "force-dynamic";

export default async function VerifyCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ certificateNo?: string; q?: string; query?: string }>;
}) {
  const { certificateNo = "", q = "", query: queryAlias = "" } = await searchParams;
  const query = (q || certificateNo || queryAlias).trim();
  const certificates = query ? await searchCertificates(query) : [];
  const searched = query.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <section className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold">ตรวจสอบใบประกาศนียบัตร</h1>
            <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
              ค้นหาด้วยเลขใบประกาศ ชื่อ-นามสกุล อีเมล หรือเบอร์โทร เพื่อดูใบประกาศทั้งหมดที่เกี่ยวข้อง
            </p>
          </div>

          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <form className="contents">
                <div className="flex items-center gap-2 rounded-md border px-3">
                  <Search className="size-4 text-muted-foreground" />
                  <Input
                    name="q"
                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                    placeholder="เช่น SPC-CERT-2569-00021, สมชาย, learner@email.com, 08xxxxxxxx"
                    defaultValue={query}
                  />
                </div>
                <Button type="submit">ตรวจสอบ</Button>
              </form>
            </CardContent>
          </Card>

          {searched && certificates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-primary" />
                  พบข้อมูลใบประกาศนียบัตร {certificates.length} รายการ
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {certificates.map((certificate) => (
                  <div
                    key={certificate.certificateNo}
                    className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-[96px_1fr_auto] md:items-center"
                  >
                    <div className="flex aspect-square items-center justify-center rounded-lg border bg-secondary">
                      <QrCode className="size-12 text-primary" />
                    </div>
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="w-fit">
                          {certificate.status === "issued" ? "สถานะถูกต้อง" : certificateStatusLabel(certificate.status)}
                        </Badge>
                        <span className="text-sm font-semibold">{certificate.certificateNo}</span>
                      </div>
                      <div>
                        <p className="text-lg font-bold leading-7">{certificate.learnerName}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {certificate.learnerEmail}
                          {certificate.learnerPhone ? ` • ${certificate.learnerPhone}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold leading-6">{certificate.courseTitle}</p>
                      <p className="text-sm text-muted-foreground">ออกเมื่อ {certificate.issuedAt}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:flex-col">
                      <Button asChild>
                        <Link href={certificate.pdfUrl ?? `/certificates/${certificate.certificateNo}`}>
                          ดูใบประกาศ
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/verify-certificate?certificateNo=${encodeURIComponent(certificate.certificateNo)}`}>
                          ตรวจใบนี้
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {searched && certificates.length === 0 && (
            <Card>
              <CardContent className="flex items-center gap-3 p-5 text-destructive">
                <XCircle className="size-5" />
                ไม่พบใบประกาศที่ตรงกับคำค้นหานี้ในระบบ
              </CardContent>
            </Card>
          )}
        </section>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="size-5 text-primary" />
                การตรวจสอบเอกสาร
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
              <p>
                ใบประกาศนียบัตรทุกใบมีเลขอ้างอิงเฉพาะ สามารถตรวจสอบชื่อผู้เข้าอบรม
                ชื่อหลักสูตร วันที่ออก และสถานะเอกสารได้จากระบบ
              </p>
              <p>
                หากผู้เข้าอบรมมีหลายใบ สามารถค้นหาด้วยชื่อ อีเมล หรือเบอร์โทรเพื่อแสดงใบประกาศทั้งหมดได้
              </p>
              <p>
                หากสถานะเป็นยกเลิกหรือไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่ศูนย์อบรมเพื่อตรวจสอบเพิ่มเติม
              </p>
            </CardContent>
          </Card>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
