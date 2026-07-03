USE spc_skillcert_online;

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NULL AFTER title;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS content LONGTEXT NULL AFTER summary;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500) NULL AFTER content;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category VARCHAR(120) NOT NULL DEFAULT 'general' AFTER cover_image_url;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE AFTER category;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS show_on_home BOOLEAN NOT NULL DEFAULT TRUE AFTER is_featured;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS cta_label VARCHAR(120) NULL AFTER show_on_home;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS cta_url VARCHAR(500) NULL AFTER cta_label;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS course_id BIGINT UNSIGNED NULL AFTER cta_url;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL AFTER published_at;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0 AFTER expires_at;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL AFTER created_by;
ALTER TABLE announcements ADD INDEX IF NOT EXISTS idx_announcements_home_status (show_on_home, status, is_featured, published_at);
ALTER TABLE announcements ADD INDEX IF NOT EXISTS idx_announcements_category_status (category, status, published_at);
ALTER TABLE announcements ADD INDEX IF NOT EXISTS idx_announcements_course (course_id);

UPDATE announcements
SET slug = CONCAT('news-', id)
WHERE slug IS NULL OR slug = '';

ALTER TABLE announcements ADD UNIQUE KEY IF NOT EXISTS uniq_announcements_slug (slug);

INSERT INTO announcements
  (title, slug, summary, content, cover_image_url, category, is_featured, show_on_home,
   cta_label, cta_url, status, published_at, expires_at, view_count, created_by, updated_by)
VALUES
  (
    'เปิดรับสมัครหลักสูตรออนไลน์รุ่นใหม่ ประจำเดือนกรกฎาคม',
    'july-online-course-registration',
    'ศูนย์อบรมเปิดรับสมัครหลักสูตรวิชาชีพระยะสั้นออนไลน์หลายหลักสูตร พร้อมระบบเรียนผ่านคลิป ใบงาน แบบทดสอบ และใบประกาศออนไลน์',
    'ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ SPC SkillCert Online เปิดรับสมัครผู้สนใจเข้าอบรมหลักสูตรออนไลน์รุ่นใหม่ ประจำเดือนกรกฎาคม ผู้เรียนสามารถลงทะเบียนผ่านระบบ เรียนผ่านคลิปวิดีโอ ดาวน์โหลดใบความรู้ ทำแบบทดสอบ ส่งใบงานและแบบฝึกผ่านระบบ พร้อมรับใบประกาศนียบัตรออนไลน์เมื่อผ่านเกณฑ์ที่กำหนด',
    '/images/spc-hero-vocational-training.png',
    'registration',
    TRUE,
    TRUE,
    'ดูหลักสูตรที่เปิดรับสมัคร',
    '/courses',
    'published',
    '2026-06-30 08:00:00',
    NULL,
    124,
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)),
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))
  ),
  (
    'แนะนำหลักสูตร Microsoft Word ในสำนักงาน พร้อมใบงานปฏิบัติ 30 ชุด',
    'microsoft-word-office-worksheets-news',
    'หลักสูตร Word สำหรับงานสำนักงาน เน้นเรียนจริง ปฏิบัติจริง มีใบงานและแบบฝึกให้ส่งผ่านระบบ',
    'หลักสูตร Microsoft Word ในสำนักงานออกแบบสำหรับผู้ที่ต้องการพัฒนาทักษะงานเอกสารอย่างเป็นระบบ ผู้เรียนจะได้เรียนผ่านวิดีโอ ทำใบงานปฏิบัติ ตรวจความก้าวหน้า และส่งหลักฐานการทำงานผ่านระบบ เพื่อให้ครูผู้สอนประเมินผลได้ครบถ้วน',
    '/uploads/course-covers/1782740091251-9005710b-867f-427f-a273-38c19ee23bd5.png',
    'course',
    FALSE,
    TRUE,
    'ลงทะเบียนหลักสูตร Word',
    '/courses',
    'published',
    '2026-06-30 09:00:00',
    NULL,
    86,
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)),
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))
  ),
  (
    'หลักสูตร Excel ในสำนักงาน เปิดเรียนฟรีพร้อมแบบทดสอบก่อนเรียนและหลังเรียน',
    'excel-office-free-course-news',
    'ฝึกใช้ Excel สำหรับงานสำนักงาน พร้อมแบบทดสอบ ใบงาน และระบบติดตามผลการเรียน',
    'ผู้สนใจสามารถเข้าเรียนหลักสูตร Microsoft Excel ในสำนักงานได้ฟรี ระบบรองรับการเรียนผ่านบทเรียนออนไลน์ แบบทดสอบก่อนเรียนและหลังเรียน รวมถึงใบงานปฏิบัติ เพื่อให้ผู้เรียนเห็นพัฒนาการของตนเองและนำทักษะไปใช้ในงานสำนักงานได้จริง',
    '/uploads/excel-office-free/covers/excel-office-cover.png',
    'course',
    FALSE,
    TRUE,
    'ดูรายละเอียดหลักสูตร Excel',
    '/courses',
    'published',
    '2026-06-30 10:00:00',
    NULL,
    72,
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)),
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))
  ),
  (
    'เปิดระบบตรวจสอบใบประกาศนียบัตรออนไลน์ด้วยเลขที่ใบประกาศ',
    'online-certificate-verification-news',
    'ผู้เรียนและหน่วยงานภายนอกสามารถตรวจสอบใบประกาศนียบัตรออนไลน์ได้สะดวกและรวดเร็ว',
    'ระบบใบประกาศนียบัตรออนไลน์ของ SPC SkillCert Online รองรับการตรวจสอบข้อมูลผ่านหน้าเว็บไซต์ ผู้เรียนสามารถดาวน์โหลดใบประกาศของตนเอง และหน่วยงานภายนอกสามารถตรวจสอบเลขที่ใบประกาศเพื่อยืนยันความถูกต้องของเอกสารได้',
    '/uploads/ai-office-productivity-free/covers/ai-office-productivity-cover.png',
    'certificate',
    FALSE,
    TRUE,
    'ตรวจสอบใบประกาศ',
    '/verify-certificate',
    'published',
    '2026-06-30 11:00:00',
    NULL,
    58,
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)),
    COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))
  )
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

INSERT IGNORE INTO admin_navigation_items
  (section_id, title, href, icon_key, badge_key, allowed_roles, sort_order, status, is_system)
SELECT s.id, 'ข่าวประชาสัมพันธ์', '/admin/announcements', 'Newspaper', NULL, 'admin,staff', 5, 'active', 1
FROM admin_navigation_sections s
WHERE s.code = 'system';
