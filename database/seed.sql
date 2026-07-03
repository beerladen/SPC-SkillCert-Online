SET NAMES utf8mb4;
SET time_zone = '+07:00';

USE spc_skillcert_online;

SET @demo_password_hash = '$2b$10$NaSvzbybu3noX6J1bO9b3.bhHov9SNf.tyoZX.tKyKii.4MNDruhi';
SET @primary_admin_password_hash = '$2b$10$1ZSYAxZ0gwoPKNct9uagcuez8WE9Wgqn3ObSacghiy5QFMj4R116G';

INSERT INTO users (name, email, password_hash, role, status, last_login_at) VALUES
('ผู้ดูแลระบบหลัก', 'saengpet21@gmail.com', @primary_admin_password_hash, 'admin', 'active', '2026-06-30 08:00:00'),
('ผู้ดูแลระบบ', 'admin@spc.ac.th', @demo_password_hash, 'admin', 'active', '2026-06-29 08:30:00'),
('เจ้าหน้าที่ศูนย์อบรม', 'staff@spc.ac.th', @demo_password_hash, 'staff', 'active', '2026-06-29 09:05:00'),
('อ.กิตติพงศ์ มณีรัตน์', 'teacher1@spc.ac.th', @demo_password_hash, 'instructor', 'active', '2026-06-28 15:22:00'),
('อ.นภัสสร พงษ์สุวรรณ', 'teacher2@spc.ac.th', @demo_password_hash, 'instructor', 'active', NULL),
('อ.วราภรณ์ ศรีวิชัย', 'teacher3@spc.ac.th', @demo_password_hash, 'instructor', 'active', NULL),
('ผู้เข้าอบรมตัวอย่าง', 'learner@spc.ac.th', @demo_password_hash, 'student', 'active', '2026-06-29 10:12:00'),
('สมชาย ใจดี', 'somchai@example.com', @demo_password_hash, 'student', 'active', NULL),
('ณัฐพร แก้วใส', 'natthaporn@example.com', @demo_password_hash, 'student', 'active', NULL),
('กมลชนก ศรีสุข', 'kamonchanok@example.com', @demo_password_hash, 'student', 'active', NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = IF(deleted_at IS NULL, VALUES(status), status),
  last_login_at = VALUES(last_login_at);

INSERT INTO profiles (user_id, phone, address)
SELECT id, NULL, 'ศูนย์อบรมวิชาชีพระยะสั้น วิทยาลัยสารพัดช่าง'
FROM users
WHERE email IN ('saengpet21@gmail.com', 'admin@spc.ac.th', 'staff@spc.ac.th')
ON DUPLICATE KEY UPDATE address = VALUES(address);

INSERT INTO profiles (user_id, phone, address)
SELECT id, NULL, 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ'
FROM users
WHERE email IN ('learner@spc.ac.th', 'somchai@example.com', 'natthaporn@example.com', 'kamonchanok@example.com')
ON DUPLICATE KEY UPDATE address = VALUES(address);

INSERT INTO instructors (user_id, display_name, position, bio) VALUES
((SELECT id FROM users WHERE email = 'saengpet21@gmail.com'), 'ผู้ดูแลระบบหลัก', 'ผู้สอนและผู้ดูแลระบบ', 'บัญชีแอดมินหลักที่สามารถเป็นผู้สอนประจำหลักสูตรได้'),
((SELECT id FROM users WHERE email = 'teacher1@spc.ac.th'), 'อ.กิตติพงศ์ มณีรัตน์', 'ผู้สอนด้านคอมพิวเตอร์และระบบสำนักงาน', 'เชี่ยวชาญหลักสูตรดิจิทัล งานเอกสาร และเครื่องมือ AI'),
((SELECT id FROM users WHERE email = 'teacher2@spc.ac.th'), 'อ.นภัสสร พงษ์สุวรรณ', 'ผู้สอนด้านธุรกิจและการตลาดดิจิทัล', 'เชี่ยวชาญธุรกิจขนาดเล็ก การตลาดออนไลน์ และแผนปฏิบัติการ'),
((SELECT id FROM users WHERE email = 'teacher3@spc.ac.th'), 'อ.วราภรณ์ ศรีวิชัย', 'ผู้สอนด้านอาหาร งานบริการ และอาชีพอิสระ', 'เชี่ยวชาญมาตรฐานงานบริการ สุขอนามัย และต้นทุนอาหาร')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  position = VALUES(position),
  bio = VALUES(bio),
  status = 'active';

INSERT INTO permissions (permission_key, description) VALUES
('admin.dashboard.view', 'ดูภาพรวมหลังบ้าน'),
('courses.manage', 'จัดการหลักสูตรและบทเรียน'),
('registrations.review', 'ตรวจรายการลงทะเบียน'),
('payments.review', 'ตรวจหลักฐานค่าลงทะเบียน'),
('assessments.grade', 'ตรวจแบบทดสอบและใบงาน'),
('certificates.issue', 'ออกและยกเลิกใบประกาศนียบัตร'),
('reports.export', 'ส่งออกรายงาน'),
('users.manage', 'จัดการผู้ใช้งาน')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'staff', id FROM permissions
WHERE permission_key IN ('admin.dashboard.view', 'registrations.review', 'payments.review', 'assessments.grade', 'certificates.issue', 'reports.export');

INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'instructor', id FROM permissions
WHERE permission_key IN ('courses.manage', 'assessments.grade');

INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('คอมพิวเตอร์และเทคโนโลยี', 'technology', '💻', 'ทักษะดิจิทัล โปรแกรมสำนักงาน เว็บไซต์ และเครื่องมือ AI', 1),
('ธุรกิจและผู้ประกอบการ', 'business', '📊', 'บัญชี การขาย การตลาดออนไลน์ และการเริ่มต้นธุรกิจขนาดเล็ก', 2),
('อาหารและงานบริการ', 'service', '🍽️', 'งานบริการ อาหาร เครื่องดื่ม และมาตรฐานงานอาชีพ', 3),
('ภาษาและการสื่อสาร', 'language', '🗣️', 'ภาษาอังกฤษเพื่ออาชีพ การสื่อสาร และงานบริการ', 4),
('ออกแบบและสื่อสร้างสรรค์', 'creative', '🎨', 'กราฟิก คอนเทนต์ วิดีโอ และสื่อประชาสัมพันธ์', 5)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  icon = VALUES(icon),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO courses (
  category_id, instructor_id, title, slug, short_description, description,
  cover_image_url, registration_fee, original_fee, duration_minutes, capacity,
  format, level, status, starts_at, published_at
) VALUES
(
  (SELECT id FROM categories WHERE slug = 'technology'),
  (SELECT id FROM instructors WHERE user_id = (SELECT id FROM users WHERE email = 'teacher1@spc.ac.th')),
  'ใช้งานคอมพิวเตอร์สำนักงานและ AI เพื่อเพิ่มประสิทธิภาพงาน',
  'office-ai-productivity',
  'เรียนรู้ Word, Excel, PowerPoint และเครื่องมือ AI สำหรับงานเอกสารจริงในหน่วยงาน',
  'หลักสูตรระยะสั้นสำหรับผู้ที่ต้องการพัฒนาทักษะคอมพิวเตอร์สำนักงาน ตั้งแต่การจัดทำเอกสาร ตารางคำนวณ งานนำเสนอ ไปจนถึงการใช้ AI ช่วยสรุป วิเคราะห์ และสร้างเอกสารอย่างเป็นระบบ',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  900, 1500, 1080, 60, 'live_online', 'beginner', 'open', '2026-07-15 09:00:00', NOW()
),
(
  (SELECT id FROM categories WHERE slug = 'business'),
  (SELECT id FROM instructors WHERE user_id = (SELECT id FROM users WHERE email = 'teacher2@spc.ac.th')),
  'การตลาดดิจิทัลสำหรับอาชีพอิสระและธุรกิจขนาดเล็ก',
  'digital-marketing-small-business',
  'วางแผนเพจ ทำคอนเทนต์ ยิงโฆษณาเบื้องต้น และวัดผลยอดขายด้วยเครื่องมือออนไลน์',
  'เรียนกระบวนการทำการตลาดออนไลน์สำหรับผู้เริ่มต้น ตั้งแต่การกำหนดกลุ่มเป้าหมาย ทำคอนเทนต์สินค้า วางปฏิทินโพสต์ และอ่านรายงานผลอย่างเป็นขั้นตอน',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80',
  750, NULL, 900, 50, 'online', 'beginner', 'nearly_full', '2026-07-20 09:00:00', NOW()
),
(
  (SELECT id FROM categories WHERE slug = 'service'),
  (SELECT id FROM instructors WHERE user_id = (SELECT id FROM users WHERE email = 'teacher3@spc.ac.th')),
  'อาหารว่าง เครื่องดื่ม และมาตรฐานงานบริการ',
  'food-service-standard',
  'ฝึกวางแผนเมนู ต้นทุน บรรจุภัณฑ์ และมาตรฐานบริการสำหรับงานอาชีพ',
  'หลักสูตรสำหรับผู้สนใจเริ่มต้นอาชีพด้านอาหารว่างและเครื่องดื่ม ครอบคลุมการคำนวณต้นทุน การควบคุมคุณภาพ การนำเสนอสินค้า และมาตรฐานบริการที่ใช้ได้จริง',
  'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80',
  600, 900, 720, 40, 'recorded', 'beginner', 'open', '2026-08-01 09:00:00', NOW()
),
(
  (SELECT id FROM categories WHERE slug = 'language'),
  (SELECT id FROM instructors WHERE user_id = (SELECT id FROM users WHERE email = 'teacher2@spc.ac.th')),
  'ภาษาอังกฤษเพื่อการบริการและอาชีพระยะสั้น',
  'english-for-service-career',
  'ฝึกประโยคที่ใช้จริงในการทักทาย แนะนำบริการ รับเรื่อง และสื่อสารกับลูกค้า',
  'พัฒนาทักษะภาษาอังกฤษพื้นฐานที่จำเป็นต่อการทำงานบริการ ผ่านสถานการณ์จำลองและแบบฝึกหัดออนไลน์ พร้อมวัดผลก่อนและหลังเรียน',
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
  500, NULL, 600, 45, 'online', 'beginner', 'open', '2026-08-05 09:00:00', NOW()
)
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  instructor_id = VALUES(instructor_id),
  title = VALUES(title),
  short_description = VALUES(short_description),
  description = VALUES(description),
  cover_image_url = VALUES(cover_image_url),
  registration_fee = VALUES(registration_fee),
  original_fee = VALUES(original_fee),
  duration_minutes = VALUES(duration_minutes),
  capacity = VALUES(capacity),
  format = VALUES(format),
  level = VALUES(level),
  status = IF(deleted_at IS NULL AND status <> 'archived', VALUES(status), status),
  starts_at = VALUES(starts_at),
  published_at = VALUES(published_at);

INSERT INTO course_completion_rules (
  course_id,
  required_progress_percent,
  required_post_test_score,
  require_all_assignments,
  certificate_enabled,
  certificate_document_type
)
SELECT id, 80, 70, TRUE, TRUE, 'honor_certificate' FROM courses
ON DUPLICATE KEY UPDATE
  required_progress_percent = VALUES(required_progress_percent),
  required_post_test_score = VALUES(required_post_test_score),
  require_all_assignments = VALUES(require_all_assignments),
  certificate_enabled = VALUES(certificate_enabled),
  certificate_document_type = VALUES(certificate_document_type);

INSERT INTO promotions (name, description, discount_type, discount_value, starts_at, ends_at, status, created_by) VALUES
('ส่วนลดเปิดรุ่นคอมพิวเตอร์สำนักงาน', 'ส่วนลดค่าลงทะเบียนสำหรับผู้สมัครรุ่นแรกของหลักสูตรคอมพิวเตอร์สำนักงานและ AI', 'amount', 600, '2026-06-20 00:00:00', '2026-07-10 23:59:59', 'active', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('ส่วนลดอาชีพอาหารว่าง', 'ส่วนลดค่าลงทะเบียนสำหรับหลักสูตรอาหารว่าง เครื่องดื่ม และมาตรฐานงานบริการ', 'amount', 300, '2026-06-20 00:00:00', '2026-07-25 23:59:59', 'active', (SELECT id FROM users WHERE email = 'admin@spc.ac.th'))
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  starts_at = VALUES(starts_at),
  ends_at = VALUES(ends_at),
  status = VALUES(status),
  created_by = VALUES(created_by);

INSERT INTO course_promotions (course_id, promotion_id)
SELECT c.id, p.id
FROM courses c
JOIN promotions p ON p.name = 'ส่วนลดเปิดรุ่นคอมพิวเตอร์สำนักงาน'
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE promotion_id = VALUES(promotion_id);

INSERT INTO course_promotions (course_id, promotion_id)
SELECT c.id, p.id
FROM courses c
JOIN promotions p ON p.name = 'ส่วนลดอาชีพอาหารว่าง'
WHERE c.slug = 'food-service-standard'
ON DUPLICATE KEY UPDATE promotion_id = VALUES(promotion_id);

INSERT INTO course_sections (course_id, title, description, sort_order)
SELECT id, 'พื้นฐานระบบเรียนและงานเอกสาร', 'การเข้าใช้งานระบบและมาตรฐานเอกสารสำนักงาน', 1 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description);

INSERT INTO course_sections (course_id, title, description, sort_order)
SELECT id, 'Excel และการวิเคราะห์ข้อมูลเบื้องต้น', 'สูตรพื้นฐาน ตารางสรุป และกราฟรายงาน', 2 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description);

