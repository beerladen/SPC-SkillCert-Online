import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const demoPasswordHash =
  "$2b$10$I42FlJ4VKNoOyzmG6fxlTuXbcoLb9xvY3E8C12dMdrssO3phaD./G"; // spc123456

const learnerNames = [
  "นางสาวกัญญาภัค วงศ์สวัสดิ์",
  "นายพีรวิชญ์ สายทอง",
  "นางสาวณัฐริกา แก้วมณี",
  "นายธนกฤต พรมประเสริฐ",
  "นางสาวพิมพ์ชนก ศรีสุวรรณ",
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

function batchCode() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  const connection = await mysql.createConnection({
    uri: databaseUrl(),
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "+07:00",
  });
  const code = batchCode();
  const slug = `certificate-approval-demo-${code}`;
  const title = `หลักสูตรทดสอบรายงานเสนออนุมัติ รุ่น ${code}`;

  try {
    await connection.beginTransaction();

    const sourceCourse = await oneRow(
      connection,
      `SELECT category_id, instructor_id, cover_image_url
       FROM courses
       WHERE slug = 'microsoft-word'
         AND deleted_at IS NULL
       LIMIT 1`,
    );
    if (!sourceCourse) {
      throw new Error("ไม่พบหลักสูตร microsoft-word สำหรับใช้เป็นต้นแบบข้อมูลทดสอบ");
    }

    const [courseResult] = await connection.query(
      `INSERT INTO courses
         (category_id, instructor_id, title, slug, short_description, description,
          cover_image_url, registration_fee, original_fee, duration_minutes, capacity,
          format, level, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1080, NULL,
          'online', 'beginner', 'open', NOW())`,
      [
        sourceCourse.category_id,
        sourceCourse.instructor_id,
        title,
        slug,
        "ข้อมูลตัวอย่างสำหรับทดสอบการสร้างรายงานเสนออนุมัติใบประกาศนียบัตร",
        "หลักสูตรนี้สร้างขึ้นอัตโนมัติเพื่อทดสอบ flow การเสนอรองฝ่ายวิชาการ นายทะเบียน และผู้อำนวยการ",
        sourceCourse.cover_image_url,
      ],
    );
    const courseId = courseResult.insertId;

    await connection.query(
      `INSERT INTO course_completion_rules
         (course_id, required_progress_percent, required_post_test_score, require_all_assignments, certificate_enabled)
       VALUES (?, 80, 70, TRUE, TRUE)`,
      [courseId],
    );

    const [sectionResult] = await connection.query(
      `INSERT INTO course_sections
         (course_id, code, title, description, objectives, competency, hours, learning_mode,
          passing_score, unlock_rule, status, sort_order)
       VALUES (?, 'DEMO-01', 'หน่วยทดสอบการสร้างเอกสารสำนักงาน',
          'หน่วยเรียนตัวอย่างสำหรับการทดสอบรายงานเสนออนุมัติ',
          'เข้าใจขั้นตอนการสร้างเอกสารสำนักงานและส่งงานผ่านระบบ',
          'สามารถปฏิบัติงานเอกสารพื้นฐานและจัดส่งหลักฐานได้',
          18, 'online', 70, 'manual', 'published', 1)`,
      [courseId],
    );
    const sectionId = sectionResult.insertId;

    const lessonIds = [];
    for (const [index, lessonTitle] of [
      "บทเรียนที่ 1 การจัดรูปแบบเอกสารสำนักงาน",
      "บทเรียนที่ 2 การส่งออกไฟล์และจัดเก็บหลักฐาน",
    ].entries()) {
      const [lessonResult] = await connection.query(
        `INSERT INTO lessons
           (section_id, title, description, content, lesson_type, video_url,
            duration_minutes, is_preview, status, sort_order)
         VALUES (?, ?, ?, ?, 'video', ?, 45, 0, 'published', ?)`,
        [
          sectionId,
          lessonTitle,
          "บทเรียนตัวอย่างสำหรับทดสอบความครบถ้วนของการเรียนออนไลน์",
          "<p>เนื้อหาตัวอย่างสำหรับทดสอบระบบเรียนออนไลน์และใบประกาศ</p>",
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          index + 1,
        ],
      );
      lessonIds.push(lessonResult.insertId);
    }

    const taskIds = [];
    for (const [index, taskType] of ["worksheet", "practice"].entries()) {
      const [taskResult] = await connection.query(
        `INSERT INTO learning_tasks
           (course_id, section_id, lesson_id, task_type, title, description, instruction_html,
            submission_mode, max_score, passing_score, weight_percent, allow_resubmission,
            require_evidence, evidence_required_count, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'file_or_link', 20, 14, 0, TRUE, TRUE, 3, 'published', ?)`,
        [
          courseId,
          sectionId,
          lessonIds[index] ?? lessonIds[0],
          taskType,
          `${taskType === "worksheet" ? "ใบงาน" : "แบบฝึกปฏิบัติ"}ทดสอบรายงานเสนออนุมัติ ${index + 1}`,
          "ชิ้นงานตัวอย่างสำหรับทดสอบการตรวจและสรุปรายชื่อผู้ผ่านการอบรม",
          "<ol><li>อ่านโจทย์ใบงาน</li><li>จัดทำเอกสารตามขั้นตอน</li><li>อัปโหลดไฟล์งานและหลักฐานอย่างน้อย 3 รายการ</li></ol>",
          index + 1,
        ],
      );
      taskIds.push(taskResult.insertId);
    }

    const [assessmentResult] = await connection.query(
      `INSERT INTO assessments
         (course_id, section_id, title, type, description, passing_score, max_attempts,
          time_limit_minutes, question_limit, is_required, counts_toward_completion,
          compare_group, randomize_questions, randomize_options, show_answers, status, sort_order)
       VALUES (?, ?, 'แบบทดสอบหลังเรียนสำหรับข้อมูลตัวอย่าง', 'post_test',
          'แบบทดสอบหลังเรียนตัวอย่างเพื่อให้ผ่านเกณฑ์ใบประกาศ',
          70, 3, 30, 10, TRUE, TRUE, 'demo-approval', TRUE, TRUE, 'after_close', 'published', 99)`,
      [courseId, sectionId],
    );
    const assessmentId = assessmentResult.insertId;

    for (const [index, name] of learnerNames.entries()) {
      const learnerNo = index + 1;
      const email = `approval.batch${code}.${learnerNo}@spc.test`;
      const phone = `089${code.slice(-6)}${learnerNo}`;
      const citizenId = `39999${code.slice(-6)}${String(learnerNo).padStart(2, "0")}`;

      await connection.query(
        `INSERT INTO users (name, email, password_hash, role, status, deleted_at)
         VALUES (?, ?, ?, 'student', 'active', NULL)`,
        [name, email, demoPasswordHash],
      );
      const user = await oneRow(connection, "SELECT id FROM users WHERE email = ? LIMIT 1", [email]);

      await connection.query(
        `INSERT INTO profiles (user_id, citizen_id, phone, address)
         VALUES (?, ?, ?, ?)`,
        [user.id, citizenId, phone, "ข้อมูลตัวอย่างสำหรับทดสอบรายงานเสนออนุมัติ"],
      );

      const registrationNo = `REG-APPROVAL-${code}-${String(learnerNo).padStart(2, "0")}`;
      const [registrationResult] = await connection.query(
        `INSERT INTO registrations
           (registration_no, user_id, subtotal, discount_amount, total_amount,
            status, submitted_at, approved_at, note)
         VALUES (?, ?, 0, 0, 0, 'approved', NOW(), NOW(), ?)`,
        [registrationNo, user.id, "ข้อมูลตัวอย่างสำหรับทดสอบรายงานเสนออนุมัติใบประกาศนียบัตร"],
      );

      const [itemResult] = await connection.query(
        `INSERT INTO registration_items
           (registration_id, course_id, registration_fee, original_fee, discount_amount, promotion_name)
         VALUES (?, ?, 0, 0, 0, 'Demo approval report')`,
        [registrationResult.insertId, courseId],
      );

      const [enrollmentResult] = await connection.query(
        `INSERT INTO enrollments
           (user_id, course_id, registration_item_id, status, progress_percent, completed_at)
         VALUES (?, ?, ?, 'completed', 100, NOW())`,
        [user.id, courseId, itemResult.insertId],
      );
      const enrollmentId = enrollmentResult.insertId;

      for (const lessonId of lessonIds) {
        await connection.query(
          `INSERT INTO lesson_progress
             (enrollment_id, lesson_id, status, progress_percent, completed_at)
           VALUES (?, ?, 'completed', 100, NOW())`,
          [enrollmentId, lessonId],
        );
      }

      for (const [taskIndex, taskId] of taskIds.entries()) {
        await connection.query(
          `INSERT INTO learning_task_submissions
             (task_id, enrollment_id, submission_no, answer_text, submitted_file_url,
              submitted_file_name, submitted_link_url, note, status, score, feedback,
              submitted_at, graded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'passed', 20, ?, NOW(), NOW())`,
          [
            taskId,
            enrollmentId,
            `APPROVAL-${code}-${learnerNo}-${taskIndex + 1}`,
            "ส่งงานตัวอย่างครบตามเงื่อนไข",
            `/uploads/demo/certificate-approval/${code}-${learnerNo}-${taskIndex + 1}.docx`,
            `approval-demo-${code}-${learnerNo}-${taskIndex + 1}.docx`,
            `https://example.local/approval/${code}/${learnerNo}/${taskIndex + 1}`,
            "มีไฟล์งาน ลิงก์ และหลักฐานครบตามเงื่อนไข",
            "ผ่านเกณฑ์สำหรับข้อมูลตัวอย่างรายงานเสนออนุมัติ",
          ],
        );
      }

      await connection.query(
        `INSERT INTO assessment_attempts
           (assessment_id, enrollment_id, attempt_no, score, max_score, status,
            submitted_at, graded_at, feedback)
         VALUES (?, ?, 1, 90, 100, 'passed', NOW(), NOW(), ?)`,
        [assessmentId, enrollmentId, "ผ่านแบบทดสอบหลังเรียนสำหรับข้อมูลตัวอย่าง"],
      );
    }

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          created: true,
          courseId,
          slug,
          title,
          learners: learnerNames.length,
          password: "spc123456",
          message: "สร้างข้อมูลตัวอย่างสำหรับทดสอบสร้างรายงานเสนออนุมัติเรียบร้อยแล้ว",
        },
        null,
        2,
      ),
    );
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
