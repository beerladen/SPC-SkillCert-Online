import { AdminPaymentsWorkspace } from "@/components/admin/admin-payments-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getAdminPaymentRows } from "@/lib/registration-repositories";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireCurrentUser(["admin", "staff"]);
  const result = await getAdminPaymentRows()
    .then((rows) => ({ rows, error: null as string | null }))
    .catch((error) => ({
      rows: [],
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดหลักฐานชำระได้",
    }));

  return (
    <AdminLayout title="ตรวจหลักฐานค่าลงทะเบียน">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลหลักฐานค่าลงทะเบียนไม่ได้: {result.error}
        </div>
      ) : (
        <AdminPaymentsWorkspace rows={result.rows} />
      )}
    </AdminLayout>
  );
}