INSERT INTO course_sections (course_id, title, description, sort_order)
SELECT id, 'AI สำหรับงานสำนักงาน', 'Prompt สำหรับงานเอกสารและงานนำเสนอ', 3 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description);

INSERT INTO course_sections (course_id, title, description, sort_order)
SELECT id, 'พื้นฐานงานอาหารและบริการ', 'สุขอนามัย วัตถุดิบ และมาตรฐานบริการ', 1 FROM courses WHERE slug = 'food-service-standard'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description);

INSERT INTO lessons (section_id, title, description, lesson_type, video_url, duration_minutes, is_preview, sort_order)
SELECT s.id, 'แนะนำระบบเรียนและมาตรฐานเอกสารสำนักงาน', 'เรียนรู้การเข้าใช้งานระบบ วิธีดูคลิป ดาวน์โหลดใบความรู้ และส่งงานผ่านระบบ', 'video', '/uploads/videos/office-ai-lesson-01.mp4', 18, TRUE, 1
FROM course_sections s JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'office-ai-productivity' AND s.sort_order = 1
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), video_url = VALUES(video_url), duration_minutes = VALUES(duration_minutes);

INSERT INTO lessons (section_id, title, description, lesson_type, video_url, duration_minutes, sort_order)
SELECT s.id, 'Excel พื้นฐานสำหรับรายงานงานสำนักงาน', 'ฝึกสูตรพื้นฐาน การจัดตาราง และการสร้างกราฟจากข้อมูลตัวอย่าง', 'video', '/uploads/videos/office-ai-lesson-02.mp4', 32, 1
FROM course_sections s JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'office-ai-productivity' AND s.sort_order = 2
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), video_url = VALUES(video_url), duration_minutes = VALUES(duration_minutes);

