import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createConnection } from "./db/common.mjs";

const projectRoot = process.cwd();
const manifestPath = path.join(
  projectRoot,
  "public",
  "uploads",
  "excel-office-free",
  "course_manifest.json",
);

const ANSWER_INDEX = new Map([
  ["ก", 0],
  ["ข", 1],
  ["ค", 2],
  ["ง", 3],
  ["a", 0],
  ["b", 1],
  ["c", 2],
  ["d", 3],
]);

const sectionPlans = [
  {
    code: "EXCEL-01",
    title: "หน่วยที่ 1 พื้นฐานเวิร์กบุ๊กและตารางข้อมูล",
    description: "เรียนรู้โครงสร้างเวิร์กบุ๊ก เวิร์กชีต เซลล์ การป้อนข้อมูล การจัดรูปแบบ และสูตรพื้นฐาน",
    objectives: "ตั้งค่าแฟ้มงาน ป้อนข้อมูล จัดรูปแบบตาราง และใช้สูตรพื้นฐานในงานสำนักงานได้",
    competency: "สร้างตารางข้อมูล Excel เบื้องต้นที่อ่านง่ายและใช้คำนวณได้ถูกต้อง",
    start: 1,
    end: 5,
    hours: 3,
  },
  {
    code: "EXCEL-02",
    title: "หน่วยที่ 2 สูตร ฟังก์ชัน และการค้นหาข้อมูล",
    description: "ฝึกสร้างตารางงานสำนักงาน ใช้อ้างอิงเซลล์ IF, COUNTIF, SUMIF และ Lookup เพื่อสรุปข้อมูล",
    objectives: "ใช้สูตรและฟังก์ชันสำคัญเพื่อคำนวณ ตรวจเงื่อนไข และค้นหาข้อมูลจากตารางได้",
    competency: "ออกแบบสูตรที่ถูกต้อง ตรวจสอบได้ และนำไปใช้กับงานจริงในสำนักงาน",
    start: 6,
    end: 10,
    hours: 3,
  },
  {
    code: "EXCEL-03",
    title: "หน่วยที่ 3 จัดการข้อมูลและนำเสนอด้วยกราฟ",
    description: "จัดเรียง กรอง เน้นข้อมูลสำคัญ สร้างกราฟ และเตรียมพิมพ์รายงานจาก Excel",
    objectives: "จัดการข้อมูลให้เป็นระบบและสื่อสารผลลัพธ์ด้วยกราฟหรือรายงานที่พร้อมใช้งาน",
    competency: "สร้างรายงาน Excel ที่มีตาราง กราฟ และรูปแบบการพิมพ์เหมาะสม",
    start: 11,
    end: 15,
    hours: 3,
  },
  {
    code: "EXCEL-04",
    title: "หน่วยที่ 4 เครื่องมือควบคุมข้อมูลและ Pivot",
    description: "ใช้ Data Validation ฟังก์ชันข้อความ/วันที่ PivotTable และ PivotChart สำหรับงานวิเคราะห์",
    objectives: "ควบคุมข้อมูลนำเข้า สรุปข้อมูลหลายมิติ และสร้างกราฟสรุปจาก Pivot ได้",
    competency: "วิเคราะห์ข้อมูลสำนักงานด้วย PivotTable/PivotChart และลดข้อผิดพลาดจากการป้อนข้อมูล",
    start: 16,
    end: 20,
    hours: 3,
  },
  {
    code: "EXCEL-05",
    title: "หน่วยที่ 5 Dashboard ความปลอดภัย และการตรวจสอบสูตร",
    description: "สร้าง Dashboard ป้องกันชีต ตรวจสอบสูตร จัดระเบียบข้อมูล และสร้างแม่แบบงาน Excel",
    objectives: "สร้างแฟ้มงานที่ปลอดภัย ตรวจสอบสูตรได้ และเหมาะสำหรับนำไปใช้ซ้ำในหน่วยงาน",
    competency: "จัดทำ Dashboard และแม่แบบไฟล์ Excel ที่เป็นระบบ พร้อมใช้งานในสำนักงาน",
    start: 21,
    end: 25,
    hours: 3,
  },
  {
    code: "EXCEL-06",
    title: "หน่วยที่ 6 ชิ้นงานปฏิบัติและแฟ้มงานสรุป",
    description: "ฝึกชิ้นงานสอบปฏิบัติด้านตารางคำนวณ Pivot Dashboard และรายงานประเมินผล",
    objectives: "รวมทักษะ Excel เพื่อส่งแฟ้มงานสมบูรณ์พร้อมรายงานและหลักฐานการทำงาน",
    competency: "ส่งมอบแฟ้มงาน Excel พร้อมรายงานสรุปที่ตรวจประเมินได้ตามเกณฑ์",
    start: 26,
    end: 30,
    hours: 3,
  },
];

