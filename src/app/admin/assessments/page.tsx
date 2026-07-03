import { FileQuestion, ListChecks, Timer } from "lucide-react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AssessmentReviewWorkspace } from "@/components/admin/assessment-review-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminReviewSubmissions } from "@/lib/admin-review-repositories";
import { requireCurrentUser } from "@/lib/auth";
import { scopedCourseFilter } from "@/lib/course-access";
import { queryRows } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export default async function AdminAssessmentsPage() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const courseScope = scopedCourseFilter(user, "c", "grade");
  const result = await Promise.all([
    getAdminReviewSubmissions(user),
    queryRows<
      RowDataPacket & {
        assessments: number;
        questions: number;
        pending: number;
      }
    >(
      `SELECT
        (
          SELECT COUNT(*)
          FROM assessments a
          JOIN courses c ON c.id = a.course_id
          LEFT JOIN course_sections s ON s.id = a.section_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE a.deleted_at IS NULL
            AND a.status <> 'archived'
            AND c.deleted_at IS NULL
            AND c.status <> 'archived'
            AND (a.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (a.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
            ${courseScope.sql}
        ) AS assessments,
        (
          SELECT COUNT(*)
          FROM questions q
          JOIN assessments a ON a.id = q.assessment_id
          JOIN courses c ON c.id = a.course_id
          LEFT JOIN course_sections s ON s.id = a.section_id
          LEFT JOIN lessons l ON l.id = a.lesson_id
          WHERE q.status <> 'archived'
            AND a.deleted_at IS NULL
            AND a.status <> 'archived'
            AND c.deleted_at IS NULL
            AND c.status <> 'archived'
            AND (a.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (a.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
            ${courseScope.sql}
        ) AS questions,
        (
          SELECT COUNT(*)
          FROM learning_task_submissions sub
          JOIN learning_tasks t ON t.id = sub.task_id
          JOIN courses c ON c.id = t.course_id
          LEFT JOIN course_sections s ON s.id = t.section_id
          LEFT JOIN lessons l ON l.id = t.lesson_id
          WHERE sub.status IN ('submitted', 'pending_review')
            AND t.deleted_at IS NULL
            AND t.status <> 'archived'
            AND c.deleted_at IS NULL
            AND c.status <> 'archived'
            AND (t.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
            AND (t.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
            ${courseScope.sql}
        ) AS pending`,
      [...courseScope.values, ...courseScope.values, ...courseScope.values],
    ),
  ])
    .then(([rows, stats]) => ({ rows, stat: stats[0], error: null as string | null }))
    .catch((error) => ({
      rows: [],
      stat: null,
      error:
        error instanceof Error
          ? `ยังเชื่อมต่อฐานข้อมูลวัดผลไม่ได้: ${error.message}`
          : "ยังเชื่อมต่อฐานข้อมูลวัดผลไม่ได้",
    }));
  const stat = result.stat;

  return (
    <AdminLayout title="วัดผล/ตรวจงาน">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <AdminStatCard
            title="ชุดแบบทดสอบ"
            value={String(stat?.assessments ?? 0)}
            description="Pre-test, quiz และ post-test"
            icon={FileQuestion}
          />
          <AdminStatCard
            title="ข้อสอบในคลัง"
            value={String(stat?.questions ?? 0)}
            description="รองรับสุ่มข้อสอบรายหลักสูตร"
            icon={ListChecks}
          />
          <AdminStatCard
            title="งานรอตรวจ"
            value={String(stat?.pending ?? 0)}
            description="ใบงานและแบบฝึกปฏิบัติ"
            icon={Timer}
          />
        </div>

        {result.error ? (
          <div className="rounded-lg border bg-secondary/30 p-5 text-sm leading-6 text-muted-foreground">
            {result.error}
            <br />
            กรุณาเปิด MySQL ใน XAMPP แล้วรีเฟรชหน้านี้อีกครั้ง
          </div>
        ) : (
          <AssessmentReviewWorkspace rows={result.rows} />
        )}
      </div>
    </AdminLayout>
  );
}
