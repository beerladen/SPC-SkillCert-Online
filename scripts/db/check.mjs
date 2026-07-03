import { countTables, createConnection, getDatabaseConfig } from "./common.mjs";

const config = getDatabaseConfig({ includeDatabase: true });
let connection;

try {
  connection = await createConnection({
    includeDatabase: true,
  });

  const tableCount = await countTables(connection, config.databaseName);
  const [summaryRows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
      (SELECT COUNT(*) FROM courses WHERE deleted_at IS NULL) AS courses,
      (SELECT COUNT(*) FROM registrations WHERE deleted_at IS NULL) AS registrations,
      (SELECT COUNT(*) FROM registration_payments rp JOIN registrations r ON r.id = rp.registration_id WHERE rp.status = 'pending_review' AND rp.deleted_at IS NULL AND r.deleted_at IS NULL) AS pending_payments,
      (SELECT COUNT(*) FROM assignment_submissions WHERE status = 'pending_review') AS pending_assignments,
      (SELECT COUNT(*) FROM certificates WHERE status = 'issued') AS issued_certificates
  `);

  const summary = summaryRows[0] ?? {};

  console.log(`MySQL: ${config.host}:${config.port}`);
  console.log(`Database: ${config.databaseName}`);
  console.log(`Tables: ${tableCount}`);
  console.table({
    users: Number(summary.users ?? 0),
    courses: Number(summary.courses ?? 0),
    registrations: Number(summary.registrations ?? 0),
    pendingPayments: Number(summary.pending_payments ?? 0),
    pendingAssignments: Number(summary.pending_assignments ?? 0),
    issuedCertificates: Number(summary.issued_certificates ?? 0),
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error("Cannot connect to database.");
  console.error("Please start MySQL in XAMPP and verify DATABASE_URL in .env.local.");
  console.error(`Detail: ${message}`);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
