"use client";

import { useMemo, useState } from "react";
import { Edit, ListTree, Plus, Save, Trash2 } from "lucide-react";
import {
  deleteAdminNavigationItemAction,
  deleteAdminNavigationSectionAction,
  saveAdminNavigationItemAction,
  saveAdminNavigationSectionAction,
} from "@/app/admin/navigation/actions";
import { AdminActionModal } from "@/components/admin/admin-action-modal";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSidebarIcon,
  sidebarIconOptions,
} from "@/components/layout/sidebar/icon-registry";
import type {
  AdminNavigationItem,
  AdminNavigationSection,
} from "@/lib/admin-navigation-repositories";
import type { UserRole } from "@/lib/auth";

type SectionEditorState = AdminNavigationSection | "new" | null;
type ItemEditorState = AdminNavigationItem | "new" | null;

const roleLabels: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  instructor: "ผู้สอน",
  student: "ผู้เรียน",
};

const statusLabels = {
  active: "แสดง",
  inactive: "ซ่อน",
};

const badgeLabels: Record<string, string> = {
  pendingRegistrations: "จำนวนรายการลงทะเบียนรอตรวจ",
  pendingPayments: "จำนวนหลักฐานชำระเงินรอตรวจ",
};

export function AdminNavigationWorkspace({
  sections,
  items,
}: {
  sections: AdminNavigationSection[];
  items: AdminNavigationItem[];
}) {
  const [editingSection, setEditingSection] = useState<SectionEditorState>(null);
  const [deletingSection, setDeletingSection] = useState<AdminNavigationSection | null>(null);
  const [editingItem, setEditingItem] = useState<ItemEditorState>(null);
  const [deletingItem, setDeletingItem] = useState<AdminNavigationItem | null>(null);

  const sectionOptions = useMemo(
    () => sections.map((section) => ({
      value: String(section.id),
      label: section.title ? `${section.title} (${section.code})` : `เมนูหลัก (${section.code})`,
    })),
    [sections],
  );

  const sectionColumns: Array<AdminDataTableColumn<AdminNavigationSection>> = [
    {
      id: "section",
      header: "กลุ่มเมนู",
      render: (row) => (
        <div className="grid gap-1">
          <p className="font-semibold">{row.title ?? "เมนูหลัก"}</p>
          <p className="text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      id: "sort",
      header: "ลำดับ",
      className: "w-24",
      render: (row) => row.sortOrder,
    },
    {
      id: "items",
      header: "รายการ",
      className: "w-24",
      render: (row) => <Badge variant="outline">{row.itemCount}</Badge>,
    },
    {
      id: "status",
      header: "สถานะ",
      className: "w-28",
      render: (row) => <Badge variant={row.status === "active" ? "default" : "secondary"}>{statusLabels[row.status]}</Badge>,
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[120px] text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon-sm" title="แก้ไขกลุ่มเมนู" onClick={() => setEditingSection(row)}>
            <Edit className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" title="ลบกลุ่มเมนู" onClick={() => setDeletingSection(row)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const itemColumns: Array<AdminDataTableColumn<AdminNavigationItem>> = [
    {
      id: "item",
      header: "เมนู",
      render: (row) => {
        const Icon = getSidebarIcon(row.iconKey);
        return (
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-md bg-primary/10 p-2 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{row.title}</p>
              <p className="truncate text-xs text-muted-foreground">{row.href}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "section",
      header: "กลุ่ม",
      render: (row) => <span className="text-sm">{row.sectionTitle ?? "เมนูหลัก"}</span>,
    },
    {
      id: "roles",
      header: "สิทธิ์",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.allowedRoles.map((role) => (
            <Badge key={role} variant="outline">{roleLabels[role]}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: "badge",
      header: "Badge",
      render: (row) => row.badgeKey ? <Badge variant="secondary">{badgeLabels[row.badgeKey]}</Badge> : <span className="text-sm text-muted-foreground">ไม่มี</span>,
    },
    {
      id: "status",
      header: "สถานะ",
      className: "w-28",
      render: (row) => <Badge variant={row.status === "active" ? "default" : "secondary"}>{statusLabels[row.status]}</Badge>,
    },
    {
      id: "sort",
      header: "ลำดับ",
      className: "w-20",
      render: (row) => row.sortOrder,
    },
    {
      id: "actions",
      header: "จัดการ",
      className: "w-[120px] text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon-sm" title="แก้ไขเมนู" onClick={() => setEditingItem(row)}>
            <Edit className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" title="ลบเมนู" onClick={() => setDeletingItem(row)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListTree className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">จัดการเมนูหลังบ้าน</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                เพิ่ม ลบ แก้ไข ซ่อน แสดง และกำหนดสิทธิ์เมนูใน Sidebar ของแอดมินได้จากหน้านี้
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditingSection("new")}>
              <Plus className="size-4" />
              เพิ่มกลุ่ม
            </Button>
            <Button onClick={() => setEditingItem("new")}>
              <Plus className="size-4" />
              เพิ่มเมนู
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>กลุ่มเมนู</CardTitle>
            <CardDescription>ใช้จัดหมวด เช่น หลักสูตร ลงทะเบียน ระบบ และเมนูล่าง</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={sections}
              columns={sectionColumns}
              getRowKey={(row) => String(row.id)}
              getSearchText={(row) => `${row.title ?? ""} ${row.code} ${row.status}`}
              searchPlaceholder="ค้นหากลุ่มเมนู"
              pageSize={8}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รายการเมนู</CardTitle>
            <CardDescription>URL ควรตรงกับหน้าที่มีอยู่จริง เช่น /admin/reports</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminDataTable
              rows={items}
              columns={itemColumns}
              getRowKey={(row) => String(row.id)}
              getSearchText={(row) => `${row.title} ${row.href} ${row.sectionTitle ?? ""} ${row.allowedRoles.join(" ")}`}
              searchPlaceholder="ค้นหาเมนู URL หรือสิทธิ์"
              filter={{
                label: "สถานะ",
                getValue: (row) => row.status,
                options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
              }}
              pageSize={8}
            />
          </CardContent>
        </Card>
      </div>

      <AdminActionModal
        open={Boolean(editingSection)}
        onOpenChange={(open) => !open && setEditingSection(null)}
        title={editingSection === "new" ? "เพิ่มกลุ่มเมนู" : "แก้ไขกลุ่มเมนู"}
        description="กลุ่มที่ไม่มีชื่อจะแสดงเป็นเมนูหลักด้านบนสุด ส่วนกลุ่ม code bottom จะแสดงด้านล่าง"
      >
        {editingSection && (
          <SectionForm section={editingSection} />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
        title={editingItem === "new" ? "เพิ่มเมนู" : "แก้ไขเมนู"}
        description="เลือกกลุ่ม ไอคอน และสิทธิ์ผู้ใช้งานที่เห็นเมนูนี้"
        size="lg"
      >
        {editingItem && (
          <ItemForm item={editingItem} sections={sectionOptions} />
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(deletingSection)}
        onOpenChange={(open) => !open && setDeletingSection(null)}
        title="ลบกลุ่มเมนู"
        description="ลบได้เมื่อไม่มีรายการเมนูอยู่ในกลุ่มนี้"
      >
        {deletingSection && (
          <form action={deleteAdminNavigationSectionAction} className="grid gap-4">
            <input type="hidden" name="id" value={deletingSection.id} />
            <p className="text-sm text-muted-foreground">
              ต้องการลบกลุ่ม {deletingSection.title ?? deletingSection.code} ใช่หรือไม่
            </p>
            <Button type="submit" variant="destructive" className="w-fit">
              <Trash2 className="size-4" />
              ลบกลุ่มเมนู
            </Button>
          </form>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="ลบรายการเมนู"
        description="เมนูจะหายจาก Sidebar ทันทีหลังบันทึก"
      >
        {deletingItem && (
          <form action={deleteAdminNavigationItemAction} className="grid gap-4">
            <input type="hidden" name="id" value={deletingItem.id} />
            <p className="text-sm text-muted-foreground">
              ต้องการลบเมนู {deletingItem.title} ({deletingItem.href}) ใช่หรือไม่
            </p>
            <Button type="submit" variant="destructive" className="w-fit">
              <Trash2 className="size-4" />
              ลบเมนู
            </Button>
          </form>
        )}
      </AdminActionModal>
    </div>
  );
}

function SectionForm({ section }: { section: AdminNavigationSection | "new" }) {
  return (
    <form action={saveAdminNavigationSectionAction} className="grid gap-4">
      <input type="hidden" name="id" value={section === "new" ? "" : section.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="code">รหัสกลุ่ม</Label>
          <Input id="code" name="code" defaultValue={section === "new" ? "" : section.code} placeholder="เช่น system" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="title">ชื่อกลุ่ม</Label>
          <Input id="title" name="title" defaultValue={section === "new" ? "" : section.title ?? ""} placeholder="เว้นว่างได้สำหรับเมนูหลัก" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sortOrder">ลำดับ</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={section === "new" ? 10 : section.sortOrder} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">สถานะ</Label>
          <select id="status" name="status" defaultValue={section === "new" ? "active" : section.status} className="h-10 rounded-md border bg-background px-3 text-sm">
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <Button type="submit" className="w-fit">
        <Save className="size-4" />
        บันทึกกลุ่มเมนู
      </Button>
    </form>
  );
}

function ItemForm({
  item,
  sections,
}: {
  item: AdminNavigationItem | "new";
  sections: Array<{ value: string; label: string }>;
}) {
  const selectedRoles = item === "new" ? ["admin", "staff"] : item.allowedRoles;

  return (
    <form action={saveAdminNavigationItemAction} className="grid gap-4">
      <input type="hidden" name="id" value={item === "new" ? "" : item.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sectionId">กลุ่มเมนู</Label>
          <select id="sectionId" name="sectionId" defaultValue={item === "new" ? sections[0]?.value : String(item.sectionId ?? "")} className="h-10 rounded-md border bg-background px-3 text-sm" required>
            {sections.map((section) => <option key={section.value} value={section.value}>{section.label}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="title">ชื่อเมนู</Label>
          <Input id="title" name="title" defaultValue={item === "new" ? "" : item.title} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="href">URL</Label>
          <Input id="href" name="href" defaultValue={item === "new" ? "/admin/" : item.href} placeholder="/admin/reports" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="iconKey">ไอคอน</Label>
          <select id="iconKey" name="iconKey" defaultValue={item === "new" ? "Circle" : item.iconKey} className="h-10 rounded-md border bg-background px-3 text-sm">
            {sidebarIconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="badgeKey">Badge จำนวนแจ้งเตือน</Label>
          <select id="badgeKey" name="badgeKey" defaultValue={item === "new" ? "" : item.badgeKey ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">ไม่มี</option>
            {Object.entries(badgeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sortOrder">ลำดับ</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={item === "new" ? 10 : item.sortOrder} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">สถานะ</Label>
          <select id="status" name="status" defaultValue={item === "new" ? "active" : item.status} className="h-10 rounded-md border bg-background px-3 text-sm">
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>สิทธิ์ที่มองเห็นเมนู</Label>
        <div className="flex flex-wrap gap-3 rounded-lg border p-3">
          {Object.entries(roleLabels).map(([role, label]) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input name="roles" value={role} type="checkbox" defaultChecked={selectedRoles.includes(role as UserRole)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-fit">
        <Save className="size-4" />
        บันทึกเมนู
      </Button>
    </form>
  );
}
