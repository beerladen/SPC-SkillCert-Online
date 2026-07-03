"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createPasswordResetToken,
  createSession,
  createStudentUser,
  destroySession,
  getRoleRedirect,
  resetPasswordWithToken,
  signInWithPassword,
} from "@/lib/auth";

export interface AuthActionState {
  error?: string;
  success?: string;
  resetUrl?: string;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "127.0.0.1:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const user = await signInWithPassword(email, password).catch(() => null);
  if (!user) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกปิดใช้งาน" };
  }

  await createSession(user);
  redirect(getRoleRedirect(user.role));
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const phone = text(formData, "phone");
  const password = text(formData, "password");

  if (!name || !email || !password) {
    return { error: "กรุณากรอกชื่อ อีเมล และรหัสผ่าน" };
  }

  if (password.length < 8) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  try {
    const user = await createStudentUser({ name, email, password, phone });
    await createSession(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("มีบัญชีในระบบแล้ว")) {
      return { error: message };
    }
    if (message.includes("Duplicate")) {
      return { error: "อีเมลนี้มีบัญชีในระบบแล้ว กรุณาเข้าสู่ระบบ" };
    }
    return { error: "ยังไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบฐานข้อมูลและลองใหม่" };
  }

  redirect("/my-learning");
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = text(formData, "email").toLowerCase();
  if (!email) return { error: "กรุณากรอกอีเมล" };

  const token = await createPasswordResetToken(email).catch(() => null);
  if (!token) {
    return {
      success:
        "ถ้ามีบัญชีนี้ในระบบ ระบบจะสร้างคำขอรีเซ็ตรหัสผ่านให้แล้ว กรุณาติดต่อผู้ดูแลหรือลองอีกครั้ง",
    };
  }

  const origin = await getRequestOrigin();
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    success: "สร้างลิงก์รีเซ็ตรหัสผ่านแล้ว ลิงก์นี้ใช้ได้ 30 นาทีและใช้ได้ครั้งเดียว",
    resetUrl,
  };
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = text(formData, "token");
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");

  if (!token) return { error: "ไม่พบ token สำหรับรีเซ็ตรหัสผ่าน" };
  if (password.length < 8) return { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirmPassword) return { error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" };

  try {
    await resetPasswordWithToken(token, password);
  } catch {
    return { error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว" };
  }

  return { success: "ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่" };
}

export async function signOutAction() {
  await destroySession();
  redirect("/signin");
}
