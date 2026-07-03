import { InstructorProfileWorkspace } from "@/components/admin/instructor-profile-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import { getOwnInstructorProfile } from "@/lib/user-repositories";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const profile = await getOwnInstructorProfile(user.id);

  return (
    <AdminLayout title="โปรไฟล์ของฉัน">
      <InstructorProfileWorkspace profile={profile} />
    </AdminLayout>
  );
}
