import "dotenv/config";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

dotenv.config({ path: ".env.local" });

const OLD_DB = {
  host: process.env.MODSTD_DB_HOST ?? "localhost",
  port: Number(process.env.MODSTD_DB_PORT ?? 3306),
  user: process.env.MODSTD_DB_USER ?? "root",
  password: process.env.MODSTD_DB_PASSWORD ?? "",
  database: process.env.MODSTD_DB_NAME ?? "modulestd",
};

const OLD_PUBLIC_DIR = process.env.MODSTD_PUBLIC_DIR ?? "C:\\xampp\\htdocs\\modulestd1\\public";
const SOURCE_WORD_PDF_DIR = path.join(OLD_PUBLIC_DIR, "files", "word_pdf");
const TARGET_WORD_PDF_DIR = path.join(process.cwd(), "public", "files", "word_pdf");
const IMPORT_SECTION_CODE_PREFIX = "MODSTD-WORD-";

const sectionPlans = [
  {
    code: "MODSTD-WORD-01",
    title: "หน่วยที่ 1 พื้นฐานเอกสารและการจัดรูปแบบข้อความ",
    description: "บทเรียนที่ 1-5 ครอบคลุมการสร้างเอกสาร การบันทึกไฟล์ ตัวอักษร ย่อหน้า และหัวข้อลำดับเลข",
    start: 1,
    end: 5,
  },
  {
    code: "MODSTD-WORD-02",
    title: "หน่วยที่ 2 ตาราง รูปภาพ และองค์ประกอบหน้าเอกสาร",
    description: "บทเรียนที่ 6-10 ครอบคลุมตาราง รูปภาพ Header/Footer เลขหน้า หน้าปก และสารบัญเบื้องต้น",
    start: 6,
    end: 10,
  },
  {
    code: "MODSTD-WORD-03",
    title: "หน่วยที่ 3 รายงาน Styles และเอกสารอ้างอิง",
    description: "บทเรียนที่ 11-15 ครอบคลุม Styles สารบัญอัตโนมัติ เชิงอรรถ การตรวจทาน และ SmartArt",
    start: 11,
    end: 15,
  },
  {
    code: "MODSTD-WORD-04",
    title: "หน่วยที่ 4 แบบฟอร์ม จดหมายเวียน และเอกสารสำนักงาน",
    description: "บทเรียนที่ 16-20 ครอบคลุมแบบฟอร์ม ตารางข้อมูล Mail Merge ซองจดหมาย และเอกสารประชุม",
    start: 16,
    end: 20,
  },
  {
    code: "MODSTD-WORD-05",
    title: "หน่วยที่ 5 คู่มือ การรวมเอกสาร และการตรวจทานขั้นสูง",
    description: "บทเรียนที่ 21-25 ครอบคลุมคู่มือหลายขั้นตอน การรวมไฟล์ Track Changes การป้องกันเอกสาร และแม่แบบ",
    start: 21,
    end: 25,
  },
  {
    code: "MODSTD-WORD-06",
    title: "หน่วยที่ 6 งานสอบปฏิบัติและชิ้นงานสรุป",
    description: "บทเรียนที่ 26-30 ครอบคลุมการเตรียมส่งออก งานสอบปฏิบัติ และแฟ้มเอกสารสำนักงานพร้อมประเมิน",
    start: 26,
    end: 30,
  },
];

function currentDbOptions() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Add it to .env.local before importing.");
  }
  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    multipleStatements: false,
  };
}

