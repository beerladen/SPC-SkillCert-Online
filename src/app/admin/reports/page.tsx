import { Award, BarChart3, CreditCard, GraduationCap } from "lucide-react";
import { AdminReportsWorkspaceReal } from "@/components/admin/admin-reports-workspace-real";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminReportData } from "@/lib/admin-summary-repositories";
import { requireCurrentUser } from "@/lib/auth";
import { formatBaht } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const data = await getAdminReportData(user);

  return (
    <AdminLayout title="รายงาน">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <AdminStatCard title="หลักสูตร" value={String(data.totals.openCourses)} description="เปิดรับสมัคร" icon={BarChart3} />
          <AdminStatCard title="ผู้เข้าอบรม" value={String(data.totals.learners)} description="สมาชิกบทบาทผู้เข้าอบรม" icon={GraduationCap} />
          <AdminStatCard title="ค่าลงทะเบียน" value={formatBaht(data.totals.revenue)} description="อนุมัติแล้ว" icon={CreditCard} />
          <AdminStatCard title="ใบประกาศ" value={String(data.totals.certificates)} description="ออกแล้ว" icon={Award} />
        </div>

        <AdminReportsWorkspaceReal data={data} />
      </div>
    </AdminLayout>
  );
}
