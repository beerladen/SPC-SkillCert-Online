import { LearningManagementWorkspace } from "@/components/admin/learning-management-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getLearningManagementData } from "@/lib/learning-repositories";

export const dynamic = "force-dynamic";

export default async function AdminLearningPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const result = await getLearningManagementData(user)
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? `ยังเชื่อมต่อฐานข้อมูลการเรียนรู้ไม่ได้: ${error.message}`
          : "ยังเชื่อมต่อฐานข้อมูลการเรียนรู้ไม่ได้",
    }));

  return (
    <AdminLayout title="จัดการการเรียนรู้และวัดผล">
      {result.error || !result.data ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm leading-6 text-muted-foreground">
          {result.error}
          <br />
          กรุณาเปิด MySQL ใน XAMPP แล้วรีเฟรชหน้านี้อีกครั้ง
        </div>
      ) : (
        <LearningManagementWorkspace data={result.data} />
      )}
    </AdminLayout>
  );
}