INSERT INTO lessons (section_id, title, description, lesson_type, video_url, duration_minutes, sort_order)
SELECT s.id, 'ใช้ AI ช่วยสรุปและสร้างเอกสาร', 'ฝึกเขียนคำสั่ง สรุปเอกสาร และเตรียมโครงร่างงานนำเสนอ', 'practice', '/uploads/videos/office-ai-lesson-03.mp4', 40, 1
FROM course_sections s JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'office-ai-productivity' AND s.sort_order = 3
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), video_url = VALUES(video_url), duration_minutes = VALUES(duration_minutes);

INSERT INTO lessons (section_id, title, description, lesson_type, video_url, duration_minutes, sort_order)
SELECT s.id, 'สุขอนามัยและมาตรฐานงานบริการ', 'ทบทวนมาตรฐานการเตรียมอาหารและการบริการ', 'video', '/uploads/videos/food-service-hygiene.mp4', 24, 1
FROM course_sections s JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'food-service-standard' AND s.sort_order = 1
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), video_url = VALUES(video_url), duration_minutes = VALUES(duration_minutes);

INSERT INTO lesson_resources (lesson_id, title, resource_type, file_url, file_name, file_size, sort_order)
SELECT l.id, 'ใบความรู้: ขั้นตอนการเข้าเรียนออนไลน์', 'pdf', '/uploads/resources/office-ai-lesson-01.pdf', 'office-ai-lesson-01.pdf', '1.2 MB', 1
FROM lessons l JOIN course_sections s ON s.id = l.section_id JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'office-ai-productivity' AND l.title = 'แนะนำระบบเรียนและมาตรฐานเอกสารสำนักงาน'
ON DUPLICATE KEY UPDATE title = VALUES(title), file_url = VALUES(file_url), file_name = VALUES(file_name), file_size = VALUES(file_size);

INSERT INTO lesson_resources (lesson_id, title, resource_type, file_url, file_name, file_size, sort_order)
SELECT l.id, 'ไฟล์ฝึกปฏิบัติ Excel', 'worksheet', '/uploads/resources/excel-practice-sheet.xlsx', 'excel-practice-sheet.xlsx', '760 KB', 1
FROM lessons l JOIN course_sections s ON s.id = l.section_id JOIN courses c ON c.id = s.course_id
WHERE c.slug = 'office-ai-productivity' AND l.title = 'Excel พื้นฐานสำหรับรายงานงานสำนักงาน'
ON DUPLICATE KEY UPDATE title = VALUES(title), file_url = VALUES(file_url), file_name = VALUES(file_name), file_size = VALUES(file_size);

INSERT INTO assessments (course_id, lesson_id, title, type, description, passing_score, max_attempts, time_limit_minutes, is_required, sort_order)
SELECT id, NULL, 'แบบทดสอบก่อนเรียน', 'pre_test', 'ประเมินพื้นฐานก่อนเริ่มเรียน', 0, 1, 15, TRUE, 1 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

INSERT INTO assessments (course_id, lesson_id, title, type, description, passing_score, max_attempts, time_limit_minutes, is_required, sort_order)
SELECT id, NULL, 'Quiz: งานเอกสารและ Excel', 'quiz', 'แบบทดสอบท้ายบทเกี่ยวกับงานเอกสารและ Excel', 70, 3, 20, TRUE, 2 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

INSERT INTO assessments (course_id, lesson_id, title, type, description, passing_score, max_attempts, time_limit_minutes, is_required, sort_order)
SELECT id, NULL, 'ใบงานที่ 1: จัดทำรายงาน Excel', 'assignment', 'ดาวน์โหลดไฟล์ฝึกปฏิบัติ กรอกสูตร สร้างกราฟ และอัปโหลดกลับเข้าสู่ระบบ', 70, NULL, NULL, TRUE, 3 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

