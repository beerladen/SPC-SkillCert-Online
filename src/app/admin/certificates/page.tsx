import { AdminCertificatesWorkspace } from "@/components/admin/admin-certificates-workspace";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireCurrentUser } from "@/lib/auth";
import {
  getCertificateApprovalCourseOptions,
  getCertificateApprovalReports,
} from "@/lib/certificate-approval-repositories";
import { getAdminCertificateRows, getCertificateCandidates } from "@/lib/certificate-repositories";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  await requireCurrentUser(["admin", "staff"]);

  const result = await Promise.all([
    getAdminCertificateRows(),
    getCertificateCandidates(),
    getCertificateApprovalReports(),
    getCertificateApprovalCourseOptions(),
  ])
    .then(([rows, candidates, approvalReports, approvalCourseOptions]) => ({
      rows,
      candidates,
      approvalReports,
      approvalCourseOptions,
      error: null as string | null,
    }))
    .catch((error) => ({
      rows: [],
      candidates: [],
      approvalReports: [],
      approvalCourseOptions: [],
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดใบประกาศได้",
    }));

  return (
    <AdminLayout title="ใบประกาศนียบัตร">
      {result.error ? (
        <div className="rounded-lg border bg-secondary/30 p-5 text-sm text-muted-foreground">
          ยังอ่านข้อมูลใบประกาศไม่ได้: {result.error}
        </div>
      ) : (
        <AdminCertificatesWorkspace
          rows={result.rows}
          candidates={result.candidates}
          approvalReports={result.approvalReports}
          approvalCourseOptions={result.approvalCourseOptions}
        />
      )}
    </AdminLayout>
  );
}
