import Image from "next/image";
import { notFound } from "next/navigation";
import { ReportPrintActions } from "@/components/admin/report-print-actions";
import { getAdminReportData, type AdminReportCourseLearnerRow } from "@/lib/admin-summary-repositories";
import { requireCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type PrintSearchParams = {
  type?: string;
  courseId?: string;
  learnerId?: string;
};

const statusLabels: Record<string, string> = {
  active: "กำลังเรียน",
  completed: "เรียนครบ",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
  pending_review: "รอตรวจงาน",
  waiting_submission: "รอส่งงาน",
  not_passed: "ไม่ผ่าน",
  certificate_issued: "ออกใบประกาศแล้ว",
  pending_payment: "รอค่าลงทะเบียน",
  pending: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  issued: "ออกแล้ว",
  revoked: "ยกเลิกใบประกาศ",
  reissued: "ออกใหม่",
};

function statusLabel(status: string | null | undefined, fallback = "-") {
  if (!status) return fallback;
  return statusLabels[status] ?? status;
}

function documentTypeLabel(type: string | null | undefined) {
  return type === "certificate" ? "ใบประกาศนียบัตร" : "เกียรติบัตร";
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
}

function isPassed(row: AdminReportCourseLearnerRow) {
  return ["completed", "certificate_issued"].includes(row.courseResultStatus);
}

export default async function AdminReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<PrintSearchParams>;
}) {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);
  const params = await searchParams;
  const data = await getAdminReportData(user);
  const type = params.type === "learner" ? "learner" : "course";
  const generatedAt = formatDateTime(new Date().toISOString());

  if (type === "learner") {
    const learnerId = Number(params.learnerId);
    const learner = data.learnerRows.find((row) => row.userId === learnerId);
    if (!learner) notFound();
    const rows = data.courseLearnerRows.filter((row) => row.userId === learnerId);
    const submissions = data.reviewRows.filter((row) => row.learnerId === learnerId);

    return (
      <PrintShell
        title="รายงานรายบุคคลผู้เข้าอบรม"
        subtitle={`${learner.learnerName} / ${learner.learnerEmail}`}
      >
        <ReportInfoGrid
          items={[
            ["ผู้เข้าอบรม", learner.learnerName],
            ["อีเมล", learner.learnerEmail],
            ["เบอร์โทร", learner.learnerPhone ?? "-"],
            ["จำนวนหลักสูตร", `${learner.courseCount} หลักสูตร`],
            ["ความก้าวหน้าเฉลี่ย", formatPercent(learner.averageProgress)],
            ["วันที่ออกรายงาน", generatedAt],
          ]}
        />

        <SectionTitle title="สรุปสถานะรายหลักสูตร" />
        <table className="report-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>หลักสูตร</th>
              <th>สถานะ</th>
              <th>ความก้าวหน้า</th>
              <th>บทเรียน</th>
              <th>Pre/Post</th>
              <th>งานส่ง</th>
              <th>ใบประกาศ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.enrollmentId}>
                <td>{index + 1}</td>
                <td>{row.courseTitle}</td>
                <td>{statusLabel(row.courseResultStatus)}</td>
                <td>{formatPercent(row.progressPercent)}</td>
                <td>{row.completedLessons}/{row.totalLessons}</td>
                <td>{formatScore(row.preTestScore)} / {formatScore(row.postTestScore)}</td>
                <td>{row.submittedTasks}/{row.totalTasks}</td>
                <td>{statusLabel(row.certificateStatus, "ยังไม่พร้อม")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {submissions.length > 0 && (
          <>
            <SectionTitle title="สรุปใบงานและแบบฝึกที่ส่ง" />
            <table className="report-table compact-table">
              <thead>
                <tr>
                  <th>หลักสูตร</th>
                  <th>ชิ้นงาน</th>
                  <th>คะแนน</th>
                  <th>เกณฑ์ผ่าน</th>
                  <th>สถานะ</th>
                  <th>ตรวจเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.courseTitle}</td>
                    <td>{row.taskTitle}</td>
                    <td>{row.score === null ? "-" : `${formatScore(row.score)}/${formatScore(row.maxScore)}`}</td>
                    <td>{formatScore(row.passingScore)}</td>
                    <td>{statusLabel(row.status)}</td>
                    <td>{row.gradedAt ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </PrintShell>
    );
  }

  const selectedCourse =
    data.courseOptions.find((course) => String(course.id) === String(params.courseId)) ??
    data.courseOptions[0];
  if (!selectedCourse) notFound();

  const rows = data.courseLearnerRows.filter((row) => row.courseId === selectedCourse.id);
  const completed = rows.filter((row) => row.enrollmentStatus === "completed").length;
  const passed = rows.filter(isPassed).length;
  const notPassed = rows.filter((row) => row.courseResultStatus === "not_passed").length;
  const pending = rows.filter((row) => ["pending_review", "waiting_submission"].includes(row.courseResultStatus)).length;
  const issued = rows.filter((row) => row.certificateStatus === "issued").length;

  return (
    <PrintShell
      title="รายงานสรุปผลการอบรมตามหลักสูตร"
      subtitle={`${selectedCourse.title} / ${documentTypeLabel(selectedCourse.certificateDocumentType)}`}
    >
      <ReportInfoGrid
        items={[
          ["ชื่อหลักสูตร", selectedCourse.title],
          ["เจ้าของหลักสูตร", selectedCourse.instructorName ?? "-"],
          ["ตำแหน่ง", selectedCourse.instructorPosition ?? "-"],
          ["ช่วงอบรม", `${selectedCourse.startsAt ?? "ตลอดเวลา"} - ${selectedCourse.endsAt ?? "ตลอดเวลา"}`],
          ["จำนวนผู้เข้าอบรม", `${rows.length} คน`],
          ["วันที่ออกรายงาน", generatedAt],
        ]}
      />

      <div className="summary-row">
        <SummaryBox label="เรียนครบ" value={`${completed} คน`} />
        <SummaryBox label="ผ่านเกณฑ์" value={`${passed} คน`} />
        <SummaryBox label="รอดำเนินการ" value={`${pending} คน`} />
        <SummaryBox label="ไม่ผ่าน" value={`${notPassed} คน`} />
        <SummaryBox label="ใบประกาศออกแล้ว" value={`${issued} ใบ`} />
      </div>

      <SectionTitle title="ตารางรายชื่อผู้เข้าอบรมและผลการเรียน" />
      <table className="report-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ชื่อ-สกุล</th>
            <th>วันที่ลงทะเบียน</th>
            <th>สถานะค่าลงทะเบียน</th>
            <th>บทเรียน</th>
            <th>ความก้าวหน้า</th>
            <th>Pre/Post</th>
            <th>งานส่ง/ผ่าน</th>
            <th>ผลหลักสูตร</th>
            <th>ใบประกาศ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.enrollmentId}>
              <td>{index + 1}</td>
              <td>
                <strong>{row.learnerName}</strong>
                <br />
                <span className="muted">{row.learnerEmail}</span>
              </td>
              <td>{row.registeredAt ?? "-"}</td>
              <td>{statusLabel(row.paymentStatus, "ยังไม่มีชำระ")}</td>
              <td>{row.completedLessons}/{row.totalLessons}</td>
              <td>{formatPercent(row.progressPercent)}</td>
              <td>{formatScore(row.preTestScore)} / {formatScore(row.postTestScore)}</td>
              <td>{row.submittedTasks}/{row.totalTasks} / ผ่าน {row.passedTasks}</td>
              <td>{statusLabel(row.courseResultStatus)}</td>
              <td>{statusLabel(row.certificateStatus, "ยังไม่พร้อม")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SignatureBlock
        signatureUrl={selectedCourse.instructorSignatureUrl}
        name={selectedCourse.instructorName ?? "................................................"}
        position={selectedCourse.instructorPosition ?? "ครูเจ้าของหลักสูตร"}
      />
    </PrintShell>
  );
}

function PrintShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 py-6 text-slate-950 print:bg-white print:p-0">
      <ReportPrintActions />
      <article className="report-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[16mm] shadow-xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-4 text-center">
          <p className="text-sm font-medium">ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ (SPC SkillCert Online)</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm">{subtitle}</p>
        </header>
        <div className="mt-5">{children}</div>
      </article>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 14mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .report-page {
          font-family: "Noto Sans Thai", "Sarabun", "Tahoma", sans-serif;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          line-height: 1.45;
        }
        .report-table th,
        .report-table td {
          border: 1px solid #cbd5e1;
          padding: 5px 6px;
          vertical-align: top;
        }
        .report-table th {
          background: #eaf2ff;
          font-weight: 700;
          text-align: left;
        }
        .compact-table {
          font-size: 10px;
        }
        .muted {
          color: #475569;
          font-size: 10px;
        }
        .summary-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin: 16px 0;
        }
      `}</style>
    </main>
  );
}

function ReportInfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-slate-50 p-4 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 mt-5 text-base font-bold">{title}</h2>;
}

function SignatureBlock({
  signatureUrl,
  name,
  position,
}: {
  signatureUrl: string | null;
  name: string;
  position: string;
}) {
  return (
    <div className="mt-10 flex justify-end">
      <div className="w-72 text-center text-sm">
        <div className="flex h-16 items-end justify-center">
          {signatureUrl ? (
            <Image
              src={signatureUrl}
              alt="ลายเซ็นเจ้าของหลักสูตร"
              width={220}
              height={70}
              className="max-h-16 w-auto object-contain"
            />
          ) : null}
        </div>
        <div className="border-t border-slate-900 pt-2">
          <p className="font-semibold">({name})</p>
          <p>{position}</p>
          <p className="mt-1 text-xs text-slate-500">ผู้รับรองรายงาน / เจ้าของหลักสูตร</p>
        </div>
      </div>
    </div>
  );
}
