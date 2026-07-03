import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicAnnouncement } from "@/lib/public-repositories";
import { formatNumber } from "@/lib/format";

const categoryLabels: Record<string, string> = {
  registration: "เปิดรับสมัคร",
  course: "หลักสูตร",
  certificate: "ใบประกาศ",
  event: "กิจกรรม",
  general: "ทั่วไป",
};

function categoryLabel(value: string) {
  return categoryLabels[value] ?? value;
}

export function HomeAnnouncementsSection({
  announcements,
}: {
  announcements: PublicAnnouncement[];
}) {
  if (announcements.length === 0) return null;

  const [featured, ...secondary] = announcements;
  const secondaryItems = secondary.slice(0, 4);

  return (
    <section className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold">ข่าวประชาสัมพันธ์</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              ประกาศจากศูนย์อบรม กำหนดการรับสมัคร และข่าวสารสำคัญสำหรับผู้เข้าอบรม
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/news">
              ดูข่าวทั้งหมด
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <Link
            href={`/news/${featured.slug}`}
            className="group self-start overflow-hidden rounded-lg border bg-card shadow-sm transition hover:border-primary/50 hover:shadow-md"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
              <Image
                src={featured.coverImageUrl}
                alt={featured.title}
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover transition duration-300 group-hover:scale-[1.03]"
                priority
              />
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <Badge>{categoryLabel(featured.category)}</Badge>
                {featured.isFeatured && <Badge variant="secondary">ข่าวเด่น</Badge>}
              </div>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {featured.publishedDate}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" />
                  {formatNumber(featured.viewCount)} ครั้ง
                </span>
              </div>
              <h3 className="line-clamp-2 text-xl font-bold leading-7">{featured.title}</h3>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {featured.summary}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                อ่านรายละเอียด
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2">
            {secondaryItems.map((announcement) => (
              <Card
                key={announcement.id}
                className="overflow-hidden py-0 transition hover:border-primary/50"
              >
                <CardContent className="grid gap-3 p-3">
                  <Link
                    href={`/news/${announcement.slug}`}
                    className="relative aspect-[16/9] overflow-hidden rounded-md bg-secondary"
                  >
                    <Image
                      src={announcement.coverImageUrl}
                      alt={announcement.title}
                      fill
                      sizes="(min-width: 1024px) 240px, (min-width: 640px) 45vw, 100vw"
                      className="object-cover transition duration-300 hover:scale-[1.03]"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-col justify-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-fit">
                        {categoryLabel(announcement.category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {announcement.publishedDate}
                      </span>
                    </div>
                    <Link href={`/news/${announcement.slug}`}>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-6 hover:text-primary">
                        {announcement.title}
                      </h3>
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {announcement.summary}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
