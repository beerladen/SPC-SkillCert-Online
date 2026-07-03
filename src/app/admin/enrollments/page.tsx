import { AdminEnrollmentsWorkspace } from "@/components/admin/admin-enrollments-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminEnrollmentProgressRows } from "@/lib/admin-review-repositories";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminEnrollmentsPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const result = await getAdminEnrollmentProgressRows(user)
    .then((rows) => ({ rows, error: null as string | null }))
    .catch((error) => ({
      rows: [],
      error:
        error instanceof Error
          ? `ยังเชื่อมต่อฐานข้อมูลผู้เข้าอบรมไม่ได้: ${error.message}`
          : "ยังเชื่อมต่อฐานข้อมูลผู้เข้าอบรมไม่ได้",
    }));

  return (
    <AdminLayout title="ผู้เข้าอบรม">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm leading-6 text-muted-foreground">
          {result.error}
          <br />
          กรุณาเปิด MySQL ใน XAMPP แล้วรีเฟรชหน้านี้อีกครั้ง
        </div>
      ) : (
        <AdminEnrollmentsWorkspace rows={result.rows} />
      )}
    </AdminLayout>
  );
}
