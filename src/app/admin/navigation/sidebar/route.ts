import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSidebarNavigation } from "@/lib/admin-navigation-repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["admin", "staff", "instructor"].includes(user.role)) {
    return NextResponse.json({ sections: [], bottomItems: [] }, { status: 401 });
  }

  const navigation = await getSidebarNavigation(user.role);
  return NextResponse.json(navigation);
}
