"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/(auth)/actions";
import { AuthLogo } from "@/components/auth/auth-logo";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, {});

  return (
    <Card className="border bg-card/95 shadow-sm">
      <CardHeader className="flex flex-col gap-6">
        <AuthLogo />
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-extrabold tracking-normal">
            สมัครสมาชิกผู้เข้าอบรม
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            สร้างบัญชีเพื่อใช้ลงทะเบียนค่าลงทะเบียน เข้าเรียน ส่งงาน และรับใบประกาศ
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">ชื่อ-นามสกุล</Label>
            <Input id="name" name="name" placeholder="ชื่อผู้เข้าอบรม" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" name="email" type="email" placeholder="learner@spc.ac.th" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
            <Input id="phone" name="phone" placeholder="08x-xxx-xxxx" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <PasswordInput placeholder="ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร" required />
          </div>

          {state.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? "กำลังสร้างบัญชี..." : "สมัครสมาชิก"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        มีบัญชีแล้ว{" "}
        <Link href="/signin" className="ml-1 font-medium text-primary hover:underline">
          เข้าสู่ระบบ
        </Link>
      </CardFooter>
    </Card>
  );
}
