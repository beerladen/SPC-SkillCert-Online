import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const demoPasswordHash =
  "$2b$10$I42FlJ4VKNoOyzmG6fxlTuXbcoLb9xvY3E8C12dMdrssO3phaD./G"; // spc123456

const learners = [
  {
    name: "ผู้เรียนทดสอบอนุมัติ 1",
    email: "approval.demo01@spc.test",
    phone: "0890001001",
    citizenId: "3999900000011",
  },
  {
    name: "ผู้เรียนทดสอบอนุมัติ 2",
    email: "approval.demo02@spc.test",
    phone: "0890001002",
    citizenId: "3999900000029",
  },
  {
    name: "ผู้เรียนทดสอบอนุมัติ 3",
    email: "approval.demo03@spc.test",
    phone: "0890001003",
    citizenId: "3999900000037",
  },
  {
    name: "ผู้เรียนทดสอบอนุมัติ 4",
    email: "approval.demo04@spc.test",
    phone: "0890001004",
    citizenId: "3999900000045",
  },
  {
    name: "ผู้เรียนทดสอบอนุมัติ 5",
    email: "approval.demo05@spc.test",
    phone: "0890001005",
    citizenId: "3999900000053",
  },
];

function databaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Copy .env.example to .env.local first.");
  }
  return process.env.DATABASE_URL;
}

async function oneRow(connection, sql, values = []) {
  const [rows] = await connection.query(sql, values);
  return rows[0] ?? null;
}

