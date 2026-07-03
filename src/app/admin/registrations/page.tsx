import { AdminRegistrationsWorkspace } from "@/components/admin/admin-registrations-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getAdminRegistrationRows } from "@/lib/registration-repositories";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationsPage() {
  await requireCurrentUser(["admin", "staff"]);
  const result = await getAdminRegistrationRows()
    .then((rows) => ({ rows, error: null as string | null }))
    .catch((error) => ({
      rows: [],
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดรายการลงทะเบียนได้",
    }));

  return (
    <AdminLayout title="รายการลงทะเบียน">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลรายการลงทะเบียนไม่ได้: {result.error}
        </div>
      ) : (
        <AdminRegistrationsWorkspace rows={result.rows} />
      )}
    </AdminLayout>
  );
}
