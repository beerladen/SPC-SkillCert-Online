"use client";

import { type FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import {
  removePaymentAction,
  reviewPaymentAction,
} from "@/app/admin/payments/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBaht } from "@/lib/format";
import type { AdminPaymentRow } from "@/lib/registration-repositories";

const statusLabels: Record<string, string> = {
  pending: "รอหลักฐาน",
  pending_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  refunded: "คืนเงิน",
};

function statusVariant(status: string) {
  if (status === "approved") return "default";
  if (status === "rejected" || status === "refunded") return "destructive";
  return "secondary";
}

export function AdminPaymentsWorkspace({ rows }: { rows: AdminPaymentRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminPaymentRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminPaymentRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  const submitRemove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startRemoveTransition(() => {
      void removePaymentAction(formData).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setRemoveTarget(null);
          router.refresh();
        }
      });
    });
  };

  const columns: Array<AdminDataTableColumn<AdminPaymentRow>> = [
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
      header: "ยอดชำระ",
      render: (row) => <p className="font-semibold">{formatBaht(row.amount)}</p>,
    },
    {
      id: "status",
      header: "สถานะ",
      render: (row) => <Badge variant={statusVariant(row.status)}>{statusLabels[row.status] ?? row.status}</Badge>,
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
                aria-label="ตรวจหลักฐาน"
                title="ตรวจหลักฐาน"
              >
                <Eye className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">ตรวจหลักฐาน</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!row.canRemove}
                onClick={() => setRemoveTarget(row)}
                aria-label="ลบหลักฐาน"
                title={row.removeHelp}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{row.removeHelp}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

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
            <p className="text-sm text-muted-foreground">หลักฐานทั้งหมด</p>
            <p className="text-3xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
            <p className="text-3xl font-bold">
              {rows.filter((row) => row.status === "pending_review").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">อนุมัติแล้ว</p>
            <p className="text-3xl font-bold">
              {rows.filter((row) => row.status === "approved").length}
            </p>
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
        title="ตรวจหลักฐานค่าลงทะเบียน"
        description="อนุมัติแล้วระบบจะสร้างสิทธิ์เข้าเรียนให้อัตโนมัติ"
        size="lg"
      >
        {selected && (
          <form action={reviewPaymentAction} className="grid gap-4">
            <input type="hidden" name="paymentId" value={selected.id} />
            <div className="grid gap-3 rounded-lg border bg-secondary/25 p-4">
              <p className="font-semibold">{selected.registrationNo}</p>
              <p className="text-sm text-muted-foreground">
                {selected.learnerName} / {selected.learnerEmail}
              </p>
              <p className="text-sm">{selected.courseTitles}</p>
              <p className="font-semibold">{formatBaht(selected.amount)}</p>
            </div>

            <div className="grid gap-2">
              <Label>ไฟล์หลักฐาน</Label>
              {selected.evidenceUrls.length > 0 ? (
                <div className="grid gap-2">
                  {selected.evidenceUrls.map((url, index) => (
                    <Button key={url} variant="outline" asChild className="justify-start">
                      <Link href={url} target="_blank">
                        {selected.evidenceNames[index] ?? `หลักฐาน ${index + 1}`}
                      </Link>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  ยังไม่มีไฟล์หลักฐานแนบมา
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">หมายเหตุการตรวจ</Label>
              <textarea id="note" name="note" className="min-h-24 rounded-md border bg-background p-3 text-sm" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="decision" value="approved">
                <CheckCircle2 className="size-4" />
                อนุมัติและเปิดสิทธิ์เรียน
              </Button>
              <Button type="submit" variant="destructive" name="decision" value="rejected">
                <XCircle className="size-4" />
                ไม่อนุมัติ
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="ลบ/ซ่อนหลักฐานชำระเงิน"
        description="ใช้เมื่อผู้เรียนแนบไฟล์ผิด รายการทดสอบ หรือหลักฐานไม่ควรแสดงในคิวตรวจ"
        size="md"
      >
        {removeTarget && (
          <form onSubmit={submitRemove} className="grid gap-4">
            <input type="hidden" name="paymentId" value={removeTarget.id} />
            <div className="grid gap-2 rounded-lg border bg-secondary/25 p-4">
              <p className="font-semibold">{removeTarget.registrationNo}</p>
              <p className="text-sm text-muted-foreground">
                {removeTarget.learnerName} / {removeTarget.learnerEmail}
              </p>
              <p className="text-sm">{removeTarget.courseTitles}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{formatBaht(removeTarget.amount)}</Badge>
                <Badge variant={statusVariant(removeTarget.status)}>
                  {statusLabels[removeTarget.status] ?? removeTarget.status}
                </Badge>
                <Badge variant="outline">ไฟล์ {removeTarget.evidenceUrls.length}</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              {removeTarget.removeHelp}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remove-payment-reason">เหตุผล</Label>
              <textarea
                id="remove-payment-reason"
                name="reason"
                required
                placeholder="เช่น แนบไฟล์ผิด รายการทดสอบ หรือผู้เรียนขอส่งหลักฐานใหม่"
                className="min-h-24 rounded-md border bg-background p-3 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="destructive" disabled={isRemoving}>
                <Trash2 className="size-4" />
                {isRemoving ? "กำลังลบ..." : "ลบหลักฐาน"}
              </Button>
            </div>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}
