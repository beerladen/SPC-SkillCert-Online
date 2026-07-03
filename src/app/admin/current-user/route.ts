import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);

  return NextResponse.json({
    name: user.name,
    email: user.email,
    role: user.role,
  });
}