INSERT INTO assessments (course_id, lesson_id, title, type, description, passing_score, max_attempts, time_limit_minutes, is_required, sort_order)
SELECT id, NULL, 'แบบทดสอบหลังเรียน', 'post_test', 'แบบทดสอบปลายหลักสูตรเพื่อใช้ประกอบการออกใบประกาศ', 70, 2, 45, TRUE, 4 FROM courses WHERE slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

INSERT INTO assessments (course_id, lesson_id, title, type, description, passing_score, max_attempts, is_required, sort_order)
SELECT id, NULL, 'ชิ้นงานเมนูต้นแบบ', 'assignment', 'ส่งภาพเมนู ต้นทุน และคำอธิบายมาตรฐานบริการ', 70, NULL, TRUE, 1 FROM courses WHERE slug = 'food-service-standard'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), passing_score = VALUES(passing_score);

UPDATE course_sections s
JOIN courses c ON c.id = s.course_id
SET s.status = 'published'
WHERE c.slug IN ('office-ai-productivity', 'food-service-standard');

UPDATE lessons l
JOIN course_sections s ON s.id = l.section_id
JOIN courses c ON c.id = s.course_id
SET l.status = 'published'
WHERE c.slug IN ('office-ai-productivity', 'food-service-standard');

UPDATE lesson_resources r
JOIN lessons l ON l.id = r.lesson_id
JOIN course_sections s ON s.id = l.section_id
JOIN courses c ON c.id = s.course_id
SET r.status = 'published'
WHERE c.slug IN ('office-ai-productivity', 'food-service-standard');

UPDATE assessments a
JOIN courses c ON c.id = a.course_id
SET a.status = 'published',
    a.randomize_questions = IF(a.type IN ('pre_test', 'post_test'), TRUE, a.randomize_questions),
    a.randomize_options = IF(a.type IN ('pre_test', 'post_test', 'quiz'), TRUE, a.randomize_options),
    a.compare_group = IF(a.type IN ('pre_test', 'post_test'), 'main', a.compare_group),
    a.counts_toward_completion = IF(a.type = 'pre_test', FALSE, TRUE)
WHERE c.slug IN ('office-ai-productivity', 'food-service-standard');

UPDATE assessments post_test
JOIN courses c ON c.id = post_test.course_id
JOIN assessments pre_test ON pre_test.course_id = c.id AND pre_test.type = 'pre_test'
SET post_test.shared_question_source_id = pre_test.id
WHERE c.slug = 'office-ai-productivity'
  AND post_test.type = 'post_test';

INSERT INTO questions (assessment_id, question_text, question_type, score, explanation, status, sort_order)
SELECT a.id, 'ข้อใดเป็นขั้นตอนที่เหมาะสมก่อนเริ่มใช้ AI ช่วยทำเอกสารสำนักงาน', 'single_choice', 1, 'ควรกำหนดเป้าหมายและตรวจสอบข้อมูลต้นทางก่อนใช้ AI เพื่อให้ผลลัพธ์ถูกต้อง', 'active', 1
FROM assessments a JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test'
ON DUPLICATE KEY UPDATE question_text = VALUES(question_text), explanation = VALUES(explanation), status = VALUES(status);

INSERT INTO questions (assessment_id, question_text, question_type, score, explanation, status, sort_order)
SELECT a.id, 'เมื่อต้องส่งรายงาน Excel เพื่อให้ครูตรวจ ควรเตรียมสิ่งใดให้ครบที่สุด', 'single_choice', 1, 'ไฟล์งานควรเปิดตรวจได้ มีสูตรครบ และมีคำอธิบายประกอบที่จำเป็น', 'active', 2
FROM assessments a JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test'
ON DUPLICATE KEY UPDATE question_text = VALUES(question_text), explanation = VALUES(explanation), status = VALUES(status);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'กำหนดเป้าหมายงานและตรวจสอบข้อมูลต้นทาง', TRUE, 1
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 1
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'คัดลอกคำตอบจาก AI ไปใช้ทันทีโดยไม่ตรวจทาน', FALSE, 2
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 1
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'เปิดหลายโปรแกรมพร้อมกันเพื่อให้ทำงานเร็วขึ้นเสมอ', FALSE, 3
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 1
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'ไฟล์งานที่เปิดตรวจได้ สูตรครบ และมีคำอธิบายประกอบ', TRUE, 1
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 2
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'ส่งเฉพาะภาพหน้าจอโดยไม่มีไฟล์ต้นฉบับ', FALSE, 2
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 2
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT q.id, 'ส่งไฟล์เปล่าก่อนแล้วค่อยแก้ไขภายหลัง', FALSE, 3
FROM questions q JOIN assessments a ON a.id = q.assessment_id JOIN courses c ON c.id = a.course_id
WHERE c.slug = 'office-ai-productivity' AND a.type = 'pre_test' AND q.sort_order = 2
ON DUPLICATE KEY UPDATE option_text = VALUES(option_text), is_correct = VALUES(is_correct);

INSERT INTO registrations (registration_no, user_id, subtotal, discount_amount, total_amount, status, submitted_at, approved_at, approved_by, note) VALUES
('REG-2569-0018', (SELECT id FROM users WHERE email = 'somchai@example.com'), 900, 0, 900, 'pending_review', '2026-06-28 11:20:00', NULL, NULL, 'รอเจ้าหน้าที่ตรวจสอบยอดชำระและสลิป'),
('REG-2569-0017', (SELECT id FROM users WHERE email = 'natthaporn@example.com'), 750, 0, 750, 'approved', '2026-06-27 10:45:00', '2026-06-27 14:10:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th'), 'อนุมัติแล้วและเปิดสิทธิ์เข้าเรียน'),
('REG-2569-0016', (SELECT id FROM users WHERE email = 'kamonchanok@example.com'), 600, 0, 600, 'completed', '2026-06-25 09:30:00', '2026-06-25 12:00:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th'), 'เรียนจบและออกใบประกาศแล้ว')
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  subtotal = VALUES(subtotal),
  total_amount = VALUES(total_amount),
  status = VALUES(status),
  submitted_at = VALUES(submitted_at),
  approved_at = VALUES(approved_at),
  approved_by = VALUES(approved_by),
  note = VALUES(note);

INSERT IGNORE INTO registration_items (registration_id, course_id, registration_fee)
SELECT r.id, c.id, c.registration_fee
FROM registrations r JOIN courses c ON c.slug = 'office-ai-productivity'
WHERE r.registration_no = 'REG-2569-0018';