async function main() {
  const connection = await mysql.createConnection({
    uri: databaseUrl(),
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });

  try {
    await connection.beginTransaction();

    const course = await oneRow(
      connection,
      "SELECT id, title, registration_fee, original_fee FROM courses WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      ["microsoft-word"],
    );
    if (!course) {
      throw new Error("ไม่พบหลักสูตร slug=microsoft-word");
    }

    const [lessons] = await connection.query(
      `SELECT l.id
       FROM course_sections s
       JOIN lessons l ON l.section_id = s.id
       WHERE s.course_id = ?
         AND s.deleted_at IS NULL
         AND s.status <> 'archived'
         AND l.status = 'published'
         AND l.deleted_at IS NULL
       ORDER BY s.sort_order, l.sort_order`,
      [course.id],
    );
    const [tasks] = await connection.query(
      `SELECT t.id, t.sort_order, t.title, t.max_score
       FROM learning_tasks t
       LEFT JOIN course_sections s ON s.id = t.section_id
       LEFT JOIN lessons l ON l.id = t.lesson_id
       WHERE t.course_id = ?
         AND t.status = 'published'
         AND t.deleted_at IS NULL
         AND (t.section_id IS NULL OR (s.deleted_at IS NULL AND s.status <> 'archived'))
         AND (t.lesson_id IS NULL OR (l.deleted_at IS NULL AND l.status <> 'archived'))
       ORDER BY t.task_type, t.sort_order`,
      [course.id],
    );
    const postTest = await oneRow(
      connection,
      `SELECT id
       FROM assessments
       WHERE course_id = ?
         AND type = 'post_test'
         AND status = 'published'
         AND deleted_at IS NULL
         AND counts_toward_completion = TRUE
       ORDER BY sort_order
       LIMIT 1`,
      [course.id],
    );

    if (lessons.length === 0) throw new Error("หลักสูตรนี้ยังไม่มีบทเรียน published");
    if (tasks.length === 0) throw new Error("หลักสูตรนี้ยังไม่มีใบงาน/แบบฝึก published");
    if (!postTest) throw new Error("หลักสูตรนี้ยังไม่มี post-test published ที่นับผลสำเร็จ");

    for (const [index, learner] of learners.entries()) {
      await connection.query(
        `INSERT INTO users (name, email, password_hash, role, status, deleted_at)
         VALUES (?, ?, ?, 'student', 'active', NULL)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password_hash = VALUES(password_hash),
           role = 'student',
           status = 'active',
           deleted_at = NULL,
           deleted_by = NULL,
           delete_reason = NULL`,
        [learner.name, learner.email, demoPasswordHash],
      );
      const user = await oneRow(connection, "SELECT id FROM users WHERE email = ? LIMIT 1", [
        learner.email,
      ]);

      await connection.query(
        `INSERT INTO profiles (user_id, citizen_id, phone, address)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           citizen_id = VALUES(citizen_id),
           phone = VALUES(phone),
           address = VALUES(address)`,
        [user.id, learner.citizenId, learner.phone, "ข้อมูลทดสอบระบบเสนออนุมัติใบประกาศ"],
      );

      const registrationNo = `REG-DEMO-CERT-${String(index + 1).padStart(4, "0")}`;
      await connection.query(
        `INSERT INTO registrations
           (registration_no, user_id, subtotal, discount_amount, total_amount, status, submitted_at, approved_at, note)
         VALUES (?, ?, 0, 0, 0, 'approved', NOW(), NOW(), ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           status = 'approved',
           approved_at = NOW(),
           note = VALUES(note)`,
        [registrationNo, user.id, "ข้อมูลทดสอบสำหรับสร้างรายงานเสนออนุมัติใบประกาศนียบัตร"],
      );
      const registration = await oneRow(
        connection,
        "SELECT id FROM registrations WHERE registration_no = ? LIMIT 1",
        [registrationNo],
      );

      await connection.query(
        `INSERT INTO registration_items
           (registration_id, course_id, registration_fee, original_fee, discount_amount, promotion_name)
         VALUES (?, ?, 0, ?, 0, 'Demo certificate approval')
         ON DUPLICATE KEY UPDATE
           registration_fee = VALUES(registration_fee),
           original_fee = VALUES(original_fee),
           discount_amount = VALUES(discount_amount),
           promotion_name = VALUES(promotion_name)`,
        [registration.id, course.id, course.original_fee ?? course.registration_fee ?? 0],
      );
      const registrationItem = await oneRow(
        connection,
        "SELECT id FROM registration_items WHERE registration_id = ? AND course_id = ? LIMIT 1",
        [registration.id, course.id],
      );

      await connection.query(
        `INSERT INTO enrollments
           (user_id, course_id, registration_item_id, status, progress_percent, completed_at)
         VALUES (?, ?, ?, 'completed', 100, NOW())
         ON DUPLICATE KEY UPDATE
           registration_item_id = VALUES(registration_item_id),
           status = 'completed',
           progress_percent = 100,
           completed_at = NOW()`,
        [user.id, course.id, registrationItem.id],
      );
      const enrollment = await oneRow(
        connection,
        "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
        [user.id, course.id],
      );

      for (const lesson of lessons) {
        await connection.query(
          `INSERT INTO lesson_progress
             (enrollment_id, lesson_id, status, progress_percent, completed_at)
           VALUES (?, ?, 'completed', 100, NOW())
           ON DUPLICATE KEY UPDATE
             status = 'completed',
             progress_percent = 100,
             completed_at = NOW()`,
          [enrollment.id, lesson.id],
        );
      }

      for (const task of tasks) {
        const taskNo = String(task.sort_order).padStart(2, "0");
        await connection.query(
          `INSERT INTO learning_task_submissions
             (task_id, enrollment_id, submission_no, answer_text, submitted_file_url,
              submitted_file_name, submitted_link_url, note, status, score, feedback,
              submitted_at, graded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'passed', ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             answer_text = VALUES(answer_text),
             submitted_file_url = VALUES(submitted_file_url),
             submitted_file_name = VALUES(submitted_file_name),
             submitted_link_url = VALUES(submitted_link_url),
             note = VALUES(note),
             status = 'passed',
             score = VALUES(score),
             feedback = VALUES(feedback),
             submitted_at = NOW(),
             graded_at = NOW()`,
          [
            task.id,
            enrollment.id,
            `DEMO-CERT-${index + 1}-${taskNo}`,
            `ส่งงานทดสอบครบตามใบงาน ${taskNo}`,
            `/uploads/demo/certificate-approval/${learner.email}-task-${taskNo}.docx`,
            `approval-demo-${index + 1}-task-${taskNo}.docx`,
            `https://example.local/approval-demo/${index + 1}/${taskNo}`,
            "ข้อมูลทดสอบระบบเสนออนุมัติใบประกาศ",
            task.max_score,
            "ผ่านเกณฑ์สำหรับทดสอบรายงานเสนออนุมัติ",
          ],
        );
      }

      const existingAttempt = await oneRow(
        connection,
        `SELECT id
         FROM assessment_attempts
         WHERE assessment_id = ?
           AND enrollment_id = ?
           AND status IN ('submitted', 'graded', 'passed')
         ORDER BY id DESC
         LIMIT 1`,
        [postTest.id, enrollment.id],
      );
      if (existingAttempt) {
        await connection.query(
          `UPDATE assessment_attempts
           SET score = 90, max_score = 100, status = 'passed',
               submitted_at = NOW(), graded_at = NOW(), feedback = ?
           WHERE id = ?`,
          ["ผ่าน post-test สำหรับทดสอบรายงานเสนออนุมัติ", existingAttempt.id],
        );
      } else {
        await connection.query(
          `INSERT INTO assessment_attempts
             (assessment_id, enrollment_id, attempt_no, score, max_score, status,
              submitted_at, graded_at, feedback)
           VALUES (?, ?, 1, 90, 100, 'passed', NOW(), NOW(), ?)`,
          [postTest.id, enrollment.id, "ผ่าน post-test สำหรับทดสอบรายงานเสนออนุมัติ"],
        );
      }
    }

    await connection.commit();
    console.log(`Created/updated ${learners.length} certificate approval demo learners for course: ${course.title}`);
    console.log("Demo emails:");
    for (const learner of learners) console.log(`- ${learner.email}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
