"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { AuthLogo } from "@/components/auth/auth-logo";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, {});
  const canSubmit = Boolean(token) && !state.success;

  return (
    <Card className="border bg-card/95 shadow-sm">
      <CardHeader className="flex flex-col gap-6">
        <AuthLogo />
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-extrabold tracking-normal">
            ตั้งรหัสผ่านใหม่
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            ลิงก์รีเซ็ตรหัสผ่านใช้ได้ครั้งเดียวและหมดอายุภายใน 30 นาที
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          {!token && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              ไม่พบ token สำหรับรีเซ็ตรหัสผ่าน กรุณาขอลิงก์ใหม่อีกครั้ง
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">รหัสผ่านใหม่</Label>
            <PasswordInput
              name="password"
              placeholder="ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร"
              disabled={!canSubmit}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
            <PasswordInput
              name="confirmPassword"
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              disabled={!canSubmit}
              required
            />
          </div>

          {state.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{state.success}</span>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={!canSubmit || isPending}>
            {isPending ? "กำลังตั้งรหัสผ่านใหม่..." : "ตั้งรหัสผ่านใหม่"}
            <KeyRound data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/signin" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" />
          กลับไปเข้าสู่ระบบ
        </Link>
      </CardFooter>
    </Card>
  );
}
