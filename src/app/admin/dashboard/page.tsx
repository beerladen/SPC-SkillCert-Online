import {
  Award,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileQuestion,
  UsersRound,
} from "lucide-react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDashboardData } from "@/lib/admin-summary-repositories";
import { requireCurrentUser } from "@/lib/auth";
import { formatBaht } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const data = await getAdminDashboardData(user);

  return (
    <AdminLayout title="Dashboard">
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            ภาพรวม SPC SkillCert Online
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ติดตามหลักสูตร การลงทะเบียน ค่าลงทะเบียน วัดผล และใบประกาศนียบัตรจากฐานข้อมูลจริง
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard title="หลักสูตรเปิดรับสมัคร" value={String(data.stats.openCourses)} description="แสดงบนหน้าเว็บ" icon={BookOpen} />
          <AdminStatCard title="รายการลงทะเบียน" value={String(data.stats.registrations)} description="รวมทุกรายการในระบบ" icon={ClipboardCheck} />
          <AdminStatCard title="รายรับค่าลงทะเบียน" value={formatBaht(data.stats.revenue)} description="จากรายการที่อนุมัติแล้ว" icon={CreditCard} />
          <AdminStatCard title="ใบประกาศนียบัตร" value={String(data.stats.certificates)} description="ออกแล้วและตรวจสอบได้" icon={Award} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>รายการลงทะเบียนล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.recentRegistrations.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  ยังไม่มีรายการลงทะเบียน
                </p>
              ) : (
                data.recentRegistrations.map((record) => (
                  <div key={record.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[150px_1fr_auto]">
                    <div>
                      <p className="font-semibold">{record.registrationNo}</p>
                      <p className="text-xs text-muted-foreground">{record.submittedAt}</p>
                    </div>
                    <div>
                      <p className="font-medium">{record.learnerName}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{record.courseTitles}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatBaht(record.totalAmount)}</p>
                      <Badge variant="secondary">{record.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>งานที่ต้องติดตาม</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                { icon: CreditCard, title: "ตรวจหลักฐานค่าลงทะเบียน", detail: `${data.stats.pendingPayments} รายการรอตรวจสอบ` },
                { icon: FileQuestion, title: "ตรวจใบงานและแบบฝึก", detail: `${data.stats.pendingTasks} รายการรอตรวจ` },
                { icon: UsersRound, title: "ผู้เข้าอบรมใกล้จบ", detail: `${data.stats.nearCompletion} คนมีความคืบหน้า 80% ขึ้นไป` },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-lg border p-4">
                  <item.icon className="size-5 text-primary" />
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
