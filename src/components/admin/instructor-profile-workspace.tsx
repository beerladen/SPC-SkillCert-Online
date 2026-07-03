"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PenLine, Save } from "lucide-react";
import { saveOwnInstructorProfileAction } from "@/app/admin/profile/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadField } from "@/components/ui/upload-field";
import type { InstructorOwnProfile } from "@/lib/user-repositories";

export function InstructorProfileWorkspace({
  profile,
}: {
  profile: InstructorOwnProfile | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      void saveOwnInstructorProfileAction(formData).then((result) => {
        setMessage(result.message);
        if (result.ok) router.refresh();
      });
    });
  };

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            บัญชีนี้ยังไม่ได้เปิดสถานะเป็นครูผู้สอน จึงยังอัปโหลดลายเซ็นเจ้าของหลักสูตรไม่ได้
            กรุณาให้ผู้ดูแลระบบกำหนดบัญชีนี้เป็นครูผู้สอนในเมนูผู้ใช้งานก่อน
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {message && (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>โปรไฟล์ผู้สอนและลายเซ็นเจ้าของหลักสูตร</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              ระบบจะใช้ลายเซ็นนี้ในรายงานรับรองของหลักสูตรที่คุณเป็นเจ้าของหรือผู้สอนร่วม
            </p>
          </div>
          <Badge variant={profile.signatureUrl ? "default" : "secondary"}>
            {profile.signatureUrl ? "มีลายเซ็นแล้ว" : "ยังไม่มีลายเซ็น"}
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitForm} encType="multipart/form-data" className="grid gap-5">
            <input type="hidden" name="signatureUrl" value={profile.signatureUrl ?? ""} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="displayName">ชื่อที่ใช้แสดงในรายงาน</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  defaultValue={profile.displayName || profile.userName}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="position">ตำแหน่ง/หน้าที่</Label>
                <Input
                  id="position"
                  name="position"
                  defaultValue={profile.position ?? "ผู้สอน"}
                  placeholder="เช่น ครูผู้รับผิดชอบหลักสูตร"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bio">ประวัติย่อหรือความเชี่ยวชาญ</Label>
              <textarea
                id="bio"
                name="bio"
                className="min-h-24 rounded-md border bg-background p-3 text-sm"
                defaultValue={profile.bio ?? ""}
                placeholder="ใช้แสดงในหน้าโปรไฟล์ผู้สอนหรือรายงานที่เกี่ยวข้อง"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="rounded-lg border bg-secondary/20 p-4">
                <div className="flex items-center gap-2">
                  <PenLine className="size-4 text-primary" />
                  <p className="font-medium">ตัวอย่างลายเซ็น</p>
                </div>
                <div className="mt-4 flex h-32 items-center justify-center rounded-md border bg-background">
                  {profile.signatureUrl ? (
                    <div
                      aria-label="ลายเซ็นครูผู้สอน"
                      className="h-24 w-[260px] bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${profile.signatureUrl}")` }}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">ยังไม่มีลายเซ็น</span>
                  )}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  แนะนำไฟล์ PNG พื้นหลังโปร่งใส อัตราส่วนแนวนอน ขนาดประมาณ 800x240 พิกเซล
                </p>
              </div>

              <UploadField
                id="signatureFile"
                name="signatureFile"
                label="อัปโหลดลายเซ็นครูผู้สอน"
                description="รองรับ PNG, JPG, WebP ขนาดไม่เกิน 12 MB ควรใช้พื้นหลังโปร่งใสเพื่อแสดงบนเอกสารได้สวย"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                allowedExtensions={[".png", ".jpg", ".jpeg", ".webp"]}
                maxBytes={12 * 1024 * 1024}
                currentFileName={profile.signatureUrl ? "ลายเซ็นปัจจุบัน" : null}
                currentFileUrl={profile.signatureUrl}
                isPending={isPending}
              />
            </div>

            <Button type="submit" className="w-fit" disabled={isPending}>
              {isPending ? (
                <>
                  <Save className="size-4" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  บันทึกโปรไฟล์ผู้สอน
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
