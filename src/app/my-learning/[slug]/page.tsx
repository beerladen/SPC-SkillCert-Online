import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LearnerClassroomWorkspace } from "@/components/learning/learner-classroom-workspace";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";
import { getLearnerClassroomData } from "@/lib/learning-repositories";

export const dynamic = "force-dynamic";

export default async function ClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registration?: string; success?: string; no?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const data = await getLearnerClassroomData(slug, user.email);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <Button variant="ghost" asChild className="w-fit px-0">
            <Link href="/my-learning">
              <ChevronLeft data-icon="inline-start" />
              กลับไปหลักสูตรของฉัน
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{data.course.title}</h1>
            <p className="mt-2 text-muted-foreground">
              เรียนผ่านคลิป อ่านใบความรู้ ทำแบบทดสอบ ส่งใบงานและแบบฝึกผ่านระบบ
            </p>
          </div>
        </div>

        <LearnerClassroomWorkspace
          data={data}
          initialNotice={
            query.registration === "approved"
              ? {
                  title: "ลงทะเบียนสำเร็จ",
                  message: `เปิดสิทธิ์เข้าเรียนเรียบร้อยแล้ว${query.no ? ` เลขรายการ ${query.no}` : query.success ? ` เลขอ้างอิง #${query.success}` : ""} คุณเริ่มเรียนออนไลน์ได้ทันที`,
                  variant: "success",
                }
              : undefined
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