INSERT IGNORE INTO registration_items (registration_id, course_id, registration_fee)
SELECT r.id, c.id, c.registration_fee
FROM registrations r JOIN courses c ON c.slug = 'digital-marketing-small-business'
WHERE r.registration_no = 'REG-2569-0017';

INSERT IGNORE INTO registration_items (registration_id, course_id, registration_fee)
SELECT r.id, c.id, c.registration_fee
FROM registrations r JOIN courses c ON c.slug = 'food-service-standard'
WHERE r.registration_no = 'REG-2569-0016';

INSERT INTO registration_payments (registration_id, amount, method, status, paid_at, reviewed_at, reviewed_by, note)
SELECT r.id, r.total_amount, 'bank_transfer', 'pending_review', '2026-06-28 11:10:00', NULL, NULL, 'แนบหลักฐานแล้ว รอตรวจสอบ'
FROM registrations r
WHERE r.registration_no = 'REG-2569-0018'
  AND NOT EXISTS (SELECT 1 FROM registration_payments p WHERE p.registration_id = r.id);

INSERT INTO registration_payments (registration_id, amount, method, status, paid_at, reviewed_at, reviewed_by, note)
SELECT r.id, r.total_amount, 'promptpay', 'approved', '2026-06-27 10:30:00', '2026-06-27 14:10:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th'), 'ตรวจสอบแล้วถูกต้อง'
FROM registrations r
WHERE r.registration_no = 'REG-2569-0017'
  AND NOT EXISTS (SELECT 1 FROM registration_payments p WHERE p.registration_id = r.id);

INSERT INTO registration_payments (registration_id, amount, method, status, paid_at, reviewed_at, reviewed_by, note)
SELECT r.id, r.total_amount, 'bank_transfer', 'approved', '2026-06-25 09:10:00', '2026-06-25 12:00:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th'), 'ตรวจสอบแล้วถูกต้อง'
FROM registrations r
WHERE r.registration_no = 'REG-2569-0016'
  AND NOT EXISTS (SELECT 1 FROM registration_payments p WHERE p.registration_id = r.id);

INSERT INTO payment_evidences (payment_id, file_url, original_file_name, mime_type)
SELECT p.id, CONCAT('/uploads/payments/payment-slip-', LOWER(REPLACE(r.registration_no, 'REG-2569-', 'reg-')), '.jpg'), CONCAT('payment-slip-', LOWER(REPLACE(r.registration_no, 'REG-2569-', 'reg-')), '.jpg'), 'image/jpeg'
FROM registration_payments p JOIN registrations r ON r.id = p.registration_id
WHERE NOT EXISTS (SELECT 1 FROM payment_evidences pe WHERE pe.payment_id = p.id);

INSERT IGNORE INTO enrollments (user_id, course_id, registration_item_id, status, progress_percent, enrolled_at, completed_at)
SELECT r.user_id, ri.course_id, ri.id, IF(r.status = 'completed', 'completed', 'active'), IF(r.status = 'completed', 100, 64), r.approved_at, IF(r.status = 'completed', '2026-06-25 18:00:00', NULL)
FROM registrations r JOIN registration_items ri ON ri.registration_id = r.id
WHERE r.status IN ('approved', 'completed');

INSERT IGNORE INTO enrollments (user_id, course_id, status, progress_percent, enrolled_at)
SELECT (SELECT id FROM users WHERE email = 'learner@spc.ac.th'), id, 'active', 64, '2026-06-28 12:00:00'
FROM courses WHERE slug = 'office-ai-productivity';

INSERT IGNORE INTO enrollments (user_id, course_id, status, progress_percent, enrolled_at, completed_at)
SELECT (SELECT id FROM users WHERE email = 'learner@spc.ac.th'), id, 'completed', 100, '2026-06-25 12:00:00', '2026-06-25 18:00:00'
FROM courses WHERE slug = 'food-service-standard';

INSERT INTO assignment_submissions (
  assessment_id, enrollment_id, submission_no, title, description,
  submitted_file_url, submitted_file_name, status, score, feedback,
  submitted_at, graded_at, graded_by
)
SELECT a.id, e.id, 'ASSIGN-2569-0042', 'ใบงานที่ 1: จัดทำรายงาน Excel', 'ส่งไฟล์รายงาน Excel สำหรับตรวจงาน',
       '/uploads/assignments/excel-report-somchai.xlsx', 'excel-report-somchai.xlsx', 'pending_review', NULL, NULL,
       '2026-06-29 09:24:00', NULL, NULL
FROM assessments a
JOIN courses c ON c.id = a.course_id AND c.slug = 'office-ai-productivity'
JOIN enrollments e ON e.course_id = c.id
JOIN users u ON u.id = e.user_id AND u.email = 'learner@spc.ac.th'
WHERE a.type = 'assignment'
ON DUPLICATE KEY UPDATE status = VALUES(status), submitted_file_name = VALUES(submitted_file_name), submitted_at = VALUES(submitted_at);

INSERT INTO assignment_submissions (
  assessment_id, enrollment_id, submission_no, title, description,
  submitted_file_url, submitted_file_name, status, score, feedback,
  submitted_at, graded_at, graded_by
)
SELECT a.id, e.id, 'ASSIGN-2569-0040', 'ชิ้นงานเมนูต้นแบบ', 'ส่งภาพเมนู ต้นทุน และมาตรฐานบริการ',
       '/uploads/assignments/menu-project.pdf', 'menu-project.pdf', 'graded', 92, 'จัดรูปแบบดี คำนวณต้นทุนครบถ้วน',
       '2026-06-24 13:42:00', '2026-06-25 09:00:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th')
FROM assessments a
JOIN courses c ON c.id = a.course_id AND c.slug = 'food-service-standard'
JOIN enrollments e ON e.course_id = c.id
JOIN users u ON u.id = e.user_id AND u.email = 'learner@spc.ac.th'
WHERE a.type = 'assignment'
ON DUPLICATE KEY UPDATE status = VALUES(status), score = VALUES(score), feedback = VALUES(feedback), graded_at = VALUES(graded_at);

