import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { requireCurrentUser } from "@/lib/auth";
import { queryRows } from "@/lib/db";

export async function GET() {
  const user = await requireCurrentUser(["admin", "staff", "instructor"]);

  if (user.role === "instructor") {
    return NextResponse.json({
      pendingRegistrations: 0,
      pendingPayments: 0,
    });
  }

  const rows = await queryRows<
    RowDataPacket & {
      pending_registrations: number;
      pending_payments: number;
    }
  >(
    `SELECT
       (SELECT COUNT(*) FROM registrations WHERE status IN ('pending_payment', 'pending_review') AND deleted_at IS NULL) AS pending_registrations,
       (SELECT COUNT(*) FROM registration_payments rp JOIN registrations r ON r.id = rp.registration_id WHERE rp.status = 'pending_review' AND rp.deleted_at IS NULL AND r.deleted_at IS NULL) AS pending_payments`,
  );

  const row = rows[0] ?? {};
  return NextResponse.json({
    pendingRegistrations: Number(row.pending_registrations ?? 0),
    pendingPayments: Number(row.pending_payments ?? 0),
  });
}
