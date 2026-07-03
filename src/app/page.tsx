import Link from "next/link";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeAnnouncementsSection } from "@/components/site/home-announcements-section";
import { HomeCourseSection } from "@/components/site/home-course-section";
import { HomeHeroSection } from "@/components/site/home-hero-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicHomeData } from "@/lib/public-repositories";
import { formatNumber } from "@/lib/format";

const registrationSteps = [
  "สมัครสมาชิกผู้เข้าอบรม",
  "เลือกหลักสูตรและยืนยันค่าลงทะเบียน",
  "แนบหลักฐานค่าลงทะเบียน",
  "เจ้าหน้าที่ตรวจสอบและเปิดสิทธิ์เข้าเรียน",
  "เรียนออนไลน์ ทำแบบทดสอบ ส่งใบงานและแบบฝึก",
  "ผ่านเกณฑ์แล้วรับใบประกาศนียบัตรออนไลน์",
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const { site, hero, categories, courses, stats, announcements } = await getPublicHomeData();

  const statItems = [
    { label: "หลักสูตรเปิดรับสมัคร", value: formatNumber(stats.openCourses), icon: BookOpen },
    { label: "ผู้เข้าอบรมในระบบ", value: formatNumber(stats.learners), icon: UsersRound },
    { label: "ใบประกาศนียบัตรออกแล้ว", value: formatNumber(stats.certificates), icon: Award },
    { label: "ตรวจสอบออนไลน์", value: `${formatNumber(stats.verifications)} ครั้ง`, icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <HomeHeroSection site={site} hero={hero} />

        <HomeAnnouncementsSection announcements={announcements} />

        <section className="border-b bg-background">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statItems.map((stat) => (
                <div key={stat.label} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <stat.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold leading-none">{stat.value}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HomeCourseSection categories={categories} courses={courses} />

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold">ขั้นตอนการลงทะเบียน</h2>
              <p className="mt-2 text-muted-foreground">
                กระบวนการตั้งแต่สมัครสมาชิกจนถึงรับใบประกาศนียบัตร
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {registrationSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-lg border bg-card p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="size-5 text-primary" />
                ใบประกาศนียบัตรออนไลน์
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <p className="leading-7 text-muted-foreground">
                เมื่อผู้เข้าอบรมผ่านเกณฑ์ ระบบจะออกใบประกาศพร้อมเลขอ้างอิงและ QR Code สำหรับตรวจสอบ
              </p>
              <div className="grid gap-3">
                {["เลขที่ใบประกาศไม่ซ้ำ", "ตรวจสอบผ่านหน้าเว็บไซต์", "ดาวน์โหลด PDF ได้ทันทีเมื่อออกใบประกาศ"].map(
                  (item) => (
                    <p key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-primary" />
                      {item}
                    </p>
                  )
                )}
              </div>
              <Button asChild>
                <Link href="/verify-certificate">ตรวจสอบใบประกาศนียบัตร</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