INSERT INTO learning_tasks (
  course_id, section_id, lesson_id, assessment_id, task_type, title, description,
  instruction_html, instruction_file_url, instruction_file_name, resource_url,
  submission_mode, max_score, passing_score, weight_percent,
  due_days_after_enrollment, allow_resubmission, require_evidence, evidence_required_count,
  status, sort_order
)
SELECT c.id, s.id, l.id, a.id, 'worksheet',
       'ใบงานที่ 1: จัดทำรายงาน Excel สรุปข้อมูล',
       'ดาวน์โหลดไฟล์ตัวอย่าง กรอกสูตร สร้างกราฟ และส่งไฟล์กลับเข้าระบบ',
       '<h2>ใบงาน Excel</h2><p>ให้ผู้เรียนจัดทำตารางสรุปยอดขายตัวอย่าง ใส่สูตรรวมยอด สร้างกราฟ และอธิบายผลลัพธ์สั้น ๆ</p>',
       '/uploads/resources/excel-practice-sheet.xlsx',
       'excel-practice-sheet.xlsx',
       '/uploads/resources/excel-practice-sheet.xlsx',
       'file_or_link', 100, 70, 20, 7, TRUE, TRUE, 2,
       'published', 1
FROM courses c
LEFT JOIN course_sections s ON s.course_id = c.id AND s.sort_order = 2
LEFT JOIN lessons l ON l.section_id = s.id AND l.sort_order = 1
LEFT JOIN assessments a ON a.course_id = c.id AND a.type = 'assignment' AND a.sort_order = 3
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  instruction_html = VALUES(instruction_html),
  status = VALUES(status),
  max_score = VALUES(max_score),
  passing_score = VALUES(passing_score),
  weight_percent = VALUES(weight_percent);

INSERT INTO learning_tasks (
  course_id, section_id, lesson_id, task_type, title, description,
  instruction_html, resource_url, submission_mode, max_score, passing_score, weight_percent,
  due_days_after_enrollment, allow_resubmission, require_evidence, evidence_required_count,
  status, sort_order
)
SELECT c.id, s.id, l.id, 'practice',
       'แบบฝึกปฏิบัติ: ใช้ AI ช่วยร่างเอกสารและตรวจทาน',
       'ให้ผู้เรียนเขียน prompt สร้างร่างเอกสาร ตรวจทาน และอัปโหลดไฟล์ผลงานพร้อมคำอธิบาย',
       '<h2>แบบฝึกปฏิบัติ AI</h2><p>สร้างเอกสาร 1 หน้าโดยใช้ AI ช่วยร่าง แล้วปรับแก้ด้วยตนเอง พร้อมแนบ prompt ที่ใช้และผลงานสุดท้าย</p>',
       '/uploads/resources/ai-document-practice.pdf',
       'file_or_link', 100, 70, 25, 10, TRUE, TRUE, 3,
       'published', 1
FROM courses c
LEFT JOIN course_sections s ON s.course_id = c.id AND s.sort_order = 3
LEFT JOIN lessons l ON l.section_id = s.id AND l.sort_order = 1
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  instruction_html = VALUES(instruction_html),
  status = VALUES(status),
  max_score = VALUES(max_score),
  passing_score = VALUES(passing_score),
  weight_percent = VALUES(weight_percent);

INSERT INTO learning_task_attachments (task_id, title, file_url, file_name, file_type, sort_order)
SELECT t.id, 'ไฟล์ตัวอย่างสำหรับทำใบงาน', '/uploads/resources/excel-practice-sheet.xlsx', 'excel-practice-sheet.xlsx', 'sheet', 1
FROM learning_tasks t JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity' AND t.task_type = 'worksheet' AND t.sort_order = 1
ON DUPLICATE KEY UPDATE title = VALUES(title), file_url = VALUES(file_url), file_name = VALUES(file_name), file_type = VALUES(file_type);

INSERT INTO learning_task_attachments (task_id, title, file_url, file_name, file_type, sort_order)
SELECT t.id, 'ตัวอย่าง prompt และรูปแบบรายงาน', '/uploads/resources/ai-document-practice.pdf', 'ai-document-practice.pdf', 'pdf', 1
FROM learning_tasks t JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity' AND t.task_type = 'practice' AND t.sort_order = 1
ON DUPLICATE KEY UPDATE title = VALUES(title), file_url = VALUES(file_url), file_name = VALUES(file_name), file_type = VALUES(file_type);

INSERT INTO learning_task_rubrics (task_id, title, description, max_score, sort_order)
SELECT t.id, 'ความถูกต้องตามโจทย์', 'งานตรงตามข้อกำหนดและตรวจสอบได้', 40, 1
FROM learning_tasks t JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), max_score = VALUES(max_score);

INSERT INTO learning_task_rubrics (task_id, title, description, max_score, sort_order)
SELECT t.id, 'ความครบถ้วนของไฟล์และหลักฐาน', 'แนบไฟล์ ลิงก์ หรือภาพหลักฐานตามที่กำหนด', 30, 2
FROM learning_tasks t JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), max_score = VALUES(max_score);

INSERT INTO learning_task_rubrics (task_id, title, description, max_score, sort_order)
SELECT t.id, 'การอธิบายกระบวนการทำงาน', 'ผู้เรียนอธิบายขั้นตอนและเหตุผลของผลงานได้ชัดเจน', 30, 3
FROM learning_tasks t JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), max_score = VALUES(max_score);

INSERT INTO learning_task_submissions (
  task_id, enrollment_id, submission_no, submitted_file_url, submitted_file_name,
  submitted_link_url, note, status, score, feedback, submitted_at, graded_at, graded_by
)
SELECT t.id, e.id, 'TASK-2569-0001', '/uploads/assignments/excel-report-learner.xlsx', 'excel-report-learner.xlsx',
       NULL, 'ส่งไฟล์ใบงาน Excel เพื่อให้ครูตรวจ', 'pending_review', NULL, NULL,
       '2026-06-29 09:24:00', NULL, NULL
FROM learning_tasks t
JOIN courses c ON c.id = t.course_id AND c.slug = 'office-ai-productivity'
JOIN enrollments e ON e.course_id = c.id
JOIN users u ON u.id = e.user_id AND u.email = 'learner@spc.ac.th'
WHERE t.task_type = 'worksheet' AND t.sort_order = 1
ON DUPLICATE KEY UPDATE
  submitted_file_url = VALUES(submitted_file_url),
  submitted_file_name = VALUES(submitted_file_name),
  status = VALUES(status),
  submitted_at = VALUES(submitted_at);

INSERT INTO learning_task_evidences (
  submission_id, task_id, enrollment_id, evidence_type, evidence_url, evidence_text, file_name, sort_order
)
SELECT s.id, s.task_id, s.enrollment_id, 'image', '/uploads/evidence/excel-formula-screenshot.jpg',
       'ภาพหน้าจอสูตรและกราฟที่สร้างจากใบงาน', 'excel-formula-screenshot.jpg', 1
