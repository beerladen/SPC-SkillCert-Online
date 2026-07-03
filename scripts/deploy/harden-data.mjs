import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { createConnection } from "../db/common.mjs";

const apply = process.argv.includes("--apply");
const demoEmails = [
  "admin@spc.ac.th",
  "staff@spc.ac.th",
  "teacher1@spc.ac.th",
  "teacher2@spc.ac.th",
  "teacher3@spc.ac.th",
  "learner@spc.ac.th",
  "certificate.demo@spc.ac.th",
  "somchai@example.com",
  "natthaporn@example.com",
  "kamonchanok@example.com",
];
const demoEmailPatterns = ["%demo%", "%example.com"];
const demoNamePatterns = ["%ทดสอบ%", "%ตัวอย่าง%"];

function logPlan(title, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("- none");
    return;
  }

  for (const row of rows) {
    const identity = row.email ?? row.registration_no ?? row.id;
    const role = row.role ? ` (${row.role})` : "";
    const name = row.name ? ` / ${row.name}` : "";
    console.log(`- ${identity}${name}${role}`);
  }
}

async function main() {
  const connection = await createConnection({ includeDatabase: true });

  try {
    const [demoRows] = await connection.query(
      `SELECT id, email, name, role, status
       FROM users
       WHERE deleted_at IS NULL
         AND status = 'active'
         AND (
           email IN (?)
           OR email LIKE ?
           OR email LIKE ?
           OR name LIKE ?
           OR name LIKE ?
         )`,
      [demoEmails, ...demoEmailPatterns, ...demoNamePatterns],
    );

    const [demoRegistrationRows] = await connection.query(
      `SELECT r.id, r.registration_no, u.email, u.name
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.deleted_at IS NULL
         AND (
           r.registration_no LIKE 'REG-DEMO-%'
           OR u.email IN (?)
           OR u.email LIKE ?
           OR u.email LIKE ?
           OR u.name LIKE ?
           OR u.name LIKE ?
         )`,
      [demoEmails, ...demoEmailPatterns, ...demoNamePatterns],
    );

    const [activeUsers] = await connection.query(
      `SELECT id, email, role, password_hash
       FROM users
       WHERE deleted_at IS NULL
         AND status = 'active'`,
    );

    const weakPasswordUsers = [];
    for (const user of activeUsers) {
      if (await bcrypt.compare("spc123456", user.password_hash)) {
        weakPasswordUsers.push(user);
      }
    }

    logPlan("Active demo/test accounts to disable", demoRows);
    logPlan("Demo/test registrations to soft-delete", demoRegistrationRows);
    logPlan("Active users with old default password to randomize", weakPasswordUsers);

    if (!apply) {
      console.log("\nDry run only. Re-run with --apply after backing up the production database.");
      return;
    }

    await connection.beginTransaction();
    try {
      if (demoRows.length > 0) {
        await connection.query(
          `UPDATE users
           SET status = 'disabled', updated_at = NOW()
           WHERE id IN (?)`,
          [demoRows.map((row) => row.id)],
        );
        await connection.query("DELETE FROM user_sessions WHERE user_id IN (?)", [
          demoRows.map((row) => row.id),
        ]);
      }

      if (demoRegistrationRows.length > 0) {
        const demoRegistrationIds = demoRegistrationRows.map((row) => row.id);
        await connection.query(
          `UPDATE registrations
           SET deleted_at = NOW(),
               deleted_by = NULL,
               delete_reason = 'Production hardening: demo/test registration',
               updated_at = NOW()
           WHERE id IN (?)`,
          [demoRegistrationIds],
        );
        await connection.query(
          `UPDATE registration_payments
           SET deleted_at = NOW(),
               deleted_by = NULL,
               delete_reason = 'Production hardening: demo/test registration',
               updated_at = NOW()
           WHERE registration_id IN (?)
             AND deleted_at IS NULL`,
          [demoRegistrationIds],
        );
        await connection.query(
          `UPDATE enrollments e
           JOIN registration_items ri ON ri.id = e.registration_item_id
           SET e.status = 'cancelled'
           WHERE ri.registration_id IN (?)`,
          [demoRegistrationIds],
        );
        await connection.query(
          `UPDATE certificates cert
           JOIN enrollments e ON e.id = cert.enrollment_id
           JOIN registration_items ri ON ri.id = e.registration_item_id
           SET cert.status = 'revoked',
               cert.revoked_at = COALESCE(cert.revoked_at, NOW()),
               cert.updated_at = NOW()
           WHERE ri.registration_id IN (?)
             AND cert.status = 'issued'`,
          [demoRegistrationIds],
        );
      }

      for (const user of weakPasswordUsers) {
        const temporaryPassword = randomBytes(24).toString("base64url");
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        await connection.query(
          `UPDATE users
           SET password_hash = ?, updated_at = NOW()
           WHERE id = ?`,
          [passwordHash, user.id],
        );
        await connection.query("DELETE FROM user_sessions WHERE user_id = ?", [user.id]);
      }

      await connection.commit();
      console.log("\nProduction data hardening completed.");
      console.log(
        "Users whose passwords were randomized must use the admin reset-password tool before logging in.",
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Production data hardening failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
