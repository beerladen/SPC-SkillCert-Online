import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const contactItems = [
  {
    icon: Phone,
    title: "โทรศัพท์",
    value: "02-000-0000",
    body: "ติดต่อเจ้าหน้าที่ศูนย์อบรมในวันและเวลาราชการ",
  },
  {
    icon: Mail,
    title: "อีเมล",
    value: "training@spc.ac.th",
    body: "แจ้งปัญหาการใช้งาน การลงทะเบียน หรือใบประกาศนียบัตร",
  },
  {
    icon: MapPin,
    title: "สถานที่",
    value: "วิทยาลัยสารพัดช่างสุรินทร์",
    body: "ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ SPC SkillCert Online",
  },
];

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-primary">ติดต่อศูนย์อบรม</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              แจ้งปัญหาและขอความช่วยเหลือ
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
              หากพบปัญหาการเข้าสู่ระบบ การลงทะเบียน การชำระค่าลงทะเบียน
              การเรียนออนไลน์ การส่งงาน หรือการตรวจสอบใบประกาศนียบัตร
              สามารถติดต่อเจ้าหน้าที่ผ่านช่องทางด้านล่าง
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button asChild>
              <Link href="mailto:training@spc.ac.th">
                <MessageCircle className="size-4" />
                ส่งอีเมล
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/help">คู่มือระบบ</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {contactItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-5">
                <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </span>
                <h2 className="text-lg font-bold">{item.title}</h2>
                <p className="mt-1 font-semibold text-foreground">{item.value}</p>
                <p className="mt-2 leading-7 text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
