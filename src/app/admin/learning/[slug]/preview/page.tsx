import Link from "next/link";
import { ChevronLeft, Eye } from "lucide-react";
import { ensurePreviewLearnerEnrollmentAction } from "@/app/admin/learning/preview-actions";
import { LearnerClassroomWorkspace } from "@/components/learning/learner-classroom-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import {
  getLearnerClassroomData,
  getLearningPreviewLearners,
} from "@/lib/learning-repositories";

export const dynamic = "force-dynamic";

export default async function AdminLearningPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ learnerEmail?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);

  const learners = await getLearningPreviewLearners(slug, user);
  const selectedLearner =
    learners.find((learner) => learner.email === resolvedSearchParams.learnerEmail) ??
    learners[0] ??
    null;
  const data = selectedLearner
    ? await getLearnerClassroomData(slug, selectedLearner.email)
    : null;

  return (
    <AdminLayout title="แสดงหน้าผู้เรียน">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild className="w-fit px-0">
            <Link href="/admin/learning">
              <ChevronLeft data-icon="inline-start" />
              กลับไปจัดการการเรียนรู้
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/courses/${slug}/builder`}>
              โครงสร้างหลักสูตร
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-5 text-primary" />
              โหมดแอดมินดูหน้าผู้เรียน
            </CardTitle>
            <CardDescription>
              เลือกผู้เรียนที่ลงทะเบียนในหลักสูตรนี้เพื่อดูทุกแท็บและทดสอบการใช้งานด้วยข้อมูลจริงของผู้เรียนคนนั้น
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <form id="learning-preview-learner-form" className="grid gap-2">
              <label htmlFor="learnerEmail" className="text-sm font-medium">
                บัญชีผู้เรียนสำหรับทดสอบ
              </label>
              <select
                id="learnerEmail"
                name="learnerEmail"
                className="h-11 w-full max-w-2xl rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                defaultValue={selectedLearner?.email ?? ""}
                disabled={!learners.length}
              >
                {learners.length ? (
                  learners.map((learner) => (
                    <option key={learner.enrollmentId} value={learner.email}>
                      {learner.name} / {learner.email} / {learner.progressPercent}%
                    </option>
                  ))
                ) : (
                  <option value="">ยังไม่มีผู้เรียนที่ลงทะเบียนหลักสูตรนี้</option>
                )}
              </select>
              {selectedLearner && (
                <p className="text-sm text-muted-foreground">
                  สถานะ {selectedLearner.enrollmentStatus} · ความคืบหน้า {selectedLearner.progressPercent}%
                </p>
              )}
            </form>
            <Button type="submit" form="learning-preview-learner-form" disabled={!learners.length}>
              เปิดบัญชีนี้
            </Button>
          </CardContent>
        </Card>

        {!selectedLearner || !data ? (
          <Card>
            <CardContent className="grid gap-4 p-6 text-sm leading-6 text-muted-foreground">
              <p>
                ยังไม่พบผู้เรียนที่ใช้ทดสอบหลักสูตรนี้ได้ สามารถสร้างสิทธิ์เรียนให้บัญชีผู้เข้าอบรมตัวอย่างเพื่อทดสอบ flow ผู้เรียนได้ทันที
              </p>
              <form action={ensurePreviewLearnerEnrollmentAction}>
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit">สร้างผู้เรียนตัวอย่างสำหรับทดสอบ</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <LearnerClassroomWorkspace
            data={data}
            adminPreview={{
              learnerEmail: selectedLearner.email,
              learnerName: selectedLearner.name,
              returnHref: "/admin/learning",
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
