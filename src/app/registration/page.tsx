import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Banknote, CheckCircle2, ClipboardCheck, Clock3, LogIn } from "lucide-react";
import { createRegistrationAction } from "@/app/registration/actions";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UploadField } from "@/components/ui/upload-field";
import { getCurrentUser } from "@/lib/auth";
import { formatBaht } from "@/lib/format";
import {
  getExistingCourseRegistrationState,
  getRegistrationCourseOptions,
} from "@/lib/registration-repositories";

export const dynamic = "force-dynamic";

const steps = [
  "เจ้าหน้าที่ตรวจสอบหลักฐานค่าลงทะเบียน",
  "เมื่ออนุมัติแล้วระบบเปิดสิทธิ์เข้าเรียนอัตโนมัติ",
  "ผู้เข้าอบรมเข้าเรียน ทำแบบทดสอบ และส่งงานผ่านระบบ",
];

const freeCourseSteps = [
  "ยืนยันหลักสูตรที่ไม่มีค่าลงทะเบียน",
  "ระบบเปิดสิทธิ์เข้าห้องเรียนให้อัตโนมัติทันที",
  "เริ่ม Pre-test เรียนออนไลน์ ส่งงาน และทำ Post-test ตาม Flow",
];

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; success?: string; duplicate?: string; status?: string; no?: string }>;
}) {
  const [{ course: selectedSlug, success, duplicate, status, no }, user, courses] = await Promise.all([
    searchParams,
    getCurrentUser().catch(() => null),
    getRegistrationCourseOptions(),
  ]);

  const selectedCourse =
    courses.find((course) => course.slug === selectedSlug) ?? courses[0] ?? null;
  const selectedCourseIsFree = Boolean(selectedCourse && selectedCourse.registrationFee <= 0);
  const existingRegistrationState =
    user && selectedCourse
      ? await getExistingCourseRegistrationState({ userId: user.id, courseId: selectedCourse.id })
      : null;
  const existingHasClassroomAccess = Boolean(
    existingRegistrationState?.enrollmentId ||
      ["approved", "completed"].includes(existingRegistrationState?.registrationStatus ?? ""),
  );
  const existingClassroomHref =
    existingRegistrationState?.enrollmentId && selectedCourse ? `/my-learning/${selectedCourse.slug}` : "/my-learning";
  const currentSteps = selectedCourseIsFree ? freeCourseSteps : steps;
  const successTitle =
    status === "pending_payment"
      ? "บันทึกรายการลงทะเบียนแล้ว"
      : "ส่งรายการลงทะเบียนสำเร็จ";
  const successMessage =
    status === "pending_payment"
      ? "ระบบบันทึกรายการของคุณแล้ว กรุณาชำระค่าลงทะเบียนและแนบหลักฐานเพื่อให้เจ้าหน้าที่ตรวจสอบ"
      : "ระบบได้รับรายการและหลักฐานค่าลงทะเบียนแล้ว อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบและเปิดสิทธิ์เข้าเรียน";
  const duplicateTitle =
    status === "pending_payment"
      ? "คุณมีรายการลงทะเบียนหลักสูตรนี้อยู่แล้ว"
      : "รายการลงทะเบียนหลักสูตรนี้อยู่ระหว่างดำเนินการ";
  const duplicateMessage =
    status === "pending_payment"
      ? "ระบบไม่สร้างรายการซ้ำ กรุณาชำระค่าลงทะเบียนหรือแนบหลักฐานในรายการเดิมเพื่อให้เจ้าหน้าที่ตรวจสอบ"
      : "ระบบไม่สร้างรายการซ้ำ เพราะมีรายการเดิมที่รอเจ้าหน้าที่ตรวจสอบหรืออนุมัติอยู่แล้ว";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <section className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold">รายการลงทะเบียน</h1>
            <p className="mt-2 text-muted-foreground">
              {selectedCourseIsFree
                ? "ยืนยันหลักสูตรที่ไม่มีค่าลงทะเบียน ระบบจะเปิดสิทธิ์เข้าเรียนทันที"
                : "ยืนยันหลักสูตรและแนบหลักฐานค่าลงทะเบียน เพื่อให้เจ้าหน้าที่ตรวจสอบและเปิดสิทธิ์เข้าเรียน"}
            </p>
          </div>

          {success && (
            <Card className="overflow-hidden border-primary/30 bg-primary/5 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {status === "pending_payment" ? <Clock3 className="size-6" /> : <CheckCircle2 className="size-6" />}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">{successTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{successMessage}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>เลขอ้างอิง #{success}</Badge>
                      {no && <Badge variant="outline">{no}</Badge>}
                      <Badge variant="secondary">
                        {status === "pending_payment" ? "รอชำระค่าลงทะเบียน" : "รอตรวจสอบ"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/my-learning">ดูหลักสูตรของฉัน</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {duplicate && (
            <Card className="overflow-hidden border-amber-300 bg-amber-50 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                    <Clock3 className="size-6" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-amber-950">{duplicateTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-amber-900/80">{duplicateMessage}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">เลขอ้างอิง #{duplicate}</Badge>
                      {no && <Badge variant="outline">{no}</Badge>}
                      <Badge variant="secondary">
                        {status === "pending_payment" ? "รอชำระค่าลงทะเบียน" : "รอตรวจสอบ"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/my-learning">ดูหลักสูตรของฉัน</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!user ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <LogIn className="size-10 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">กรุณาเข้าสู่ระบบก่อนลงทะเบียน</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    ระบบต้องผูกข้อมูลลงทะเบียนกับบัญชีสมาชิก เพื่อเปิดสิทธิ์เข้าเรียนและออกใบประกาศได้ถูกต้อง
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/signin">เข้าสู่ระบบ</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/signup">สมัครสมาชิก</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedCourse && existingRegistrationState ? (
            <Card className="overflow-hidden border-primary/30 bg-primary/5 shadow-sm">
              <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {existingHasClassroomAccess ? <CheckCircle2 className="size-6" /> : <Clock3 className="size-6" />}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {existingHasClassroomAccess ? "คุณลงทะเบียนหลักสูตรนี้แล้ว" : "มีรายการลงทะเบียนหลักสูตรนี้อยู่แล้ว"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {existingHasClassroomAccess
                        ? "ระบบเปิดสิทธิ์เข้าห้องเรียนแล้ว จึงไม่สร้างรายการลงทะเบียนซ้ำ"
                        : "ระบบพบรายการเดิมที่อยู่ระหว่างดำเนินการ จึงป้องกันการส่งข้อมูลซ้ำเพื่อไม่ให้เจ้าหน้าที่ตรวจหลายรายการ"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedCourse.title}</Badge>
                      {existingRegistrationState.registrationNo && (
                        <Badge variant="outline">{existingRegistrationState.registrationNo}</Badge>
                      )}
                      {existingRegistrationState.registrationStatus && (
                        <Badge>{existingRegistrationState.registrationStatus}</Badge>
                      )}
                      {existingRegistrationState.paymentStatus && (
                        <Badge variant="outline">ชำระ: {existingRegistrationState.paymentStatus}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {existingHasClassroomAccess && (
                    <Button asChild>
                      <Link href={existingClassroomHref}>เข้าห้องเรียน</Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link href="/my-learning">ดูหลักสูตรของฉัน</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedCourse ? (
            <form action={createRegistrationAction} className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>หลักสูตรที่ลงทะเบียน</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-md bg-muted md:aspect-square">
                    {selectedCourse.coverImageUrl && (
                      <Image
                        src={selectedCourse.coverImageUrl}
                        alt={selectedCourse.title}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="courseId">เลือกหลักสูตร</Label>
                      <select
                        id="courseId"
                        name="courseId"
                        defaultValue={selectedCourse.id}
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">ค่าลงทะเบียน {formatBaht(selectedCourse.registrationFee)}</Badge>
                      {selectedCourse.originalFee && (
                        <Badge variant="outline">ราคาเดิม {formatBaht(selectedCourse.originalFee)}</Badge>
                      )}
                      {selectedCourse.promotionName && (
                        <Badge>โปรโมชัน {selectedCourse.promotionName}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ข้อมูลผู้เข้าอบรม</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Input value={user.name} readOnly />
                  <Input value={user.email} readOnly />
                  <Input value={user.phone ?? ""} readOnly placeholder="เบอร์โทรศัพท์" />
                  <Input value={user.citizenId ?? ""} readOnly placeholder="เลขบัตรประชาชน" />
                </CardContent>
              </Card>

              {selectedCourseIsFree ? (
                <Card className="border-primary/25 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="size-5 text-primary" />
                      หลักสูตรไม่มีค่าลงทะเบียน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                    <p>
                      เมื่อกดยืนยัน ระบบจะบันทึกรายการลงทะเบียน เปิดสิทธิ์เข้าเรียนให้อัตโนมัติ
                      และนำคุณเข้าสู่ห้องเรียนออนไลน์ทันที
                    </p>
                    <input type="hidden" name="method" value="waived" />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>ชำระค่าลงทะเบียน</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-5 md:grid-cols-[1fr_260px]">
                    <div className="rounded-lg border bg-secondary/40 p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                          <Banknote className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold">แนบหลักฐานค่าลงทะเบียน</p>
                          <p className="text-sm text-muted-foreground">
                            รองรับไฟล์ภาพหรือ PDF ขนาดไม่เกินที่ระบบ Next.js ตั้งไว้
                          </p>
                        </div>
                      </div>
                      <Separator className="my-5" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="method">ช่องทางชำระ</Label>
                          <select id="method" name="method" className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
                            <option value="bank_transfer">โอนธนาคาร</option>
                            <option value="promptpay">พร้อมเพย์</option>
                            <option value="cash">เงินสด</option>
                            <option value="waived">ยกเว้นค่าลงทะเบียน</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="paidAt">วันเวลาชำระ</Label>
                          <Input id="paidAt" name="paidAt" type="datetime-local" className="mt-2" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Label htmlFor="note">หมายเหตุถึงเจ้าหน้าที่</Label>
                        <textarea
                          id="note"
                          name="note"
                          className="mt-2 min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                          placeholder="เช่น ชื่อบัญชีผู้โอน หรือรายละเอียดเพิ่มเติม"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border p-5">
                      <p className="font-medium">หลักฐานค่าลงทะเบียน</p>
                      <UploadField
                        name="paymentEvidence"
                        label="หลักฐานค่าลงทะเบียน"
                        description="แนบสลิปภาพหรือ PDF เพื่อให้เจ้าหน้าที่ตรวจสอบ"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/*"
                        allowedExtensions={[".jpg", ".jpeg", ".png", ".webp", ".pdf"]}
                        maxBytes={8 * 1024 * 1024}
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        หากยังไม่แนบหลักฐาน ระบบจะบันทึกเป็นรอชำระค่าลงทะเบียน
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button type="submit" size="lg" className="w-fit">
                {selectedCourseIsFree ? "ยืนยันและเข้าห้องเรียนทันที" : "ยืนยันการลงทะเบียน"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </form>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                ยังไม่มีหลักสูตรที่เปิดรับสมัคร
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:h-fit">
          <Card>
            <CardHeader>
              <CardTitle>สรุปค่าลงทะเบียน</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex justify-between text-sm">
                <span>ราคาเดิม</span>
                <span>{selectedCourse ? formatBaht(selectedCourse.originalFee ?? selectedCourse.registrationFee) : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>ส่วนลด</span>
                <span>
                  {selectedCourse
                    ? formatBaht(Math.max(0, (selectedCourse.originalFee ?? selectedCourse.registrationFee) - selectedCourse.registrationFee))
                    : "-"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>ยอดชำระ</span>
                <span>{selectedCourse ? formatBaht(selectedCourse.registrationFee) : "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                ขั้นตอนหลังยืนยัน
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {currentSteps.map((step, index) => (
                <p key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-primary">{index + 1}</span>
                  {step}
                </p>
              ))}
              <Button variant="outline" asChild>
                <Link href="/my-learning">ดูหลักสูตรของฉัน</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
