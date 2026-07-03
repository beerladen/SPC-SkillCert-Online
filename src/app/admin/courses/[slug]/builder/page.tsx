import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CourseBuilderWorkspace } from "@/components/admin/course-builder-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";
import { getCourseBuilderData } from "@/lib/db-repositories";

export const dynamic = "force-dynamic";

export default async function CourseBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialView = getInitialBuilderView(resolvedSearchParams.view);
  const result = await getCourseBuilderData(slug, user)
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? `ยังเชื่อมต่อฐานข้อมูลหลักสูตรไม่ได้: ${error.message}`
          : "ยังเชื่อมต่อฐานข้อมูลหลักสูตรไม่ได้",
    }));

  if (result.error) {
    return (
      <AdminLayout title="โครงสร้างหลักสูตร">
        <div className="flex flex-col gap-6">
          <Button variant="ghost" asChild className="w-fit px-0">
            <Link href="/admin/courses">
              <ChevronLeft data-icon="inline-start" />
              กลับไปจัดการหลักสูตร
            </Link>
          </Button>
          <div className="rounded-lg border bg-secondary/30 p-5 text-sm leading-6 text-muted-foreground">
            {result.error}
            <br />
            กรุณาเปิด MySQL ใน XAMPP แล้วรีเฟรชหน้านี้อีกครั้ง
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!result.data) {
    notFound();
  }

  return (
    <AdminLayout title="โครงสร้างหลักสูตร">
      <div className="flex flex-col gap-6">
        <Button variant="ghost" asChild className="w-fit px-0">
          <Link href="/admin/courses">
            <ChevronLeft data-icon="inline-start" />
            กลับไปจัดการหลักสูตร
          </Link>
        </Button>
        <CourseBuilderWorkspace data={result.data} initialView={initialView} />
      </div>
    </AdminLayout>
  );
}

function getInitialBuilderView(value?: string) {
  if (
    value === "sections" ||
    value === "lessons" ||
    value === "resources" ||
    value === "assessments" ||
    value === "worksheets" ||
    value === "practices"
  ) {
    return value;
  }

  return "sections";
}
