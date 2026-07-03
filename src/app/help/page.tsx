import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const helpItems = [
  {
    icon: GraduationCap,
    title: "ลงทะเบียนหลักสูตร",
    body: "สมัครสมาชิก เลือกหลักสูตรที่เปิดรับสมัคร และยืนยันข้อมูลผู้เข้าอบรมให้ครบถ้วน",
  },
  {
    icon: BookOpen,
    title: "เข้าเรียนออนไลน์",
    body: "เริ่มจากแบบทดสอบก่อนเรียน เรียนผ่านคลิปและใบความรู้ แล้วทำใบงานหรือแบบฝึกตามที่หลักสูตรกำหนด",
  },
  {
    icon: ClipboardCheck,
    title: "ตรวจผลและใบประกาศ",
    body: "ติดตามผลการเรียน คะแนน สถานะส่งงาน และดาวน์โหลดใบประกาศนียบัตรเมื่อผ่านเกณฑ์",
  },
  {
    icon: LifeBuoy,
    title: "ขอความช่วยเหลือ",
    body: "หากพบปัญหาการเข้าสู่ระบบ การลงทะเบียน หรือการส่งงาน สามารถติดต่อเจ้าหน้าที่ศูนย์อบรมได้ทันที",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">คู่มือระบบ</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">การใช้งาน SPC SkillCert Online</h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
              รวมขั้นตอนสำคัญสำหรับผู้เข้าอบรม ตั้งแต่ลงทะเบียน เข้าเรียนออนไลน์ ส่งงาน ไปจนถึงรับใบประกาศนียบัตร
            </p>
          </div>
          <Button asChild>
            <Link href="/feedback">ติดต่อเจ้าหน้าที่</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {helpItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">{item.title}</h2>
                  <p className="mt-2 leading-7 text-muted-foreground">{item.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