FROM learning_task_submissions s
JOIN learning_tasks t ON t.id = s.task_id
JOIN courses c ON c.id = t.course_id
WHERE c.slug = 'office-ai-productivity' AND t.task_type = 'worksheet'
  AND NOT EXISTS (
    SELECT 1 FROM learning_task_evidences e
    WHERE e.submission_id = s.id AND e.sort_order = 1
  );

INSERT INTO course_evaluation_rules (course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order)
SELECT id, 'lesson_progress', 'เรียนออนไลน์ครบตามเกณฑ์', 20, 80, TRUE, 'active', 1 FROM courses
ON DUPLICATE KEY UPDATE title = VALUES(title), weight_percent = VALUES(weight_percent), passing_score = VALUES(passing_score), is_required = VALUES(is_required), status = VALUES(status), sort_order = VALUES(sort_order);

INSERT INTO course_evaluation_rules (course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order)
SELECT id, 'pre_test', 'แบบทดสอบก่อนเรียนเพื่อเทียบพัฒนาการ', 0, 0, FALSE, 'active', 2 FROM courses
ON DUPLICATE KEY UPDATE title = VALUES(title), weight_percent = VALUES(weight_percent), passing_score = VALUES(passing_score), is_required = VALUES(is_required), status = VALUES(status), sort_order = VALUES(sort_order);

INSERT INTO course_evaluation_rules (course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order)
SELECT id, 'worksheet', 'ใบงานระหว่างเรียน', 25, 70, TRUE, 'active', 3 FROM courses
ON DUPLICATE KEY UPDATE title = VALUES(title), weight_percent = VALUES(weight_percent), passing_score = VALUES(passing_score), is_required = VALUES(is_required), status = VALUES(status), sort_order = VALUES(sort_order);

INSERT INTO course_evaluation_rules (course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order)
SELECT id, 'practice', 'แบบฝึกปฏิบัติ/ชิ้นงาน', 25, 70, TRUE, 'active', 4 FROM courses
ON DUPLICATE KEY UPDATE title = VALUES(title), weight_percent = VALUES(weight_percent), passing_score = VALUES(passing_score), is_required = VALUES(is_required), status = VALUES(status), sort_order = VALUES(sort_order);

INSERT INTO course_evaluation_rules (course_id, criterion, title, weight_percent, passing_score, is_required, status, sort_order)
SELECT id, 'post_test', 'แบบทดสอบหลังเรียน', 30, 70, TRUE, 'active', 5 FROM courses
ON DUPLICATE KEY UPDATE title = VALUES(title), weight_percent = VALUES(weight_percent), passing_score = VALUES(passing_score), is_required = VALUES(is_required), status = VALUES(status), sort_order = VALUES(sort_order);

UPDATE certificate_templates
SET is_default = FALSE
WHERE name <> 'เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย';

INSERT INTO certificate_templates (
  name,
  background_url,
  signature_url,
  issuer_name,
  signer_name,
  signer_position,
  layout_config_json,
  status,
  is_default
) VALUES (
  'เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย',
  '/uploads/certificates/templates/spc-director-certificate-template.jpg',
  NULL,
  'วิทยาลัยสารพัดช่างสุรินทร์',
  NULL,
  'ผู้อำนวยการวิทยาลัย',
  JSON_OBJECT(
    'paper', JSON_OBJECT('size', 'A4', 'orientation', 'landscape'),
    'learnerName', JSON_OBJECT('x', 50, 'y', 46, 'width', 62),
    'courseTitle', JSON_OBJECT('x', 50, 'y', 58, 'width', 58),
    'certificateNo', JSON_OBJECT('x', 17, 'y', 82),
    'issuedAt', JSON_OBJECT('x', 50, 'y', 70),
    'signature', JSON_OBJECT('x', 50, 'y', 79),
    'qr', JSON_OBJECT('x', 84, 'y', 77)
  ),
  'active',
  TRUE
)
ON DUPLICATE KEY UPDATE
  background_url = VALUES(background_url),
  signature_url = VALUES(signature_url),
  issuer_name = VALUES(issuer_name),
  signer_name = VALUES(signer_name),
  signer_position = VALUES(signer_position),
  layout_config_json = VALUES(layout_config_json),
  status = VALUES(status),
  is_default = VALUES(is_default);

INSERT INTO certificates (certificate_no, enrollment_id, template_id, learner_name, course_title, issued_at, status, pdf_url, qr_payload)
SELECT 'SPC-CERT-2569-00021', e.id, (SELECT id FROM certificate_templates WHERE is_default = TRUE LIMIT 1), u.name, c.title, '2026-06-25 18:30:00', 'issued',
       '/uploads/certificates/SPC-CERT-2569-00021.pdf', 'SPC-CERT-2569-00021'
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN courses c ON c.id = e.course_id
WHERE u.email = 'learner@spc.ac.th' AND c.slug = 'food-service-standard'
ON DUPLICATE KEY UPDATE
  template_id = VALUES(template_id),
  learner_name = VALUES(learner_name),
  course_title = VALUES(course_title),
  issued_at = VALUES(issued_at),
  status = VALUES(status);

INSERT INTO announcements (title, summary, status, published_at, created_by) VALUES
('เปิดรับสมัครหลักสูตรรุ่นเดือนกรกฎาคม', 'ผู้สนใจสามารถลงทะเบียนหลักสูตรออนไลน์และแนบหลักฐานค่าลงทะเบียนผ่านระบบได้แล้ว', 'published', '2026-06-28 08:00:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th')),
('เพิ่มระบบตรวจสอบใบประกาศนียบัตรด้วย QR Code', 'หน่วยงานภายนอกสามารถตรวจสอบเลขที่ใบประกาศนียบัตรได้จากหน้าเว็บไซต์', 'published', '2026-06-24 08:00:00', (SELECT id FROM users WHERE email = 'staff@spc.ac.th'))
ON DUPLICATE KEY UPDATE summary = VALUES(summary), status = VALUES(status), published_at = VALUES(published_at);

INSERT INTO announcements
  (title, slug, summary, content, cover_image_url, category, is_featured, show_on_home,
   cta_label, cta_url, status, published_at, expires_at, view_count, created_by, updated_by) VALUES
