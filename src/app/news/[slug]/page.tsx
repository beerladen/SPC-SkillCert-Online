import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye, ExternalLink, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  getPublicAnnouncementBySlug,
  incrementAnnouncementViewCount,
} from "@/lib/announcement-repositories";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  general: "ทั่วไป",
  registration: "เปิดรับสมัคร",
  course: "หลักสูตร",
  certificate: "ใบประกาศ",
  event: "กิจกรรม",
};

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const announcement = await getPublicAnnouncementBySlug(slug);
  if (!announcement) notFound();

  await incrementAnnouncementViewCount(announcement.id).catch(() => {});
  const content = announcement.content || announcement.summary;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-background">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <Button asChild variant="ghost" className="-ml-3 mb-4">
              <Link href="/news">
                <ArrowLeft data-icon="inline-start" />
                กลับไปข่าวทั้งหมด
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{categoryLabels[announcement.category] ?? announcement.category}</Badge>
              {announcement.isFeatured && <Badge variant="secondary">ข่าวเด่น</Badge>}
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <CalendarDays className="size-4" />
                {announcement.publishedDateTime}
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="size-4" />
                {formatNumber(announcement.viewCount + 1)} ครั้ง
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight tracking-normal md:text-4xl">
              {announcement.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              {announcement.summary}
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border bg-secondary shadow-sm">
            <Image
              src={announcement.coverImageUrl}
              alt={announcement.title}
              fill
              priority
              sizes="(min-width: 1024px) 960px, 100vw"
              className="object-cover"
            />
          </div>

          <Card>
            <CardContent className="grid gap-5 p-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Megaphone className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">รายละเอียดข่าวประชาสัมพันธ์</p>
                  <p className="text-sm text-muted-foreground">เผยแพร่โดยศูนย์อบรมวิชาชีพระยะสั้นออนไลน์</p>
                </div>
              </div>

              <article className="prose prose-slate max-w-none whitespace-pre-line text-base leading-8">
                {content}
              </article>

              {(announcement.ctaLabel && announcement.ctaUrl) || announcement.courseTitle ? (
                <div className="flex flex-col gap-3 rounded-lg border bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {announcement.courseTitle ?? "ดำเนินการต่อ"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      คลิกเพื่อดูข้อมูลเพิ่มเติมหรือเข้าสู่หน้าที่เกี่ยวข้อง
                    </p>
                  </div>
                  {announcement.ctaLabel && announcement.ctaUrl && (
                    <Button asChild className="w-fit">
                      <Link href={announcement.ctaUrl}>
                        {announcement.ctaLabel}
                        <ExternalLink data-icon="inline-end" />
                      </Link>
                    </Button>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
