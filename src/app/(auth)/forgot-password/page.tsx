"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { AuthLogo } from "@/components/auth/auth-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, {});

  return (
    <Card className="border bg-card/95 shadow-sm">
      <CardHeader className="flex flex-col gap-6">
        <AuthLogo />
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-extrabold tracking-normal">
            ลืมรหัสผ่าน
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            กรอกอีเมลบัญชีผู้ใช้งาน ระบบทดสอบจะให้ผู้ดูแลรีเซ็ตรหัสผ่านจากหลังบ้าน
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <div className="flex items-center gap-2 rounded-md border px-3">
              <Mail className="size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="learner@spc.ac.th"
                className="border-0 px-0 shadow-none focus-visible:ring-0"
                required
              />
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <p>{state.success}</p>
              {state.resetUrl && (
                <a
                  href={state.resetUrl}
                  className="break-all rounded-md border border-primary/30 bg-background px-3 py-2 font-medium text-foreground hover:border-primary"
                >
                  {state.resetUrl}
                </a>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? "กำลังบันทึกคำขอ..." : "บันทึกคำขอรีเซ็ตรหัสผ่าน"}
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