('เปิดรับสมัครหลักสูตรออนไลน์รุ่นใหม่ ประจำเดือนกรกฎาคม', 'july-online-course-registration', 'ศูนย์อบรมเปิดรับสมัครหลักสูตรวิชาชีพระยะสั้นออนไลน์หลายหลักสูตร พร้อมระบบเรียนผ่านคลิป ใบงาน แบบทดสอบ และใบประกาศออนไลน์', 'ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ SPC SkillCert Online เปิดรับสมัครผู้สนใจเข้าอบรมหลักสูตรออนไลน์รุ่นใหม่ ประจำเดือนกรกฎาคม ผู้เรียนสามารถลงทะเบียนผ่านระบบ เรียนผ่านคลิปวิดีโอ ดาวน์โหลดใบความรู้ ทำแบบทดสอบ ส่งใบงานและแบบฝึกผ่านระบบ พร้อมรับใบประกาศนียบัตรออนไลน์เมื่อผ่านเกณฑ์ที่กำหนด', '/images/spc-hero-vocational-training.png', 'registration', TRUE, TRUE, 'ดูหลักสูตรที่เปิดรับสมัคร', '/courses', 'published', '2026-06-30 08:00:00', NULL, 124, COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1)), COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1))),
('แนะนำหลักสูตร Microsoft Word ในสำนักงาน พร้อมใบงานปฏิบัติ 30 ชุด', 'microsoft-word-office-worksheets-news', 'หลักสูตร Word สำหรับงานสำนักงาน เน้นเรียนจริง ปฏิบัติจริง มีใบงานและแบบฝึกให้ส่งผ่านระบบ', 'หลักสูตร Microsoft Word ในสำนักงานออกแบบสำหรับผู้ที่ต้องการพัฒนาทักษะงานเอกสารอย่างเป็นระบบ ผู้เรียนจะได้เรียนผ่านวิดีโอ ทำใบงานปฏิบัติ ตรวจความก้าวหน้า และส่งหลักฐานการทำงานผ่านระบบ เพื่อให้ครูผู้สอนประเมินผลได้ครบถ้วน', '/uploads/course-covers/1782740091251-9005710b-867f-427f-a273-38c19ee23bd5.png', 'course', FALSE, TRUE, 'ลงทะเบียนหลักสูตร Word', '/courses', 'published', '2026-06-30 09:00:00', NULL, 86, COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1)), COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1))),
('หลักสูตร Excel ในสำนักงาน เปิดเรียนฟรีพร้อมแบบทดสอบก่อนเรียนและหลังเรียน', 'excel-office-free-course-news', 'ฝึกใช้ Excel สำหรับงานสำนักงาน พร้อมแบบทดสอบ ใบงาน และระบบติดตามผลการเรียน', 'ผู้สนใจสามารถเข้าเรียนหลักสูตร Microsoft Excel ในสำนักงานได้ฟรี ระบบรองรับการเรียนผ่านบทเรียนออนไลน์ แบบทดสอบก่อนเรียนและหลังเรียน รวมถึงใบงานปฏิบัติ เพื่อให้ผู้เรียนเห็นพัฒนาการของตนเองและนำทักษะไปใช้ในงานสำนักงานได้จริง', '/uploads/excel-office-free/covers/excel-office-cover.png', 'course', FALSE, TRUE, 'ดูรายละเอียดหลักสูตร Excel', '/courses', 'published', '2026-06-30 10:00:00', NULL, 72, COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1)), COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1))),
('เปิดระบบตรวจสอบใบประกาศนียบัตรออนไลน์ด้วยเลขที่ใบประกาศ', 'online-certificate-verification-news', 'ผู้เรียนและหน่วยงานภายนอกสามารถตรวจสอบใบประกาศนียบัตรออนไลน์ได้สะดวกและรวดเร็ว', 'ระบบใบประกาศนียบัตรออนไลน์ของ SPC SkillCert Online รองรับการตรวจสอบข้อมูลผ่านหน้าเว็บไซต์ ผู้เรียนสามารถดาวน์โหลดใบประกาศของตนเอง และหน่วยงานภายนอกสามารถตรวจสอบเลขที่ใบประกาศเพื่อยืนยันความถูกต้องของเอกสารได้', '/uploads/ai-office-productivity-free/covers/ai-office-productivity-cover.png', 'certificate', FALSE, TRUE, 'ตรวจสอบใบประกาศ', '/verify-certificate', 'published', '2026-06-30 11:00:00', NULL, 58, COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1)), COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' LIMIT 1)))
ON DUPLICATE KEY UPDATE
  summary = VALUES(summary),
  content = VALUES(content),
  cover_image_url = VALUES(cover_image_url),
  category = VALUES(category),
  is_featured = VALUES(is_featured),
  show_on_home = VALUES(show_on_home),
  cta_label = VALUES(cta_label),
  cta_url = VALUES(cta_url),
  status = VALUES(status),
  published_at = VALUES(published_at),
  expires_at = VALUES(expires_at),
  updated_by = VALUES(updated_by);

INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by) VALUES
('site.name', 'ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('site.short_name', 'SPC SkillCert Online', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('site.phone', '02-000-0000', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('site.email', 'training@spc.ac.th', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.enabled', 'true', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.title', 'ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.subtitle', 'SPC SkillCert Online', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.description', 'เรียนออนไลน์ ได้มาตรฐาน พัฒนาทักษะวิชาชีพ พร้อมวัดผลและออกใบประกาศนียบัตรที่ตรวจสอบได้', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.image_url', '/images/spc-hero-vocational-training.png', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.primary_label', 'ดูหลักสูตรที่เปิดรับสมัคร', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.primary_url', '/courses', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.secondary_label', 'ตรวจสอบใบประกาศนียบัตร', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('home.hero.secondary_url', '/verify-certificate', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th')),
('certificate.number_format', 'SPC-CERT-ปี-เลขลำดับ', 'text', (SELECT id FROM users WHERE email = 'admin@spc.ac.th'))
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), value_type = VALUES(value_type), updated_by = VALUES(updated_by);

INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by) VALUES
('theme.mode', 'light', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE email = 'admin@spc.ac.th' LIMIT 1))),
('theme.preset', 'blue', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE email = 'admin@spc.ac.th' LIMIT 1)))
ON DUPLICATE KEY UPDATE
  value_type = VALUES(value_type),
  updated_by = COALESCE(site_settings.updated_by, VALUES(updated_by));

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail_json)
SELECT (SELECT id FROM users WHERE email = 'admin@spc.ac.th'), 'database.seeded', 'system', NULL, JSON_OBJECT('version', '2026-06-29', 'source', 'database/seed.sql')
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs WHERE action = 'database.seeded'
);
