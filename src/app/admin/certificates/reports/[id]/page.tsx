import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CertificateApprovalReportDocument } from "@/components/certificates/certificate-approval-report-document";
import { CertificatePrintButton } from "@/components/certificates/certificate-print-button";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";
import { getCertificateApprovalReportDetail } from "@/lib/certificate-approval-repositories";

export const dynamic = "force-dynamic";

interface AdminCertificateApprovalReportPageProps {
  params: Promise<{ id: string }>;
}

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "127.0.0.1:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export default async function AdminCertificateApprovalReportPage({
  params,
}: AdminCertificateApprovalReportPageProps) {
  await requireCurrentUser(["admin", "staff"]);
  const { id } = await params;
  const reportId = Number(id);

  if (!Number.isFinite(reportId)) {
    notFound();
  }

  const detail = await getCertificateApprovalReportDetail(reportId);
  if (!detail) {
    notFound();
  }

  const baseUrl = await getBaseUrl();

  return (
    <AdminLayout title="รายงานเสนออนุมัติ">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link href="/admin/certificates">
              <ArrowLeft className="size-4" />
              กลับไปใบประกาศนียบัตร
            </Link>
          </Button>
          <CertificatePrintButton label="พิมพ์รายงาน" icon="print" />
        </div>

        <CertificateApprovalReportDocument detail={detail} baseUrl={baseUrl} />
      </div>
    </AdminLayout>
  );
}
