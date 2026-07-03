import { Database, FileImage, Moon, Palette, PenLine, Save, ShieldCheck, Sun, SwatchBook } from "lucide-react";
import {
  saveCertificateSignerSettingsAction,
  saveCertificateTemplateAction,
  saveHomeHeroSettingsAction,
  saveSiteSettingsAction,
  saveThemeSettingsAction,
} from "@/app/admin/settings/actions";
import { AdminLayout } from "@/components/layout/admin-layout";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadField } from "@/components/ui/upload-field";
import { getAdminHomeHeroSettings, getAdminSiteSettings } from "@/lib/admin-summary-repositories";
import { requireCurrentUser } from "@/lib/auth";
import { getDefaultCertificateTemplate } from "@/lib/certificate-repositories";
import { getCertificateSignerSettings } from "@/lib/certificate-signer-settings";
import { getDatabaseHealth } from "@/lib/db";
import { getDatabaseSummary } from "@/lib/db-repositories";
import { siteThemePresetOptions } from "@/lib/site-theme";
import { getSiteThemeSettings } from "@/lib/site-theme-repositories";

export const dynamic = "force-dynamic";

function previewBackground(url: string | null) {
  return url ? { backgroundImage: `url(${url})` } : undefined;
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireCurrentUser(["admin"]);
  const [
    { updated },
    databaseHealth,
    databaseSummary,
    site,
    homeHero,
    certificateTemplate,
    certificateSigners,
    theme,
  ] = await Promise.all([
    searchParams,
    getDatabaseHealth(),
    getDatabaseSummary(),
    getAdminSiteSettings(),
    getAdminHomeHeroSettings(),
    getDefaultCertificateTemplate(),
    getCertificateSignerSettings(),
    getSiteThemeSettings(),
  ]);

  const successText =
    updated === "theme"
      ? "บันทึกธีมเว็บไซต์เรียบร้อยแล้ว"
      : updated === "hero"
      ? "บันทึก Hero หน้าแรกเรียบร้อยแล้ว"
      : updated === "certificate"
      ? "บันทึกเทมเพลตใบประกาศและลายเซ็นต์เรียบร้อยแล้ว"
      : updated === "certificate-signers"
      ? "บันทึกข้อมูลผู้ลงนามและลายเซ็นต์สำหรับการอนุมัติใบประกาศเรียบร้อยแล้ว"
      : updated === "site"
        ? "บันทึกข้อมูลเว็บไซต์เรียบร้อยแล้ว"
        : "";

  const signerCards = [
    {
      key: "academic" as const,
      title: "รองผู้อำนวยการฝ่ายวิชาการ",
      description: "ผู้เห็นชอบรายงานเสนออนุมัติเป็นลำดับแรก",
      signer: certificateSigners.academic,
    },
    {
      key: "registrar" as const,
      title: "นายทะเบียน",
      description: "ผู้ตรวจสอบรายชื่อและความถูกต้องของข้อมูลผู้ผ่านการอบรม",
      signer: certificateSigners.registrar,
    },
    {
      key: "director" as const,
      title: "ผู้อำนวยการ",
      description: "ผู้อนุมัติขั้นสุดท้ายก่อนระบบออกใบประกาศนียบัตร",
      signer: certificateSigners.director,
    },
  ];

  return (
    <AdminLayout title="ตั้งค่าเว็บไซต์">
      <div className="grid gap-6">
        {successText && (
          <ActionFeedback variant="success" title="บันทึกสำเร็จ" message={successText} />
        )}

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5 text-primary" />
              ตั้งค่าธีมเว็บไซต์
            </CardTitle>
            <CardDescription>
              เลือกโหมดและโทนสีหลักของเว็บไซต์ ให้ทุกหน้ามีสีคมชัด อ่านง่าย และสอดคล้องกับภาพลักษณ์ของศูนย์อบรม
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveThemeSettingsAction} className="grid gap-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="dark"
                    defaultChecked={theme.mode === "dark"}
                    className="peer sr-only"
                  />
                  <span className="flex h-full items-start gap-3 rounded-lg border bg-background p-4 transition peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-2 peer-checked:ring-primary/30">
                    <span className="rounded-md bg-primary/10 p-2 text-primary">
                      <Moon className="size-5" />
                    </span>
                    <span className="grid gap-1">
                      <span className="font-semibold">โหมดมืด</span>
                      <span className="text-sm text-muted-foreground">
                        พื้นหลังเข้ม ตัวอักษรสว่าง เหมาะกับหน้าจอห้องเรียนและการใช้งานระยะยาว
                      </span>
                    </span>
                  </span>
                </label>

                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="light"
                    defaultChecked={theme.mode === "light"}
                    className="peer sr-only"
                  />
                  <span className="flex h-full items-start gap-3 rounded-lg border bg-background p-4 transition peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-2 peer-checked:ring-primary/30">
                    <span className="rounded-md bg-primary/10 p-2 text-primary">
                      <Sun className="size-5" />
                    </span>
                    <span className="grid gap-1">
                      <span className="font-semibold">โหมดสว่าง</span>
                      <span className="text-sm text-muted-foreground">
                        พื้นหลังขาวนวล อ่านง่าย เหมาะกับงานเอกสาร รายการหลักสูตร และผู้ใช้งานทั่วไป
                      </span>
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <SwatchBook className="size-4 text-primary" />
                  โทนสีหลัก
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {siteThemePresetOptions.map((preset) => (
                    <label key={preset.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="preset"
                        value={preset.value}
                        defaultChecked={theme.preset === preset.value}
                        className="peer sr-only"
                      />
                      <span className="grid h-full gap-3 rounded-lg border bg-background p-4 transition peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-2 peer-checked:ring-primary/30">
                        <span className="flex gap-1">
                          {preset.swatches.map((swatch) => (
                            <span
                              key={swatch}
                              className="h-8 flex-1 rounded-md border"
                              style={{ backgroundColor: swatch }}
                            />
                          ))}
                        </span>
                        <span className="grid gap-1">
                          <span className="font-semibold">{preset.label}</span>
                          <span className="text-xs leading-5 text-muted-foreground">{preset.description}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-fit gap-2">
                <Save className="size-4" />
                บันทึกธีมเว็บไซต์
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <FileImage className="size-5 text-primary" />
              ตั้งค่า Hero หน้าแรก
            </CardTitle>
            <CardDescription>
              จัดการภาพใหญ่ด้านบนหน้าแรก ข้อความหลัก และปุ่มนำทาง ภาพที่เหมาะสมควรเป็นแนวนอน 16:9 เพื่อให้แสดงบนมือถือและคอมพิวเตอร์ได้คมชัด
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveHomeHeroSettingsAction} className="grid gap-5">
              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-secondary/30 p-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input name="enabled" type="checkbox" defaultChecked={homeHero.enabled} />
                  แสดง Hero หน้าแรก
                </label>
                <p className="text-sm text-muted-foreground">
                  หากปิด ระบบจะเริ่มหน้าแรกด้วยข่าวประชาสัมพันธ์เหมือนเวอร์ชันก่อนหน้า
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="heroTitle">หัวข้อหลัก</Label>
                    <Input id="heroTitle" name="title" defaultValue={homeHero.title} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="heroSubtitle">ข้อความสั้น/ชื่อระบบ</Label>
                    <Input id="heroSubtitle" name="subtitle" defaultValue={homeHero.subtitle} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="heroDescription">คำอธิบาย Hero</Label>
                    <textarea
                      id="heroDescription"
                      name="description"
                      className="min-h-28 rounded-md border bg-background p-3 text-sm leading-6"
                      defaultValue={homeHero.description}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="primaryLabel">ข้อความปุ่มหลัก</Label>
                      <Input id="primaryLabel" name="primaryLabel" defaultValue={homeHero.primaryLabel} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="primaryUrl">ลิงก์ปุ่มหลัก</Label>
                      <Input id="primaryUrl" name="primaryUrl" defaultValue={homeHero.primaryUrl} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="secondaryLabel">ข้อความปุ่มรอง</Label>
                      <Input id="secondaryLabel" name="secondaryLabel" defaultValue={homeHero.secondaryLabel} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="secondaryUrl">ลิงก์ปุ่มรอง</Label>
                      <Input id="secondaryUrl" name="secondaryUrl" defaultValue={homeHero.secondaryUrl} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-lg border bg-secondary/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <FileImage className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">ภาพ Hero</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        แนะนำ 1920 x 1080 px หรืออย่างน้อย 1600 x 900 px อัตราส่วน 16:9 รองรับ JPG, PNG, WebP ไม่เกิน 12 MB
                      </p>
                    </div>
                  </div>

                  <UploadField
                    id="heroImageFile"
                    name="heroImageFile"
                    label="อัปโหลดภาพ Hero หน้าแรก"
                    description="ใช้ภาพบุคคล/บรรยากาศเรียนรู้ออนไลน์แนวนอน 16:9 เพื่อให้ไม่ถูกตัดบนหน้าจอกว้าง"
                    accept=".jpg,.jpeg,.png,.webp"
                    allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
                    maxBytes={12 * 1024 * 1024}
                    currentFileName={homeHero.imageUrl ? "ภาพ Hero ปัจจุบัน" : null}
                    currentFileUrl={homeHero.imageUrl}
                  />

                  <div className="grid gap-2">
                    <Label htmlFor="heroImageUrl">URL ภาพ Hero</Label>
                    <Input
                      id="heroImageUrl"
                      name="imageUrl"
                      defaultValue={homeHero.imageUrl}
                      placeholder="/uploads/site/hero/..."
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      หากอัปโหลดไฟล์ใหม่ ระบบจะใช้ไฟล์ที่อัปโหลดแทน URL นี้
                    </p>
                  </div>

                  <div
                    className="aspect-[16/9] overflow-hidden rounded-lg border bg-background bg-cover bg-center"
                    style={previewBackground(homeHero.imageUrl)}
                    aria-label="ตัวอย่างภาพ Hero หน้าแรก"
                  />
                </div>
              </div>

              <Button type="submit" className="w-fit gap-2">
                <Save className="size-4" />
                บันทึก Hero หน้าแรก
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลศูนย์อบรม</CardTitle>
              <CardDescription>ข้อมูลนี้ใช้แสดงบนหน้าเว็บไซต์และเอกสารของระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveSiteSettingsAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">ชื่อเว็บไซต์</Label>
                  <Input id="name" name="name" defaultValue={site.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shortName">ชื่อย่อ</Label>
                  <Input id="shortName" name="shortName" defaultValue={site.shortName} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                    <Input id="phone" name="phone" defaultValue={site.phone} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input id="email" name="email" defaultValue={site.email} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">ที่อยู่</Label>
                  <Input id="address" name="address" defaultValue={site.address} />
                </div>
                <Button className="w-fit gap-2">
                  <Save className="size-4" />
                  บันทึกข้อมูลเว็บไซต์
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>เทมเพลตใบประกาศนียบัตร</CardTitle>
              <CardDescription>
                ตั้งค่าภาพพื้นหลัง A4 แนวนอนและลายเซ็นต์ผู้อำนวยการ ระบบจะนำไปใช้กับใบประกาศที่ตรวจสอบออนไลน์ได้ทันที
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveCertificateTemplateAction} className="grid gap-5">
                <input type="hidden" name="templateId" value={certificateTemplate.id ?? ""} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="templateName">ชื่อเทมเพลต</Label>
                    <Input
                      id="templateName"
                      name="templateName"
                      defaultValue={certificateTemplate.name}
                      placeholder="เทมเพลตใบประกาศหลักของวิทยาลัย"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="issuerName">ชื่อหน่วยงานบนใบประกาศ</Label>
                    <Input
                      id="issuerName"
                      name="issuerName"
                      defaultValue={certificateTemplate.issuerName}
                      placeholder="วิทยาลัยสารพัดช่างสุรินทร์"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signerName">ชื่อผู้ลงนาม</Label>
                    <Input
                      id="signerName"
                      name="signerName"
                      defaultValue={certificateTemplate.signerName}
                      placeholder="เช่น นาย/นาง/นางสาว..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="signerPosition">ตำแหน่งผู้ลงนาม</Label>
                    <Input
                      id="signerPosition"
                      name="signerPosition"
                      defaultValue={certificateTemplate.signerPosition}
                      placeholder="ผู้อำนวยการวิทยาลัย"
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-3 rounded-lg border bg-secondary/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <FileImage className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">ภาพเทมเพลตใบประกาศ</p>
                        <p className="text-sm text-muted-foreground">
                          แนะนำขนาด 3508 x 2480 px หรืออัตราส่วน A4 แนวนอน รองรับ JPG, PNG, WEBP ไม่เกิน 12 MB
                        </p>
                      </div>
                    </div>
                    <UploadField
                      id="backgroundFile"
                      name="backgroundFile"
                      label="อัปโหลดเทมเพลตใบประกาศ"
                      description="ขนาดแนะนำ 3508 x 2480 px หรือ A4 แนวนอน รองรับ JPG, PNG, WebP ไม่เกิน 12 MB"
                      accept=".jpg,.jpeg,.png,.webp"
                      allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
                      maxBytes={12 * 1024 * 1024}
                      currentFileName={certificateTemplate.backgroundUrl ? "เทมเพลตปัจจุบัน" : null}
                      currentFileUrl={certificateTemplate.backgroundUrl}
                    />
                    <Input
                      name="backgroundUrl"
                      defaultValue={certificateTemplate.backgroundUrl ?? ""}
                      placeholder="/uploads/certificates/templates/..."
                    />
                    <div
                      className="aspect-[1.414/1] overflow-hidden rounded-md border bg-white bg-cover bg-center"
                      style={previewBackground(certificateTemplate.backgroundUrl)}
                    />
                  </div>

                  <div className="grid gap-3 rounded-lg border bg-secondary/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <PenLine className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">ลายเซ็นต์ผู้อำนวยการ</p>
                        <p className="text-sm text-muted-foreground">
                          แนะนำ PNG พื้นหลังโปร่งใส ขนาดประมาณ 900 x 260 px ระบบจะวางเหนือตำแหน่งผู้ลงนาม
                        </p>
                      </div>
                    </div>
                    <UploadField
                      id="signatureFile"
                      name="signatureFile"
                      label="อัปโหลดลายเซ็นต์ผู้อำนวยการ"
                      description="แนะนำ PNG พื้นหลังโปร่งใส ประมาณ 900 x 260 px รองรับ JPG, PNG, WebP ไม่เกิน 12 MB"
                      accept=".jpg,.jpeg,.png,.webp"
                      allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
                      maxBytes={12 * 1024 * 1024}
                      currentFileName={certificateTemplate.signatureUrl ? "ลายเซ็นต์ปัจจุบัน" : null}
                      currentFileUrl={certificateTemplate.signatureUrl}
                    />
                    <Input
                      name="signatureUrl"
                      defaultValue={certificateTemplate.signatureUrl ?? ""}
                      placeholder="/uploads/certificates/signatures/..."
                    />
                    <div className="grid min-h-[120px] place-items-center rounded-md border bg-white p-4">
                      {certificateTemplate.signatureUrl ? (
                        <div
                          className="h-24 w-full bg-contain bg-center bg-no-repeat"
                          style={previewBackground(certificateTemplate.signatureUrl)}
                          aria-label="ตัวอย่างลายเซ็นต์ผู้อำนวยการ"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">ยังไม่มีลายเซ็นต์ในระบบ</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <p>รหัสใบประกาศ: SPC-CERT-ปี-เลขลำดับ</p>
                  <p>เงื่อนไขเริ่มต้น: เรียนครบตามเกณฑ์ ส่งงานผ่าน และคะแนนหลังเรียนผ่านเกณฑ์ของหลักสูตร</p>
                  <p>เมื่อเปลี่ยนเทมเพลต ระบบจะแสดงผลกับหน้าใบประกาศที่เปิดดูออนไลน์ทันที</p>
                </div>

                <Button className="w-fit gap-2">
                  <Save className="size-4" />
                  บันทึกเทมเพลตใบประกาศ
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              ข้อมูลผู้ลงนามใบประกาศ
            </CardTitle>
            <CardDescription>
              กำหนดชื่อ ตำแหน่ง และลายเซ็นต์ของรองผู้อำนวยการฝ่ายวิชาการ นายทะเบียน และผู้อำนวยการ
              สำหรับรายงานเสนออนุมัติประกาศนียบัตร ระบบจะแสดงลายเซ็นต์ทันทีเมื่อกดอนุมัติในแต่ละลำดับ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveCertificateSignerSettingsAction} className="grid gap-5">
              <div className="grid gap-4 xl:grid-cols-3">
                {signerCards.map(({ key, title, description, signer }) => (
                  <div key={key} className="grid gap-4 rounded-lg border bg-secondary/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <PenLine className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor={`${key}Name`}>ชื่อ-นามสกุล</Label>
                        <Input
                          id={`${key}Name`}
                          name={`${key}Name`}
                          defaultValue={signer.name}
                          placeholder="เช่น นาย/นาง/นางสาว..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${key}Position`}>ตำแหน่ง</Label>
                        <Input
                          id={`${key}Position`}
                          name={`${key}Position`}
                          defaultValue={signer.position}
                        />
                      </div>
                    </div>

                    <UploadField
                      id={`${key}SignatureFile`}
                      name={`${key}SignatureFile`}
                      label={`อัปโหลดลายเซ็นต์${title}`}
                      description="แนะนำ PNG พื้นหลังโปร่งใส ขนาดประมาณ 900 x 260 px รองรับ JPG, PNG, WebP ไม่เกิน 12 MB"
                      accept=".jpg,.jpeg,.png,.webp"
                      allowedExtensions={[".jpg", ".jpeg", ".png", ".webp"]}
                      maxBytes={12 * 1024 * 1024}
                      currentFileName={signer.signatureUrl ? `ลายเซ็นต์${title}ปัจจุบัน` : null}
                      currentFileUrl={signer.signatureUrl}
                    />
                    <Input
                      name={`${key}SignatureUrl`}
                      defaultValue={signer.signatureUrl ?? ""}
                      placeholder="/uploads/certificates/signatures/..."
                    />
                    <div className="grid min-h-[96px] place-items-center rounded-md border bg-white p-3">
                      {signer.signatureUrl ? (
                        <div
                          className="h-20 w-full bg-contain bg-center bg-no-repeat"
                          style={previewBackground(signer.signatureUrl)}
                          aria-label={`ตัวอย่างลายเซ็นต์${title}`}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">ยังไม่มีลายเซ็นต์ในระบบ</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                <p>ลำดับอนุมัติประกาศนียบัตร: รองผู้อำนวยการฝ่ายวิชาการ → นายทะเบียน → ผู้อำนวยการ</p>
                <p>
                  เมื่อผู้มีสิทธิ์กดอนุมัติ ระบบจะติ๊กช่องอนุมัติในรายงาน และแสดงลายเซ็นต์ของตำแหน่งนั้นทันที
                </p>
              </div>

              <Button className="w-fit gap-2">
                <Save className="size-4" />
                บันทึกข้อมูลผู้ลงนาม
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="size-5 text-primary" />
                  สถานะฐานข้อมูล
                </CardTitle>
                <CardDescription>ตรวจสอบความพร้อมของ XAMPP/MySQL และข้อมูลหลักในระบบ</CardDescription>
              </div>
              <Badge variant={databaseHealth.ok ? "default" : "destructive"}>
                {databaseHealth.ok ? "พร้อมใช้งาน" : "ยังไม่พร้อม"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-2 rounded-lg border p-4">
              <p className="font-medium">{databaseHealth.message}</p>
              <p className="text-muted-foreground">
                ฐานข้อมูล: {databaseHealth.database ?? "-"} / Host: {databaseHealth.host ?? "-"} / ตาราง:{" "}
                {databaseHealth.tableCount ?? 0}
              </p>
            </div>

            {databaseSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">หลักสูตรเปิดรับสมัคร</p>
                  <p className="text-2xl font-bold">{databaseSummary.courses}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">ผู้ใช้งานทั้งหมด</p>
                  <p className="text-2xl font-bold">{databaseSummary.users}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">รอตรวจค่าลงทะเบียน</p>
                  <p className="text-2xl font-bold">{databaseSummary.pendingPayments}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">รอตรวจใบงาน</p>
                  <p className="text-2xl font-bold">{databaseSummary.pendingAssignments}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-muted-foreground">
                ยังอ่านข้อมูลสรุปจากฐานข้อมูลไม่ได้ ให้รันคำสั่งติดตั้งฐานข้อมูลก่อน
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
