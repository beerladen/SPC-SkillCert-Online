import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Eye, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicAnnouncements } from "@/lib/announcement-repositories";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  general: "ทั่วไป",
  registration: "เปิดรับสมัคร",
  course: "หลักสูตร",
  certificate: "ใบประกาศ",
  event: "กิจกรรม",
};

export default async function NewsPage() {
  const announcements = await getPublicAnnouncements();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-background">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Megaphone className="size-5" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-normal">ข่าวประชาสัมพันธ์</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  ประกาศ กำหนดการรับสมัคร และข่าวสารสำคัญจากศูนย์อบรม
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {announcements.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              ยังไม่มีข่าวประชาสัมพันธ์
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className="overflow-hidden p-0">
                  <Link
                    href={`/news/${announcement.slug}`}
                    className="group relative block aspect-[16/9] overflow-hidden bg-secondary"
                  >
                    <Image
                      src={announcement.coverImageUrl}
                      alt={announcement.title}
                      fill
                      sizes="(min-width: 1280px) 390px, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <Badge>{categoryLabels[announcement.category] ?? announcement.category}</Badge>
                      {announcement.isFeatured && <Badge variant="secondary">ข่าวเด่น</Badge>}
                    </div>
                  </Link>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {announcement.publishedDate}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {formatNumber(announcement.viewCount)} ครั้ง
                      </span>
                    </div>
                    <Link href={`/news/${announcement.slug}`}>
                      <h2 className="line-clamp-2 text-xl font-bold leading-7 hover:text-primary">
                        {announcement.title}
                      </h2>
                    </Link>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {announcement.summary}
                    </p>
                    <Button asChild variant="outline" className="mt-auto w-fit">
                      <Link href={`/news/${announcement.slug}`}>
                        อ่านรายละเอียด
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
