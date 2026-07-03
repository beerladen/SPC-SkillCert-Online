"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit, KeyRound, PenLine, Plus, Save, Trash2 } from "lucide-react";
import {
  removeAdminUserAction,
  resetUserPasswordAction,
  saveAdminUserAction,
} from "@/app/admin/users/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadField } from "@/components/ui/upload-field";
import type { AdminUserRow } from "@/lib/user-repositories";

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  instructor: "ครูผู้สอน",
  student: "ผู้เข้าอบรม",
};

const statusLabels: Record<string, string> = {
  active: "ใช้งาน",
  disabled: "ปิดใช้งาน",
  pending: "รอตรวจสอบ",
};

export function AdminUsersWorkspace({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminUserRow | null | "new">(null);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);
  const [removing, setRemoving] = useState<AdminUserRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();

  const submitSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startSaveTransition(() => {
      void saveAdminUserAction(formData).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setEditing(null);
          router.refresh();
        }
      });
    });
  };

  const submitReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startResetTransition(() => {
      void resetUserPasswordAction(formData).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setResetting(null);
          router.refresh();
        }
      });
    });
  };

  const submitRemove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startRemoveTransition(() => {
      void removeAdminUserAction(formData).then((result) => {
        setActionMessage(result.message);
        if (result.ok) {
          setRemoving(null);
          router.refresh();
        }
      });
    });
  };

  const columns: Array<AdminDataTableColumn<AdminUserRow>> = [
    {
      id: "user",
      header: "ผู้ใช้งาน",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{row.name}</p>
          <p className="text-sm text-muted-foreground">{row.email}</p>
          {row.phone && <p className="text-xs text-muted-foreground">{row.phone}</p>}
        </div>
      ),
    },
    {
      id: "role",
      header: "บทบาท",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{roleLabels[row.role]}</Badge>
          {row.isInstructor && <Badge variant="secondary">ครูผู้สอน</Badge>}
          {row.isInstructor && (
            <Badge variant={row.instructorSignatureUrl ? "default" : "outline"}>
              {row.instructorSignatureUrl ? "มีลายเซ็น" : "ยังไม่มีลายเซ็น"}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "สถานะ",
      render: (row) => (
        <Badge variant={row.status === "active" ? "default" : "secondary"}>
          {statusLabels[row.status]}
        </Badge>
      ),
    },
    {
      id: "linkedData",
      header: "ข้อมูลผูก",
      render: (row) => (
        <div className="flex max-w-[360px] flex-wrap gap-1">
          <Badge variant="secondary">ลงทะเบียน {row.registrationCount}</Badge>
          <Badge variant="secondary">เรียน {row.enrollmentCount}</Badge>
          <Badge variant="secondary">ใบประกาศ {row.certificateCount}</Badge>
          {row.courseCount > 0 && <Badge variant="outline">หลักสูตร {row.courseCount}</Badge>}
        </div>
      ),
    },
    {
      id: "lastLogin",
      header: "เข้าระบบล่าสุด",
      render: (row) => <span className="text-sm text-muted-foreground">{row.lastLoginAt}</span>,
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[190px] text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon-sm" title="แก้ไข" onClick={() => setEditing(row)}>
            <Edit className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            title="รีเซ็ตรหัสผ่าน"
            onClick={() => setResetting(row)}
          >
            <KeyRound className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            title={row.removeHelp}
            disabled={!row.canRemove}
            onClick={() => setRemoving(row)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      {actionMessage && (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {actionMessage}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          เพิ่มผู้ใช้งาน
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <AdminDataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => String(row.id)}
            getSearchText={(row) =>
              `${row.name} ${row.email} ${row.phone ?? ""} ${row.role} ${row.isInstructor ? "instructor teacher ครูผู้สอน" : ""}`
            }
            searchPlaceholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือบทบาท"
            filter={{
              label: "บทบาท",
              getValue: (row) => row.role,
              options: Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
            }}
          />
        </CardContent>
      </Card>

      <AdminActionModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "เพิ่มผู้ใช้งาน" : "แก้ไขผู้ใช้งาน"}
        description="กำหนดบทบาทเป็นครูผู้สอนเพื่อให้บัญชีนี้สร้างและจัดการหลักสูตรของตนเองได้"
        size="lg"
      >
        {editing && (
          <form onSubmit={submitSave} encType="multipart/form-data" className="grid gap-4">
            <input type="hidden" name="id" value={editing === "new" ? "" : editing.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing === "new" ? "" : editing.name}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={editing === "new" ? "" : editing.email}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">บทบาท</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue={editing === "new" ? "student" : editing.role}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">สถานะ</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={editing === "new" ? "active" : editing.status}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 rounded-lg border bg-secondary/20 p-4 md:col-span-2">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="isInstructor"
                    defaultChecked={
                      editing === "new" ? false : editing.isInstructor || editing.role === "instructor"
                    }
                    className="mt-1 size-4 rounded border"
                  />
                  <span>
                    <span className="block font-semibold">เป็นครูผู้สอน</span>
                    <span className="text-muted-foreground">
                      ใช้เมื่อบัญชีนี้ต้องถูกเลือกเป็นผู้สอนในหลักสูตร เช่น แอดมินที่สอนเอง
                    </span>
                  </span>
                </label>
                <div className="grid gap-2">
                  <Label htmlFor="instructorPosition">ตำแหน่ง/ความเชี่ยวชาญสำหรับโปรไฟล์ครู</Label>
                  <Input
                    id="instructorPosition"
                    name="instructorPosition"
                    defaultValue={
                      editing === "new" ? "ผู้สอน" : (editing.instructorPosition ?? "ผู้สอน")
                    }
                  />
                </div>
                <input
                  type="hidden"
                  name="instructorSignatureUrl"
                  value={editing === "new" ? "" : (editing.instructorSignatureUrl ?? "")}
                />
                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <PenLine className="size-4 text-primary" />
                      ลายเซ็นครูผู้สอน
                    </div>
                    <div className="mt-3 flex h-24 items-center justify-center rounded-md border bg-secondary/20">
                      {editing !== "new" && editing.instructorSignatureUrl ? (
                        <div
                          aria-label="ลายเซ็นครูผู้สอน"
                          className="h-20 w-[220px] bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${editing.instructorSignatureUrl}")` }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">ยังไม่มีลายเซ็น</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      ใช้แสดงในรายงานรับรองของหลักสูตรที่ครูคนนี้เป็นเจ้าของ
                    </p>
                  </div>
                  <UploadField
                    id="instructorSignatureFile"
                    name="instructorSignatureFile"
                    label="อัปโหลดลายเซ็นครู"
                    description="แนะนำ PNG พื้นหลังโปร่งใส อัตราส่วนแนวนอน ขนาดประมาณ 800x240 พิกเซล"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    allowedExtensions={[".png", ".jpg", ".jpeg", ".webp"]}
                    maxBytes={12 * 1024 * 1024}
                    currentFileName={
                      editing !== "new" && editing.instructorSignatureUrl
                        ? "ลายเซ็นปัจจุบัน"
                        : null
                    }
                    currentFileUrl={
                      editing !== "new" ? editing.instructorSignatureUrl : null
                    }
                    isPending={isSaving}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={editing === "new" ? "" : (editing.phone ?? "")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="citizenId">เลขบัตรประชาชน</Label>
                <Input
                  id="citizenId"
                  name="citizenId"
                  defaultValue={editing === "new" ? "" : (editing.citizenId ?? "")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">ที่อยู่</Label>
              <textarea
                id="address"
                name="address"
                className="min-h-20 rounded-md border bg-background p-3 text-sm"
                defaultValue={editing === "new" ? "" : (editing.address ?? "")}
              />
            </div>
            {editing === "new" && (
              <div className="grid gap-2">
                <Label htmlFor="password">รหัสผ่านเริ่มต้น</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  เพื่อความปลอดภัย ระบบจะไม่เติมรหัสผ่านเริ่มต้นให้อัตโนมัติ
                </p>
              </div>
            )}
            <Button type="submit" className="w-fit" disabled={isSaving}>
              <Save className="size-4" />
              {isSaving ? "กำลังบันทึก..." : "บันทึกผู้ใช้งาน"}
            </Button>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(resetting)}
        onOpenChange={(open) => !open && setResetting(null)}
        title="รีเซ็ตรหัสผ่าน"
        description="ระบบจะลบ session เดิมของผู้ใช้งานนี้หลังรีเซ็ตรหัสผ่าน"
      >
        {resetting && (
          <form onSubmit={submitReset} className="grid gap-4">
            <input type="hidden" name="id" value={resetting.id} />
            <p className="text-sm text-muted-foreground">
              {resetting.name} / {resetting.email}
            </p>
            <div className="grid gap-2">
              <Label htmlFor="password">รหัสผ่านใหม่</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                required
              />
            </div>
            <Button type="submit" className="w-fit" disabled={isResetting}>
              <KeyRound className="size-4" />
              {isResetting ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
            </Button>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="ลบสมาชิก"
        description="ระบบจะลบสมาชิกออกจากฐานข้อมูลถาวร พร้อมลบประวัติสมัครและการเรียนที่ยังไม่ออกใบประกาศ เพื่อให้อีเมลและเบอร์โทรสมัครใหม่ได้"
      >
        {removing && (
          <form onSubmit={submitRemove} className="grid gap-4">
            <input type="hidden" name="id" value={removing.id} />
            <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
              <p className="font-semibold">{removing.name}</p>
              <p className="text-muted-foreground">{removing.email}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="secondary">ลงทะเบียน {removing.registrationCount}</Badge>
                <Badge variant="secondary">เรียน {removing.enrollmentCount}</Badge>
                <Badge variant="secondary">ใบประกาศ {removing.certificateCount}</Badge>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="removeReason">เหตุผล</Label>
              <textarea
                id="removeReason"
                name="reason"
                className="min-h-24 rounded-md border bg-background p-3 text-sm"
                defaultValue="ปิดบัญชีตามคำขอ/ปรับปรุงรายการสมาชิก"
                required
              />
            </div>
            <Button type="submit" variant="destructive" className="w-fit" disabled={isRemoving}>
              <Trash2 className="size-4" />
              {isRemoving ? "กำลังลบ..." : "ยืนยันลบสมาชิก"}
            </Button>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}
