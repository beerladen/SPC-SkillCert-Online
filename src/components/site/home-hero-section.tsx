import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicHomeHeroSettings, PublicSiteSettings } from "@/lib/public-repositories";

export function HomeHeroSection({
  hero,
  site,
}: {
  hero: PublicHomeHeroSettings;
  site: PublicSiteSettings;
}) {
  if (!hero.enabled) return null;

  return (
    <section className="border-b bg-background">
      <div className="relative mx-auto max-w-7xl overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="relative min-h-[520px] overflow-hidden rounded-none md:min-h-[390px] lg:min-h-[410px]">
          <Image
            src={hero.imageUrl}
            alt={hero.title || site.name}
            fill
            priority
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            className="object-cover object-[64%_center]"
          />
          <div className="absolute inset-y-0 left-0 w-[82%] bg-gradient-to-r from-background via-background/55 to-transparent sm:w-[68%] lg:w-[52%]" />
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background/75 to-transparent" />

          <div className="relative z-10 flex min-h-[520px] max-w-2xl flex-col justify-center py-10 md:min-h-[390px] lg:min-h-[410px]">
            <div className="flex flex-col gap-3">
              <p className="w-fit rounded-full border bg-card/85 px-3 py-1 text-sm font-semibold text-primary shadow-sm backdrop-blur">
                {hero.subtitle || site.shortName}
              </p>
              <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-tight tracking-normal text-foreground lg:text-[42px]">
                {hero.title || site.name}
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                {hero.description}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-md shadow-primary/20">
                <Link href={hero.primaryUrl || "/courses"}>
                  {hero.primaryLabel || "ดูหลักสูตรที่เปิดรับสมัคร"}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-card/85 backdrop-blur">
                <Link href={hero.secondaryUrl || "/verify-certificate"}>
                  <FileCheck2 data-icon="inline-start" />
                  {hero.secondaryLabel || "ตรวจสอบใบประกาศนียบัตร"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
