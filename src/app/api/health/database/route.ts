import { NextResponse } from "next/server";
import { getDatabaseHealth } from "@/lib/db";
import { getDatabaseSummary } from "@/lib/db-repositories";

export const runtime = "nodejs";

export async function GET() {
  const health = await getDatabaseHealth();
  const summary = health.ok ? await getDatabaseSummary() : null;

  return NextResponse.json(
    {
      health,
      summary,
    },
    {
      status: health.ok ? 200 : 503,
    },
  );
}
