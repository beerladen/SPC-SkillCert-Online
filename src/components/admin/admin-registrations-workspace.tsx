"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Eye, Save, Trash2 } from "lucide-react";
import {
  removeRegistrationAction,
  updateRegistrationStatusAction,
} from "@/app/admin/registrations/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBaht } from "@/lib/format";
import type { AdminRegistrationRow } from "@/lib/registration-repositories";

const statusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  pending_payment: "รอชำระค่าลงทะเบียน",
  pending_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
  pending: "รอหลักฐาน",
  refunded: "คืนเงิน",
};

function statusVariant(status: string) {
  if (status === "approved" || status === "completed") return "default";
  if (status === "rejected" || status === "cancelled") return "destructive";
  return "secondary";
}

export function AdminRegistrationsWorkspace({ rows }: { rows: AdminRegistrationRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminRegistrationRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminRegistrationRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  const submitRemove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startRemoveTransition(() => {
      void removeRegistrationAction(formData).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setRemoveTarget(null);
          router.refresh();
        }
      });
    });
  };

  const columns: Array<AdminDataTableColumn<AdminRegistrationRow>> = [
    {
      id: "registration",
      header: "รายการ",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{row.registrationNo}</p>
          <p className="text-sm text-muted-foreground">{row.learnerName}</p>
          <p className="text-xs text-muted-foreground">{row.learnerEmail}</p>
        </div>
      ),
    },
    {
      id: "courses",
      header: "หลักสูตร",
      className: "max-w-[360px]",
      render: (row) => <p className="line-clamp-3 text-sm leading-6">{row.courseTitles}</p>,
    },
    {
      id: "amount",
      header: "ค่าลงทะเบียน",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{formatBaht(row.totalAmount)}</p>
          {row.discountAmount > 0 && (
            <p className="text-xs text-muted-foreground">ลด {formatBaht(row.discountAmount)}</p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      render: (row) => (
        <div className="grid gap-2">
          <Badge variant={statusVariant(row.status)}>
            {statusLabels[row.status] ?? row.status}
          </Badge>
          {row.paymentStatus && (
            <Badge variant="outline">
              ชำระ: {statusLabels[row.paymentStatus] ?? row.paymentStatus}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[132px] text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setSelected(row)}
                aria-label="จัดการรายการลงทะเบียน"
                title="จัดการรายการลงทะเบียน"
              >
                <Eye className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">จัดการรายการ</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!row.canRemove}
                onClick={() => setRemoveTarget(row)}
                aria-label={row.removeLabel}
                title={row.removeHelp}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {row.removeMode === "cancel" ? (
                  <Ban className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{row.removeHelp}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  const pending = rows.filter(
    (row) => row.status === "pending_review" || row.status === "pending_payment",
  ).length;
  const approved = rows.filter(
    (row) => row.status === "approved" || row.status === "completed",
  ).length;

  return (
    <div className="grid gap-6">
      {actionMessage && (
        <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
          {actionMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">รายการทั้งหมด</p>
            <p className="text-3xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
            <p className="text-3xl font-bold">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">อนุมัติ/เสร็จสิ้น</p>
            <p className="text-3xl font-bold">{approved}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <AdminDataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) =>
              `${row.registrationNo} ${row.learnerName} ${row.learnerEmail} ${row.courseTitles}`
            }
            searchPlaceholder="ค้นหาเลขลงทะเบียน ผู้เรียน หรือหลักสูตร"
            filter={{
              label: "สถานะ",
              getValue: (row) => row.status,
              options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
            }}
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="จัดการรายการลงทะเบียน"
        description="แก้ไขสถานะและบันทึกหมายเหตุเจ้าหน้าที่"
        size="lg"
      >
        {selected && (
          <form action={updateRegistrationStatusAction} className="grid gap-4">
            <input type="hidden" name="registrationId" value={selected.id} />
            <div className="grid gap-3 rounded-lg border bg-secondary/25 p-4">
              <p className="font-semibold">{selected.registrationNo}</p>
              <p className="text-sm text-muted-foreground">
                {selected.learnerName} / {selected.learnerEmail}
              </p>
              <p className="text-sm">{selected.courseTitles}</p>
              <p className="font-semibold">{formatBaht(selected.totalAmount)}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">สถานะ</Label>
              <select
                id="status"
                name="status"
                defaultValue={selected.status}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">หมายเหตุ</Label>
              <Input id="note" name="note" defaultValue={selected.note ?? ""} />
            </div>
            <Button type="submit" className="w-fit">
              <Save className="size-4" />
              บันทึกสถานะ
            </Button>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={
          removeTarget?.removeMode === "cancel"
            ? "ยกเลิกรายการลงทะเบียน"
            : "ลบ/ซ่อนรายการลงทะเบียน"
        }
        description="ระบบจะตรวจสอบประวัติการเรียนและใบประกาศก่อนดำเนินการ เพื่อไม่ให้ข้อมูลสำคัญเสียหาย"
        size="md"
      >
        {removeTarget && (
          <form onSubmit={submitRemove} className="grid gap-4">
            <input type="hidden" name="registrationId" value={removeTarget.id} />
            <div className="grid gap-2 rounded-lg border bg-secondary/25 p-4">
              <p className="font-semibold">{removeTarget.registrationNo}</p>
              <p className="text-sm text-muted-foreground">
                {removeTarget.learnerName} / {removeTarget.learnerEmail}
              </p>
              <p className="text-sm">{removeTarget.courseTitles}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">สิทธิ์เรียน {removeTarget.enrollmentCount}</Badge>
                <Badge variant="outline">เรียนจบ {removeTarget.completedEnrollmentCount}</Badge>
                <Badge variant="outline">ใบประกาศ {removeTarget.certificateCount}</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              {removeTarget.removeHelp}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remove-registration-reason">เหตุผล</Label>
              <textarea
                id="remove-registration-reason"
                name="reason"
                required
                placeholder="เช่น รายการซ้ำจากการทดสอบ ผู้เรียนลงทะเบียนผิดหลักสูตร หรือยกเลิกสิทธิ์ตามคำร้อง"
                className="min-h-24 rounded-md border bg-background p-3 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="destructive" disabled={isRemoving}>
                {removeTarget.removeMode === "cancel" ? (
                  <Ban className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {isRemoving ? "กำลังดำเนินการ..." : removeTarget.removeLabel}
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}