async function query(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

function sectionForOrder(orderNo) {
  const section = sectionPlans.find((item) => orderNo >= item.start && orderNo <= item.end);
  if (!section) throw new Error(`No section plan found for order ${orderNo}`);
  return section;
}

function sortInSection(orderNo) {
  return ((orderNo - 1) % 5) + 1;
}

function pdfPathForOrder(orderNo) {
  return `/files/word_pdf/word_worksheet_${String(orderNo).padStart(2, "0")}.pdf`;
}

function buildInstructionHtml(worksheet) {
  const pdfUrl = worksheet.instruction_pdf_url || pdfPathForOrder(Number(worksheet.order_no));
  const typeLabel = worksheet.worksheet_type === "EXAM" ? "ใบงานสอบปฏิบัติ" : "ใบงานฝึกปฏิบัติ";
  return [
    `<h3>${escapeHtml(typeLabel)} Word ที่ ${worksheet.order_no}: ${escapeHtml(worksheet.title)}</h3>`,
    worksheet.description ? `<p>${escapeHtml(worksheet.description)}</p>` : "",
    "<ul>",
    "<li>ศึกษาโจทย์จากไฟล์ PDF ใบงาน แล้วปฏิบัติตามขั้นตอนให้ครบถ้วน</li>",
    "<li>ส่งไฟล์งาน Word/PDF หรือลิงก์ผลงาน พร้อมบันทึกขั้นตอนที่ทำ</li>",
    "<li>แนบหลักฐานระหว่างปฏิบัติงานอย่างน้อย 3 รายการ เช่น ภาพหน้าจอหรือบันทึกการทำงาน</li>",
    "</ul>",
    `<p><a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noreferrer">เปิด PDF ใบงานจากระบบเดิม</a></p>`,
  ].filter(Boolean).join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function copyWordPdfs() {
  await fs.mkdir(TARGET_WORD_PDF_DIR, { recursive: true });
  const entries = await fs.readdir(SOURCE_WORD_PDF_DIR, { withFileTypes: true });
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && /^word_worksheet_\d{2}\.pdf$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of pdfFiles) {
    await fs.copyFile(path.join(SOURCE_WORD_PDF_DIR, fileName), path.join(TARGET_WORD_PDF_DIR, fileName));
  }

  return pdfFiles.length;
}

async function main() {
  const copiedPdfCount = await copyWordPdfs();
  const oldDb = await mysql.createConnection(OLD_DB);
  const currentDb = await mysql.createConnection(currentDbOptions());

  try {
    const oldCourses = await query(oldDb, "SELECT id, code, title FROM courses WHERE code = 'WORD' LIMIT 1");
    const oldCourse = oldCourses[0];
    if (!oldCourse) throw new Error("Old WORD course was not found in modulestd.courses.");

    const currentCourses = await query(
      currentDb,
      "SELECT id, slug, title FROM courses WHERE slug = 'microsoft-word' OR slug = 'word' OR title LIKE '%Word%' ORDER BY id LIMIT 1",
    );
    const currentCourse = currentCourses[0];
    if (!currentCourse) throw new Error("Current Microsoft Word course was not found.");

    const oldLessons = await query(
      oldDb,
      `SELECT order_no, title, summary, content, video_url, document_url, document_label,
              duration_minutes, is_published
       FROM course_lessons
       WHERE course_id = ?
       ORDER BY order_no`,
      [oldCourse.id],
    );
    const oldWorksheets = await query(
      oldDb,
      `SELECT id, order_no, title, description, worksheet_type, prompt_mode, instruction_pdf_url,
              instruction_image_url, resource_url, max_score, is_published
       FROM worksheets
       WHERE course_id = ?
       ORDER BY order_no`,
      [oldCourse.id],
    );

    if (oldLessons.length !== 30 || oldWorksheets.length !== 30) {
      throw new Error(`Expected 30 lessons and 30 worksheets, got ${oldLessons.length} lessons and ${oldWorksheets.length} worksheets.`);
    }

    await currentDb.beginTransaction();

    await currentDb.execute(
      `DELETE FROM learning_tasks
       WHERE course_id = ?
         AND (
           instruction_file_url LIKE '/files/word_pdf/word_worksheet_%'
           OR title LIKE 'ใบงาน Word ที่ %'
         )`,
      [currentCourse.id],
    );
    await currentDb.execute(
      `DELETE FROM course_sections
       WHERE course_id = ? AND code LIKE ?`,
      [currentCourse.id, `${IMPORT_SECTION_CODE_PREFIX}%`],
    );

    await currentDb.execute(
      `UPDATE learning_tasks
       SET status = 'archived',
           deleted_at = COALESCE(deleted_at, NOW()),
           sort_order = sort_order + 10000
       WHERE course_id = ?
         AND task_type = 'worksheet'
         AND deleted_at IS NULL
         AND instruction_file_url NOT LIKE '/files/word_pdf/word_worksheet_%'`,
      [currentCourse.id],
    );
    await currentDb.execute(
      `UPDATE course_sections
       SET status = 'archived',
           deleted_at = COALESCE(deleted_at, NOW()),
           sort_order = sort_order + 10000
       WHERE course_id = ?
         AND deleted_at IS NULL
         AND (code IS NULL OR code NOT LIKE ?)`,
      [currentCourse.id, `${IMPORT_SECTION_CODE_PREFIX}%`],
    );

    const sectionIds = new Map();
    for (let index = 0; index < sectionPlans.length; index += 1) {
      const plan = sectionPlans[index];
      const sectionLessons = oldLessons.filter((lesson) => lesson.order_no >= plan.start && lesson.order_no <= plan.end);
      const totalMinutes = sectionLessons.reduce((sum, lesson) => sum + Number(lesson.duration_minutes ?? 0), 0);

      const [sectionResult] = await currentDb.execute(
        `INSERT INTO course_sections
           (course_id, code, title, description, objectives, competency, hours, learning_mode, passing_score, unlock_rule, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'online', 70, 'sequential', 'published', ?)`,
        [
          currentCourse.id,
          plan.code,
          plan.title,
          plan.description,
          `เรียนรู้บทเรียน Word ลำดับที่ ${plan.start}-${plan.end} และทำใบงานประจำบท`,
          "สร้าง จัดรูปแบบ ตรวจทาน และส่งออกเอกสาร Microsoft Word ตามโจทย์งานสำนักงาน",
          Math.max(1, Math.ceil(totalMinutes / 60)),
          index + 1,
        ],
      );
      sectionIds.set(plan.code, sectionResult.insertId);
    }

    const lessonIdsByOrder = new Map();
    for (const lesson of oldLessons) {
      const plan = sectionForOrder(Number(lesson.order_no));
      const sectionId = sectionIds.get(plan.code);
      const [lessonResult] = await currentDb.execute(
        `INSERT INTO lessons
           (section_id, title, description, content, lesson_type, video_url, duration_minutes, is_preview, status, sort_order)
         VALUES (?, ?, ?, ?, 'video', ?, ?, FALSE, ?, ?)`,
        [
          sectionId,
          `บทเรียนที่ ${lesson.order_no} ${lesson.title}`,
          lesson.summary,
          lesson.content,
          lesson.video_url,
          Number(lesson.duration_minutes ?? 25),
          lesson.is_published ? "published" : "draft",
          sortInSection(Number(lesson.order_no)),
        ],
      );
      const lessonId = lessonResult.insertId;
      lessonIdsByOrder.set(Number(lesson.order_no), lessonId);

      if (lesson.document_url) {
        await currentDb.execute(
          `INSERT INTO lesson_resources
             (lesson_id, title, resource_type, file_url, file_name, status, sort_order)
           VALUES (?, ?, 'pdf', ?, ?, 'published', 1)`,
          [
            lessonId,
            lesson.document_label || `เอกสารประกอบบทเรียนที่ ${lesson.order_no}`,
            lesson.document_url,
            lesson.document_label || null,
          ],
        );
      }
    }

    for (const worksheet of oldWorksheets) {
      const orderNo = Number(worksheet.order_no);
      const plan = sectionForOrder(orderNo);
      const sectionId = sectionIds.get(plan.code);
      const lessonId = lessonIdsByOrder.get(orderNo) ?? null;
      const pdfUrl = worksheet.instruction_pdf_url || pdfPathForOrder(orderNo);
      const maxScore = Number(worksheet.max_score ?? 20);

      const [taskResult] = await currentDb.execute(
        `INSERT INTO learning_tasks
           (course_id, section_id, lesson_id, task_type, title, description, instruction_html,
            instruction_file_url, instruction_file_name, resource_url, submission_mode, max_score,
            passing_score, weight_percent, allow_resubmission, require_evidence,
            evidence_required_count, status, sort_order)
         VALUES (?, ?, ?, 'worksheet', ?, ?, ?, ?, ?, ?, 'file_or_link', ?, 70, 0, TRUE, TRUE, 3, ?, ?)`,
        [
          currentCourse.id,
          sectionId,
          lessonId,
          `ใบงาน Word ที่ ${orderNo}: ${worksheet.title}`,
          worksheet.description,
          buildInstructionHtml(worksheet),
          pdfUrl,
          `word_worksheet_${String(orderNo).padStart(2, "0")}.pdf`,
          worksheet.resource_url || null,
          maxScore,
          worksheet.is_published ? "published" : "draft",
          orderNo,
        ],
      );

      const taskId = taskResult.insertId;
      await currentDb.execute(
        `INSERT INTO learning_task_attachments
           (task_id, title, file_url, file_name, file_type, sort_order)
         VALUES (?, ?, ?, ?, 'pdf', 1)`,
        [
          taskId,
          `PDF ใบงาน Word ที่ ${orderNo}`,
          pdfUrl,
          `word_worksheet_${String(orderNo).padStart(2, "0")}.pdf`,
        ],
      );

      const rubrics = [
        ["ทำตามโจทย์และขั้นตอนครบถ้วน", "อ่านโจทย์ เข้าใจเป้าหมาย และปฏิบัติครบตามคำสั่ง", 5],
        ["ความถูกต้องของเอกสาร/ชิ้นงาน", "ชิ้นงานถูกต้องตามรูปแบบและเงื่อนไขของใบงาน", 7],
        ["ความเรียบร้อยและการจัดรูปแบบ", "จัดรูปแบบเอกสารเหมาะสม อ่านง่าย และเป็นระเบียบ", 5],
        ["การส่งงานและหลักฐานประกอบ", "ส่งไฟล์หรือลิงก์ผลงาน พร้อมหลักฐานตามจำนวนที่กำหนด", 3],
      ];

      for (let index = 0; index < rubrics.length; index += 1) {
        const [title, description, score] = rubrics[index];
        await currentDb.execute(
          `INSERT INTO learning_task_rubrics
             (task_id, title, description, max_score, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [taskId, title, description, score, index + 1],
        );
      }
    }

    const totalDuration = oldLessons.reduce((sum, lesson) => sum + Number(lesson.duration_minutes ?? 0), 0);
    await currentDb.execute(
      `UPDATE courses
       SET duration_minutes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [totalDuration, currentCourse.id],
    );

    await currentDb.commit();

    const [counts] = await currentDb.execute(
      `SELECT
         (SELECT COUNT(*) FROM course_sections WHERE course_id = ? AND code LIKE ? AND deleted_at IS NULL) AS sections,
         (SELECT COUNT(*)
            FROM lessons l
            JOIN course_sections s ON s.id = l.section_id
           WHERE s.course_id = ? AND s.code LIKE ? AND l.deleted_at IS NULL) AS lessons,
         (SELECT COUNT(*) FROM learning_tasks
           WHERE course_id = ? AND instruction_file_url LIKE '/files/word_pdf/word_worksheet_%' AND deleted_at IS NULL) AS worksheets,
         (SELECT COUNT(*) FROM learning_task_rubrics rb
            JOIN learning_tasks t ON t.id = rb.task_id
           WHERE t.course_id = ? AND t.instruction_file_url LIKE '/files/word_pdf/word_worksheet_%' AND t.deleted_at IS NULL) AS rubrics`,
      [
        currentCourse.id,
        `${IMPORT_SECTION_CODE_PREFIX}%`,
        currentCourse.id,
        `${IMPORT_SECTION_CODE_PREFIX}%`,
        currentCourse.id,
        currentCourse.id,
      ],
    );

    console.log(JSON.stringify({
      course: currentCourse,
      copiedPdfCount,
      imported: {
        sections: Number(counts[0].sections),
        lessons: Number(counts[0].lessons),
        worksheets: Number(counts[0].worksheets),
        rubrics: Number(counts[0].rubrics),
      },
    }, null, 2));
  } catch (error) {
    await currentDb.rollback().catch(() => {});
    throw error;
  } finally {
    await oldDb.end().catch(() => {});
    await currentDb.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