const outcomes = [
  "สร้างและจัดรูปแบบเวิร์กบุ๊ก เวิร์กชีต ตารางข้อมูล และเซลล์ให้เหมาะกับงานสำนักงานได้",
  "ใช้สูตร ฟังก์ชัน และการอ้างอิงเซลล์เพื่อคำนวณและตรวจสอบข้อมูลได้ถูกต้อง",
  "จัดเรียง กรอง สรุป วิเคราะห์ และนำเสนอข้อมูลด้วยกราฟ PivotTable และ Dashboard ได้",
  "เตรียมพิมพ์ ป้องกันชีต ตรวจสอบสูตร และจัดเก็บแฟ้มงานอย่างเป็นระบบได้",
  "ส่งงาน Excel พร้อมไฟล์ผลงานและหลักฐานการปฏิบัติตามเกณฑ์ประเมินได้",
];

const requirements = [
  "มีคอมพิวเตอร์ที่ติดตั้ง Microsoft Excel หรือโปรแกรมสเปรดชีตที่เปิดไฟล์ Excel ได้",
  "มีบัญชีผู้ใช้สำหรับเข้าสู่ระบบเรียนออนไลน์และส่งใบงาน",
  "ผู้เริ่มต้นสามารถเรียนได้ ไม่จำเป็นต้องมีพื้นฐานสูตร Excel มาก่อน",
];

