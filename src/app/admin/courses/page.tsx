import { AdminCoursesWorkspace } from "@/components/admin/admin-courses-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getCourseManagementData } from "@/lib/db-repositories";

export const dynamic = "force-dynamic";

const emptyData = {
  courses: [],
  categories: [],
  instructors: [],
};

export default async function AdminCoursesPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const result = await getCourseManagementData(user)
    .then((data) => ({ data, error: undefined }))
    .catch((error) => ({
      data: emptyData,
      error:
        error instanceof Error
          ? `ยังอ่านข้อมูลหลักสูตรจากฐานข้อมูลไม่ได้: ${error.message}`
          : "ยังอ่านข้อมูลหลักสูตรจากฐานข้อมูลไม่ได้",
    }));

  return (
    <AdminLayout title="จัดการหลักสูตร">
      <AdminCoursesWorkspace data={result.data} loadError={result.error} />
    </AdminLayout>
  );
}
