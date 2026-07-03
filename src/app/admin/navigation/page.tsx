import { AdminNavigationWorkspace } from "@/components/admin/admin-navigation-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminNavigationManagerData } from "@/lib/admin-navigation-repositories";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNavigationPage() {
  await requireCurrentUser(["admin"]);
  const result = await getAdminNavigationManagerData()
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: { sections: [], items: [] },
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลเมนูได้",
    }));

  return (
    <AdminLayout title="จัดการเมนู">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลเมนูไม่ได้: {result.error}
        </div>
      ) : (
        <AdminNavigationWorkspace sections={result.data.sections} items={result.data.items} />
      )}
    </AdminLayout>
  );
}