const audience = [
  "นักเรียน นักศึกษา และผู้เริ่มต้นที่ต้องการฝึกใช้ Excel เพื่อการทำงาน",
  "ครู บุคลากรสำนักงาน เจ้าหน้าที่ธุรการ และผู้ประกอบการรายย่อย",
  "ผู้ที่ต้องการพัฒนาทักษะตารางคำนวณ รายงาน และ Dashboard สำหรับงานจริง",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function bool(value) {
  return value ? 1 : 0;
}

function publicPathFromUrl(url) {
  if (!url || !url.startsWith("/")) return null;
  return path.join(projectRoot, "public", url.replace(/^\//, "").replaceAll("/", path.sep));
}

function fileNameFromUrl(url) {
  return decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).at(-1) ?? "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

async function fileSizeLabel(url) {
  const filePath = publicPathFromUrl(url);
  if (!filePath) return null;
  const stats = await fs.stat(filePath);
  return formatBytes(stats.size);
}

function sectionForOrder(order) {
  const section = sectionPlans.find((item) => order >= item.start && order <= item.end);
  assert(section, `No section plan for worksheet order ${order}.`);
  return section;
}

function sortInSection(order) {
  return ((order - 1) % 5) + 1;
}

function buildInstructionHtml(worksheet) {
  return [
    `<h3>ใบงาน Excel ที่ ${worksheet.order}: ${escapeHtml(worksheet.title)}</h3>`,
    "<p>ศึกษาโจทย์จากไฟล์ PDF ใบงาน แล้วปฏิบัติใน Microsoft Excel หรือโปรแกรมสเปรดชีตที่รองรับไฟล์ Excel</p>",
    "<ul>",
    "<li>สร้างหรือแก้ไขแฟ้มงานตามโจทย์ให้ครบถ้วน</li>",
    "<li>ตรวจสอบสูตร ผลลัพธ์ รูปแบบตาราง และความเรียบร้อยก่อนส่ง</li>",
    "<li>ส่งไฟล์งาน Excel/PDF หรือลิงก์ผลงาน พร้อมหลักฐานการทำงานอย่างน้อย 2 รายการ</li>",
    "<li>ตั้งชื่อไฟล์ให้สื่อความหมาย เช่น excel-ใบงาน-01-ชื่อผู้เรียน.xlsx</li>",
    "</ul>",
    `<p><a href="${escapeHtml(worksheet.fileUrl)}" target="_blank" rel="noreferrer">เปิด PDF ใบงาน Excel ที่ ${worksheet.order}</a></p>`,
  ].join("\n");
}

async function validateFiles(manifest) {
  const urls = new Set([
    manifest.course.coverImageUrl,
    manifest.cover,
    manifest.assessments?.preTestCsv,
    manifest.assessments?.postTestCsv,
    ...manifest.worksheets.map((worksheet) => worksheet.fileUrl),
  ].filter(Boolean));

  const missing = [];
  for (const url of urls) {
    const filePath = publicPathFromUrl(url);
    if (!filePath) continue;
    try {
      await fs.access(filePath);
    } catch {
      missing.push(`${url} -> ${filePath}`);
    }
  }
  assert(missing.length === 0, `Missing required files:\n${missing.join("\n")}`);
}

async function getSingleId(connection, sql, params, label) {
  const [rows] = await connection.execute(sql, params);
  assert(rows.length > 0, `Cannot resolve ${label}.`);
  return Number(rows[0].id);
}

async function resolveAdminUserId(connection) {
  const [rows] = await connection.execute(
    `SELECT id
     FROM users
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND role IN ('admin', 'instructor')
     ORDER BY FIELD(role, 'admin', 'instructor'), id
     LIMIT 1`,
  );
  return rows.length ? Number(rows[0].id) : null;
}

async function upsertCategory(connection) {
  await connection.execute(
    `INSERT INTO categories (name, slug, icon, description, sort_order, deleted_at)
     VALUES ('คอมพิวเตอร์และเทคโนโลยี', 'technology', 'Excel', 'หลักสูตรคอมพิวเตอร์ เทคโนโลยี และทักษะดิจิทัล', 10, NULL)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       icon = VALUES(icon),
       description = VALUES(description),
       sort_order = VALUES(sort_order),
       deleted_at = NULL`,
  );
  return getSingleId(connection, "SELECT id FROM categories WHERE slug = 'technology' LIMIT 1", [], "category");
}

async function upsertInstructor(connection, instructorName) {
  const adminUserId = await resolveAdminUserId(connection);
  if (adminUserId) {
    await connection.execute(
      `INSERT INTO instructors (user_id, display_name, position, bio, status)
       VALUES (?, ?, 'ครูเจ้าของหลักสูตร / ผู้ดูแลระบบ', 'ผู้ดูแลและเจ้าของหลักสูตรฟรีสำหรับพัฒนาทักษะสำนักงานดิจิทัล', 'active')
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         position = VALUES(position),
         bio = VALUES(bio),
         status = 'active'`,
      [adminUserId, instructorName],
    );
    return {
      instructorId: await getSingleId(
        connection,
        "SELECT id FROM instructors WHERE user_id = ? LIMIT 1",
        [adminUserId],
        "instructor",
      ),
      adminUserId,
    };
  }

  const [rows] = await connection.execute(
    "SELECT id FROM instructors WHERE user_id IS NULL AND display_name = ? AND status = 'active' ORDER BY id LIMIT 1",
    [instructorName],
  );
  if (rows.length) return { instructorId: Number(rows[0].id), adminUserId: null };

  const [result] = await connection.execute(
    `INSERT INTO instructors (user_id, display_name, position, bio, status)
     VALUES (NULL, ?, 'ครูเจ้าของหลักสูตร / ผู้ดูแลระบบ', 'ผู้ดูแลและเจ้าของหลักสูตรฟรีสำหรับพัฒนาทักษะสำนักงานดิจิทัล', 'active')`,
    [instructorName],
  );
  return { instructorId: Number(result.insertId), adminUserId: null };
}

async function deleteExistingCourse(connection, slug) {
  const [rows] = await connection.execute("SELECT id FROM courses WHERE slug = ? LIMIT 1", [slug]);
  if (!rows.length) return false;

  const courseId = Number(rows[0].id);
  const [usageRows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE course_id = ?) AS enrollments,
       (SELECT COUNT(*) FROM registration_items WHERE course_id = ?) AS registration_items`,
    [courseId, courseId],
  );
  const usage = usageRows[0] ?? {};
  assert(
    Number(usage.enrollments ?? 0) === 0 && Number(usage.registration_items ?? 0) === 0,
    `Course ${slug} already has learner or registration data. Refusing to replace it.`,
  );
  await connection.execute("DELETE FROM courses WHERE id = ?", [courseId]);
  return true;
}

async function insertCourse(connection, course, categoryId, instructorId) {
  const [result] = await connection.execute(
    `INSERT INTO courses (
       category_id, instructor_id, title, slug, short_description, description,
       cover_image_url, registration_fee, original_fee, duration_minutes, capacity,
       format, level, status, starts_at, ends_at, published_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 100, 'online', 'beginner', 'open', NULL, NULL, NOW())`,
    [
      categoryId,
      instructorId,
      course.title,
      course.slug,
      "หลักสูตรฟรีสำหรับฝึกใช้ Microsoft Excel ในงานสำนักงาน พร้อมใบงาน PDF 30 ชุดและแบบทดสอบก่อน-หลังเรียน",
      "หลักสูตรนี้ออกแบบสำหรับผู้เริ่มต้นถึงผู้ใช้งานสำนักงานที่ต้องการใช้ Microsoft Excel อย่างเป็นระบบ ครอบคลุมการสร้างเวิร์กบุ๊ก การจัดรูปแบบตาราง สูตรและฟังก์ชัน การกรองข้อมูล กราฟ PivotTable Dashboard การป้องกันชีต และการส่งงานพร้อมหลักฐาน ผู้เรียนฝึกจากใบงานจริง 30 ชุด และวิดีโอบทเรียนสามารถอัปเดตเพิ่มเติมภายหลังได้",
      course.coverImageUrl,
      Number(course.durationMinutes ?? 1080),
    ],
  );
  return Number(result.insertId);
}

async function insertOrderedText(connection, table, courseId, column, values) {
  for (const [index, value] of values.entries()) {
    await connection.execute(
      `INSERT INTO ${table} (course_id, ${column}, sort_order) VALUES (?, ?, ?)`,
      [courseId, value, index + 1],
    );
  }
}

async function insertSections(connection, courseId) {
  const ids = new Map();
  for (const [index, section] of sectionPlans.entries()) {
    const [result] = await connection.execute(
      `INSERT INTO course_sections (
         course_id, code, title, description, objectives, competency, hours,
         learning_mode, passing_score, unlock_rule, status, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'online', 70, 'sequential', 'published', ?)`,
      [
        courseId,
        section.code,
        section.title,
        section.description,
        section.objectives,
        section.competency,
        section.hours,
        index + 1,
      ],
    );
    ids.set(section.code, Number(result.insertId));
  }
  return ids;
}

async function insertLessonsAndTasks(connection, courseId, sectionIds, worksheets) {
  for (const worksheet of worksheets) {
    const section = sectionForOrder(Number(worksheet.order));
    const sectionId = sectionIds.get(section.code);
    assert(sectionId, `Unknown section id for ${section.code}.`);
    const sortOrder = sortInSection(Number(worksheet.order));
    const durationMinutes = 36;
    const pdfFileName = fileNameFromUrl(worksheet.fileUrl);
    const lessonTitle = `บทเรียนที่ ${String(worksheet.order).padStart(2, "0")}: ${worksheet.title}`;

    const [lessonResult] = await connection.execute(
      `INSERT INTO lessons (
         section_id, title, description, content, lesson_type, video_url,
         duration_minutes, is_preview, status, sort_order
       )
       VALUES (?, ?, ?, ?, 'video', NULL, ?, ?, 'published', ?)`,
      [
        sectionId,
        lessonTitle,
        "บทเรียนออนไลน์สำหรับฝึกปฏิบัติ Excel วิดีโอจะอัปเดตภายหลัง ผู้เรียนสามารถเริ่มจาก PDF ใบงานได้ทันที",
        `ศึกษาใบงาน Excel ที่ ${worksheet.order} แล้วฝึกทำแฟ้มงานตามโจทย์ วิดีโอประกอบบทเรียนจะอัปเดตภายหลัง`,
        durationMinutes,
        bool(Number(worksheet.order) === 1),
        sortOrder,
      ],
    );
    const lessonId = Number(lessonResult.insertId);

    await connection.execute(
      `INSERT INTO lesson_resources (
         lesson_id, title, resource_type, file_url, file_name, file_size, status, sort_order
       )
       VALUES (?, ?, 'worksheet', ?, ?, ?, 'published', 1)`,
      [
        lessonId,
        `PDF ใบงาน Excel ที่ ${worksheet.order}`,
        worksheet.fileUrl,
        pdfFileName,
        await fileSizeLabel(worksheet.fileUrl),
      ],
    );

    const [taskResult] = await connection.execute(
      `INSERT INTO learning_tasks (
         course_id, section_id, lesson_id, assessment_id, task_type, title, description,
         instruction_html, instruction_file_url, instruction_file_name, resource_url,
         submission_mode, max_score, passing_score, weight_percent, due_days_after_enrollment,
         allow_resubmission, require_evidence, evidence_required_count, status, sort_order
       )
       VALUES (?, ?, ?, NULL, 'worksheet', ?, ?, ?, ?, ?, NULL, 'file_or_link', 20, 14, 0, NULL, TRUE, TRUE, 2, 'published', ?)`,
      [
        courseId,
        sectionId,
        lessonId,
        `ใบงาน Excel ที่ ${worksheet.order}: ${worksheet.title}`,
        Number(worksheet.order) <= 3
          ? "ใบงานเตรียมพื้นฐาน Excel สำหรับปูพื้นก่อนเข้าสู่ชุดใบงานปฏิบัติ"
          : "ใบงานปฏิบัติ Excel ใช้สะสมผลงานตามเกณฑ์ประเมินของหลักสูตร",
        buildInstructionHtml(worksheet),
        worksheet.fileUrl,
        pdfFileName,
        Number(worksheet.order),
      ],
    );

    const taskId = Number(taskResult.insertId);
    await connection.execute(
      `INSERT INTO learning_task_attachments (task_id, title, file_url, file_name, file_type, sort_order)
       VALUES (?, ?, ?, ?, 'pdf', 1)`,
      [taskId, `PDF ใบงาน Excel ที่ ${worksheet.order}`, worksheet.fileUrl, pdfFileName],
    );

    const rubrics = [
      ["ทำตามโจทย์ครบถ้วน", "สร้างแฟ้มงานและทำขั้นตอนตามโจทย์ครบทุกข้อ", 5],
      ["ความถูกต้องของสูตรและผลลัพธ์", "สูตร ฟังก์ชัน การอ้างอิงเซลล์ และผลลัพธ์ถูกต้อง", 7],
      ["รูปแบบตารางและการนำเสนอ", "จัดรูปแบบ อ่านง่าย เหมาะกับงานสำนักงาน และเตรียมพิมพ์ได้", 5],
      ["การส่งงานและหลักฐาน", "ส่งไฟล์หรือลิงก์ผลงาน พร้อมหลักฐานตามจำนวนที่กำหนด", 3],
    ];

    for (const [index, rubric] of rubrics.entries()) {
      await connection.execute(
        `INSERT INTO learning_task_rubrics (task_id, title, description, max_score, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, rubric[0], rubric[1], rubric[2], index + 1],
      );
    }
  }
}

