import Image from "next/image";
import Link from "next/link";
import { Award, BookOpenCheck, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { requireCurrentUser } from "@/lib/auth";
import { getLearnerCourseCards } from "@/lib/learning-repositories";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "completed") return "จบหลักสูตร";
  if (status === "active") return "กำลังเรียน";
  if (status === "expired") return "หมดอายุ";
  return status;
}

export default async function MyLearningPage() {
  const user = await requireCurrentUser(["student", "admin", "staff", "instructor"]);
  const learning = await getLearnerCourseCards(user.email);
  const issuedCertificates = learning.filter((item) => item.certificateStatus === "issued").length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">หลักสูตรของฉัน</h1>
            <p className="mt-2 text-muted-foreground">
              ติดตามความคืบหน้าการเรียน แบบทดสอบ ใบงาน แบบฝึกปฏิบัติ และสถานะใบประกาศ
            </p>
          </div>
          <Button variant="outline" asChild className="w-fit">
            <Link href="/my-certificates">
              <Award data-icon="inline-start" />
              ใบประกาศของฉัน
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <BookOpenCheck className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{learning.length}</p>
                <p className="text-sm text-muted-foreground">หลักสูตรที่เข้าเรียน</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <ClipboardList className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{learning.reduce((sum, item) => sum + item.pendingTaskCount, 0)}</p>
                <p className="text-sm text-muted-foreground">งานที่รอตรวจ/ต้องติดตาม</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <Award className="size-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{issuedCertificates}</p>
                <p className="text-sm text-muted-foreground">ใบประกาศนียบัตร</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>รายการหลักสูตร</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {learning.length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                ยังไม่มีหลักสูตรที่ได้รับอนุมัติให้เข้าเรียน
              </div>
            ) : (
              learning.map((item) => (
                <div
                  key={item.courseId}
                  className="grid gap-4 rounded-lg border p-4 md:grid-cols-[160px_1fr_auto]"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                    {item.coverImageUrl ? (
                      <Image
                        src={item.coverImageUrl}
                        alt={item.title}
                        fill
                        sizes="(min-width: 768px) 160px, 100vw"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                      {item.certificateStatus === "issued" && <Badge>ออกใบประกาศแล้ว</Badge>}
                    </div>
                    <h2 className="mt-3 font-semibold">{item.title}</h2>
                    <div className="mt-4 h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      ความคืบหน้า {item.progressPercent}% / เข้าเรียนเมื่อ {item.enrolledAt ?? "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                    <Button asChild>
                      <Link href={`/my-learning/${item.slug}`}>เรียนต่อ</Link>
                    </Button>
                    {item.certificateStatus === "issued" && item.certificateUrl && (
                      <Button variant="outline" asChild>
                        <Link href={item.certificateUrl} target="_blank">
                          <Award data-icon="inline-start" />
                          ดูใบประกาศ
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
