import { AdminAnnouncementsWorkspace } from "@/components/admin/admin-announcements-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import {
  getAdminAnnouncements,
  getAnnouncementCourseOptions,
} from "@/lib/announcement-repositories";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireCurrentUser(["admin", "staff"]);
  const [{ updated }, result] = await Promise.all([
    searchParams,
    Promise.all([getAdminAnnouncements(), getAnnouncementCourseOptions()])
      .then(([rows, courses]) => ({ rows, courses, error: null as string | null }))
      .catch((error) => ({
        rows: [],
        courses: [],
        error: error instanceof Error ? error.message : "ไม่สามารถโหลดข่าวประชาสัมพันธ์ได้",
      })),
  ]);

  return (
    <AdminLayout title="ข่าวประชาสัมพันธ์">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลข่าวประชาสัมพันธ์ไม่ได้: {result.error}
        </div>
      ) : (
        <AdminAnnouncementsWorkspace
          rows={result.rows}
          courses={result.courses}
          updated={updated}
        />
      )}
    </AdminLayout>
  );
}
