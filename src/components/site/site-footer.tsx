import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { getPublicSiteSettings } from "@/lib/public-repositories";

export async function SiteFooter() {
  const site = await getPublicSiteSettings();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              SPC
            </span>
            <div>
              <p className="font-semibold">{site.name}</p>
              <p className="text-sm text-muted-foreground">{site.shortName}</p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            ระบบกลางสำหรับลงทะเบียนหลักสูตรวิชาชีพระยะสั้น เรียนออนไลน์ วัดผล
            และออกใบประกาศนียบัตรที่ตรวจสอบได้
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">เมนูหลัก</p>
          <Link href="/courses" className="text-muted-foreground hover:text-foreground">
            หลักสูตรทั้งหมด
          </Link>
          <Link href="/verify-certificate" className="text-muted-foreground hover:text-foreground">
            ตรวจสอบใบประกาศนียบัตร
          </Link>
          <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
            สำหรับเจ้าหน้าที่
          </Link>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">ติดต่อศูนย์อบรม</p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 size-4" />
            {site.address}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4" />
            {site.phone}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            {site.email}
          </p>
        </div>
      </div>
    </footer>
  );
}
