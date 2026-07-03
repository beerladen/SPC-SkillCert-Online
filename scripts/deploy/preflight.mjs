import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";
import { countTables, createConnection, getDatabaseConfig } from "../db/common.mjs";

const projectRoot = process.cwd();
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

const checks = [];
let failed = false;

function pass(label, detail = "") {
  checks.push({ status: "PASS", label, detail });
}

function warn(label, detail = "") {
  checks.push({ status: "WARN", label, detail });
}

function fail(label, detail = "") {
  failed = true;
  checks.push({ status: "FAIL", label, detail });
}

function isLocalUrl(value) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value ?? "");
}

async function checkWritableUploads() {
  const uploadDir = path.join(projectRoot, process.env.UPLOAD_DIR || "public/uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.access(uploadDir, fsConstants.W_OK);
  pass("Upload directory is writable", uploadDir);
}

async function main() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl) {
    fail("NEXT_PUBLIC_APP_URL is missing", "Set it to the real public HTTPS URL.");
  } else if (isLocalUrl(appUrl)) {
    fail("NEXT_PUBLIC_APP_URL still points to localhost", appUrl);
  } else if (!appUrl.startsWith("https://")) {
    warn("NEXT_PUBLIC_APP_URL is not HTTPS", appUrl);
  } else {
    pass("Public app URL is configured", appUrl);
  }

  await checkWritableUploads().catch((error) => {
    fail("Upload directory is not writable", error instanceof Error ? error.message : String(error));
  });

  const config = getDatabaseConfig({ includeDatabase: true });
  const connection = await createConnection({ includeDatabase: true });

  try {
    const tableCount = await countTables(connection, config.databaseName);
    if (tableCount < 40) {
      fail("Database table count is lower than expected", `${tableCount} tables found.`);
    } else {
      pass("Database schema is present", `${tableCount} tables found.`);
    }

    const [demoRows] = await connection.query(
      `SELECT email, name, role, status
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

    if (demoRows.length > 0) {
      fail(
        "Active demo/test accounts found",
        demoRows.map((row) => `${row.email} / ${row.name} (${row.role})`).join(", "),
      );
    } else {
      pass("No active demo/test accounts from seed data");
    }

    const [demoRegistrationRows] = await connection.query(
      `SELECT r.registration_no, u.email, u.name
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
         )
       LIMIT 20`,
      [demoEmails, ...demoEmailPatterns, ...demoNamePatterns],
    );

    if (demoRegistrationRows.length > 0) {
      fail(
        "Demo/test registration records found",
        demoRegistrationRows.map((row) => `${row.registration_no} / ${row.email}`).join(", "),
      );
    } else {
      pass("No demo/test registration records found");
    }

    const [userRows] = await connection.query(
      `SELECT email, password_hash
       FROM users
       WHERE deleted_at IS NULL
         AND status = 'active'`,
    );
    const weakPasswordEmails = [];
    for (const user of userRows) {
      if (await bcrypt.compare("spc123456", user.password_hash)) {
        weakPasswordEmails.push(user.email);
      }
    }

    if (weakPasswordEmails.length > 0) {
      fail("Users still use the old default password spc123456", weakPasswordEmails.join(", "));
    } else {
      pass("No active users use the old default password");
    }
  } finally {
    await connection.end();
  }

  console.table(checks);
  if (failed) {
    console.error("Production preflight failed. Fix FAIL items before going live.");
    process.exitCode = 1;
  } else {
    console.log("Production preflight passed.");
  }
}

main().catch((error) => {
  console.error("Production preflight crashed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
