import { AdminUsersWorkspace } from "@/components/admin/admin-users-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getAdminUserRows } from "@/lib/user-repositories";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireCurrentUser(["admin", "staff"]);
  const result = await getAdminUserRows()
    .then((rows) => ({ rows, error: null as string | null }))
    .catch((error) => ({
      rows: [],
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดผู้ใช้งานได้",
    }));

  return (
    <AdminLayout title="ผู้ใช้งาน">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลผู้ใช้งานไม่ได้: {result.error}
        </div>
      ) : (
        <AdminUsersWorkspace rows={result.rows} />
      )}
    </AdminLayout>
  );
}
