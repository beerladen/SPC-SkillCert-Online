import { Badge } from "@/components/ui/badge";

const courseStatusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  open: "เปิดรับสมัคร",
  nearly_full: "ใกล้เต็ม",
  closed: "ปิดรับสมัคร",
  archived: "คลัง",
};

const registrationStatusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  pending_payment: "รอชำระค่าลงทะเบียน",
  pending_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
};

export function CourseStatusBadge({ status }: { status: string }) {
  const variant = status === "closed" || status === "archived" ? "secondary" : "default";
  return <Badge variant={variant}>{courseStatusLabels[status] ?? status}</Badge>;
}

export function RegistrationStatusBadge({ status }: { status: string }) {
  return <Badge variant="secondary">{registrationStatusLabels[status] ?? status}</Badge>;
}
