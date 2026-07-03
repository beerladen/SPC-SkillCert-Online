import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Download,
  FileQuestion,
  GraduationCap,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CourseStatusBadge } from "@/components/site/status-badge";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { formatBaht } from "@/lib/format";
import { getPublicCourseDetail } from "@/lib/public-repositories";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublicCourseDetail(slug);

  if (!course) {
    notFound();
  }
  const isFreeCourse = course.registrationFee <= 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-secondary/40">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {course.category.icon} {course.category.name}
                </Badge>
                <CourseStatusBadge status={course.status} />
                {course.certificate && <Badge variant="secondary">มีใบประกาศนียบัตร</Badge>}
              </div>

              <div className="flex flex-col gap-4">
                <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  {course.title}
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                  {course.description}
                </p>
              </div>

              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <span className="flex items-center gap-2">
                  <Clock className="size-4" />
                  {course.duration}
                </span>
                <span className="flex items-center gap-2">
                  <BookOpenCheck className="size-4" />
                  {course.lessonCount} บทเรียน
                </span>
                <span className="flex items-center gap-2">
                  <UsersRound className="size-4" />
                  ลงทะเบียนแล้ว {course.registered} คน
                </span>
                <span>{course.rating.toFixed(1)} ({course.reviewCount} รีวิว)</span>
              </div>

              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <Avatar className="size-12">
                    <AvatarFallback>{course.instructor.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">ผู้สอน</p>
                    <p className="font-semibold">{course.instructor.name}</p>
                    <p className="text-sm text-muted-foreground">{course.instructor.role}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="h-fit overflow-hidden lg:sticky lg:top-24">
              <div className="relative aspect-video overflow-hidden bg-muted">
                <Image
                  src={course.coverImage}
                  alt={course.title}
                  fill
                  sizes="(min-width: 1024px) 380px, 100vw"
                  className="object-cover"
                />
              </div>
              <CardContent className="flex flex-col gap-5 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">ค่าลงทะเบียน</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {formatBaht(course.registrationFee)}
                    </span>
                    {course.originalFee && (
                      <span className="text-muted-foreground line-through">
                        {formatBaht(course.originalFee)}
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild size="lg">
                  <Link href={`/registration?course=${course.slug}`}>
                    ลงทะเบียนหลักสูตรนี้
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/registration">ไปหน้ารายการลงทะเบียน</Link>
                </Button>
                <Separator />
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="size-4" />
                    {isFreeCourse ? "เปิดสิทธิ์เข้าเรียนทันทีหลังยืนยันลงทะเบียน" : "เปิดสิทธิ์เข้าเรียนหลังอนุมัติค่าลงทะเบียน"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Award className="size-4" />
                    ออกใบประกาศนียบัตรเมื่อผ่านเกณฑ์
                  </span>
                  <span className="flex items-center gap-2">
                    <Download className="size-4" />
                    ดาวน์โหลดเอกสารประกอบได้ในระบบ
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div className="flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle>สิ่งที่ผู้เข้าอบรมจะได้เรียนรู้</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {course.outcomes.map((outcome) => (
                  <p key={outcome} className="flex gap-2 text-sm leading-6">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                    {outcome}
                  </p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>เนื้อหาภายในหลักสูตร</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {course.curriculum.map((section, index) => (
                  <div key={`${section.title}-${index}`} className="rounded-lg border p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-sm font-semibold">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="font-semibold">{section.title}</p>
                          <p className="text-sm text-muted-foreground">{section.duration}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{section.lessons.length} บทเรียน</Badge>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {section.lessons.map((lesson) => (
                        <p key={lesson} className="text-sm text-muted-foreground">
                          {lesson}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="size-5 text-primary" />
                  ระบบวัดผล
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p><span className="font-medium">Pre-test:</span> {course.assessment.preTest}</p>
                <p><span className="font-medium">Quiz:</span> {course.assessment.quizzes}</p>
                <p><span className="font-medium">Post-test:</span> {course.assessment.postTest}</p>
                <p><span className="font-medium">คะแนนผ่าน:</span> {course.assessment.passingScore}</p>
                <p><span className="font-medium">เงื่อนไขเรียน:</span> {course.assessment.progressRequired}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>เหมาะสำหรับ</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {course.audience.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ความต้องการเบื้องต้น</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {course.requirements.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
