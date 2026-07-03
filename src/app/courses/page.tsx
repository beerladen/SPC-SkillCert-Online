import { CourseCatalog } from "@/components/site/course-catalog";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicCategories, getPublicCourses } from "@/lib/public-repositories";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const [courses, categories] = await Promise.all([
    getPublicCourses(),
    getPublicCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b bg-gradient-to-r from-secondary/80 via-background to-secondary/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              หลักสูตรทั้งหมด
            </h1>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              ค้นหาและลงทะเบียนหลักสูตรวิชาชีพระยะสั้นที่เปิดรับสมัคร พร้อมระบบวัดผลและใบประกาศนียบัตรออนไลน์
            </p>
            <p className="text-sm font-medium text-primary">
              มีหลักสูตรในระบบ {courses.length} หลักสูตร
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <CourseCatalog courses={courses} categories={categories} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