async function insertAssessment(connection, courseId, assessment, questions) {
  const [assessmentResult] = await connection.execute(
    `INSERT INTO assessments (
       course_id, section_id, lesson_id, shared_question_source_id, title, type,
       description, passing_score, max_attempts, time_limit_minutes, question_limit,
       is_required, counts_toward_completion, compare_group, randomize_questions,
       randomize_options, show_answers, status, sort_order
     )
     VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, 20, TRUE, ?, 'main', TRUE, FALSE, 'after_close', 'published', ?)`,
    [
      courseId,
      assessment.title,
      assessment.type,
      assessment.description,
      assessment.passingScore,
      assessment.maxAttempts,
      assessment.timeLimit,
      bool(assessment.countsTowardCompletion),
      assessment.sortOrder,
    ],
  );
  const assessmentId = Number(assessmentResult.insertId);

  for (const [questionIndex, question] of questions.entries()) {
    const [questionResult] = await connection.execute(
      `INSERT INTO questions (
         assessment_id, question_text, question_type, score, explanation, status, sort_order
       )
       VALUES (?, ?, 'single_choice', 1, ?, 'active', ?)`,
      [assessmentId, question.question, question.explanation, questionIndex + 1],
    );
    const questionId = Number(questionResult.insertId);
    const correctIndex = ANSWER_INDEX.get(String(question.answer).trim().toLowerCase());
    assert(Number.isInteger(correctIndex), `Unknown answer key on question ${questionIndex + 1}.`);
    const choices = [question.choice_a, question.choice_b, question.choice_c, question.choice_d];
    for (const [choiceIndex, choice] of choices.entries()) {
      await connection.execute(
        `INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
         VALUES (?, ?, ?, ?)`,
        [questionId, choice, bool(choiceIndex === correctIndex), choiceIndex + 1],
      );
    }
  }

  return assessmentId;
}

