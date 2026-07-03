"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signInAction } from "@/app/(auth)/actions";
import { AuthLogo } from "@/components/auth/auth-logo";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signInAction, {});

  return (
    <Card className="border bg-card/95 shadow-sm">
      <CardHeader className="flex flex-col gap-6">
        <AuthLogo />
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-extrabold tracking-normal">
            เข้าสู่ระบบ
          </CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            กรอกอีเมลและรหัสผ่าน ระบบจะตรวจสอบสิทธิ์จากบัญชีในฐานข้อมูลและพาไปยังหน้าที่เหมาะสมโดยอัตโนมัติ
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                ลืมรหัสผ่าน
              </Link>
            </div>
            <PasswordInput placeholder="กรอกรหัสผ่าน" autoComplete="current-password" required />
          </div>

          {state.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-center text-sm text-muted-foreground">
        <p>
          ยังไม่มีบัญชีผู้เข้าอบรม{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