async function insertEvaluationRules(connection, courseId) {
  const rules = [
    ["lesson_progress", "ความก้าวหน้าการเรียน", 20, 80, 1],
    ["post_test", "แบบทดสอบหลังเรียน", 30, 70, 2],
    ["worksheet", "ใบงาน Excel 30 ชุด", 50, 70, 3],
  ];

  for (const rule of rules) {
    await connection.execute(
      `INSERT INTO course_evaluation_rules (
         course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order
       )
       VALUES (?, ?, ?, ?, ?, TRUE, 'active', ?)`,
      [courseId, rule[0], rule[1], rule[2], rule[3], rule[4]],
    );
  }

  await connection.execute(
    `INSERT INTO course_completion_rules (
       course_id, required_progress_percent, required_post_test_score,
       require_all_assignments, certificate_enabled
     )
     VALUES (?, 80, 70, TRUE, TRUE)`,
    [courseId],
  );
}

async function insertAuditLog(connection, userId, courseId, slug) {
  await connection.execute(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
     VALUES (?, 'course.import_excel_office_free', 'course', ?, ?)`,
    [
      userId,
      courseId,
      JSON.stringify({
        slug,
        source: "scripts/import-excel-office-course.mjs",
        importedAt: new Date().toISOString(),
      }),
    ],
  );
}

async function countImportedRows(connection, courseId) {
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM course_sections WHERE course_id = ?) AS sections,
       (SELECT COUNT(*) FROM lessons l JOIN course_sections s ON s.id = l.section_id WHERE s.course_id = ?) AS lessons,
       (SELECT COUNT(*) FROM lesson_resources lr JOIN lessons l ON l.id = lr.lesson_id JOIN course_sections s ON s.id = l.section_id WHERE s.course_id = ?) AS lesson_resources,
       (SELECT COUNT(*) FROM assessments WHERE course_id = ?) AS assessments,
       (SELECT COUNT(*) FROM questions q JOIN assessments a ON a.id = q.assessment_id WHERE a.course_id = ?) AS questions,
       (SELECT COUNT(*) FROM learning_tasks WHERE course_id = ?) AS tasks,
       (SELECT COUNT(*) FROM learning_task_rubrics r JOIN learning_tasks t ON t.id = r.task_id WHERE t.course_id = ?) AS rubrics`,
    [courseId, courseId, courseId, courseId, courseId, courseId, courseId],
  );
  return rows[0] ?? {};
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
assert(manifest.course?.slug, "Manifest course.slug is required.");
assert(manifest.course?.title === "โปรแกรม Microsoft Excel ในสำนักงาน", "Unexpected Excel course title in manifest.");
assert(Array.isArray(manifest.worksheets) && manifest.worksheets.length === 30, "Manifest must contain 30 worksheets.");
assert(Array.isArray(manifest.questions) && manifest.questions.length === 20, "Manifest must contain 20 questions.");

await validateFiles(manifest);

let connection;

try {
  connection = await createConnection({ includeDatabase: true });
  await connection.beginTransaction();

  const categoryId = await upsertCategory(connection);
  const { instructorId, adminUserId } = await upsertInstructor(connection, manifest.course.instructorName ?? "นายธารา แสงเพ็ชร");
  const replacedExisting = await deleteExistingCourse(connection, manifest.course.slug);
  const courseId = await insertCourse(connection, manifest.course, categoryId, instructorId);

  await insertOrderedText(connection, "course_outcomes", courseId, "outcome", outcomes);
  await insertOrderedText(connection, "course_requirements", courseId, "requirement", requirements);
  await insertOrderedText(connection, "course_audiences", courseId, "audience", audience);

  const sectionIds = await insertSections(connection, courseId);
  await insertLessonsAndTasks(connection, courseId, sectionIds, manifest.worksheets);
  await insertAssessment(
    connection,
    courseId,
    {
      title: "แบบทดสอบก่อนเรียน: โปรแกรม Microsoft Excel ในสำนักงาน",
      type: "pre_test",
      description: "วัดความรู้พื้นฐานก่อนเริ่มเรียน ไม่คิดคะแนนจบหลักสูตร",
      passingScore: 0,
      maxAttempts: 1,
      timeLimit: 30,
      countsTowardCompletion: false,
      sortOrder: 1,
    },
    manifest.questions,
  );
  await insertAssessment(
    connection,
    courseId,
    {
      title: "แบบทดสอบหลังเรียน: โปรแกรม Microsoft Excel ในสำนักงาน",
      type: "post_test",
      description: "วัดผลหลังเรียน ต้องได้อย่างน้อย 70% เพื่อผ่านเงื่อนไขหลักสูตร",
      passingScore: 70,
      maxAttempts: 3,
      timeLimit: 40,
      countsTowardCompletion: true,
      sortOrder: 2,
    },
    manifest.questions,
  );
  await insertEvaluationRules(connection, courseId);
  await insertAuditLog(connection, adminUserId, courseId, manifest.course.slug);

  const counts = await countImportedRows(connection, courseId);
  await connection.commit();

  console.log(
    JSON.stringify(
      {
        ok: true,
        courseId,
        slug: manifest.course.slug,
        replacedExisting,
        instructorId,
        categoryId,
        counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])),
      },
      null,
      2,
    ),
  );
} catch (error) {
  await connection?.rollback();
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  await connection?.end();
}
