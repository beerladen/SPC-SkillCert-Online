USE spc_skillcert_online;

CREATE TABLE IF NOT EXISTS admin_navigation_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  title VARCHAR(120),
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_admin_nav_section_code (code),
  INDEX idx_admin_nav_sections_status (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_navigation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id BIGINT UNSIGNED,
  title VARCHAR(120) NOT NULL,
  href VARCHAR(255) NOT NULL,
  icon_key VARCHAR(80) NOT NULL DEFAULT 'Circle',
  badge_key VARCHAR(80),
  allowed_roles VARCHAR(120) NOT NULL DEFAULT 'admin,staff,instructor',
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_admin_nav_item_href (href),
  INDEX idx_admin_nav_items_status (status, sort_order),
  INDEX idx_admin_nav_items_section (section_id, sort_order),
  CONSTRAINT fk_admin_nav_items_section_migration
    FOREIGN KEY (section_id) REFERENCES admin_navigation_sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_navigation_sections (code, title, sort_order, status, is_system) VALUES
('dashboard', NULL, 1, 'active', 1),
('courses', 'หลักสูตร', 2, 'active', 1),
('registrations', 'ลงทะเบียน', 3, 'active', 1),
('system', 'ระบบ', 4, 'active', 1),
('bottom', 'เมนูล่าง', 99, 'active', 1);

INSERT IGNORE INTO admin_navigation_items
  (section_id, title, href, icon_key, badge_key, allowed_roles, sort_order, status, is_system)
SELECT s.id, seed.title, seed.href, seed.icon_key, seed.badge_key, seed.allowed_roles, seed.sort_order, 'active', 1
FROM admin_navigation_sections s
JOIN (
  SELECT 'dashboard' AS section_code, 'Dashboard' AS title, '/admin/dashboard' AS href, 'Home' AS icon_key, NULL AS badge_key, 'admin,staff,instructor' AS allowed_roles, 1 AS sort_order
  UNION ALL SELECT 'courses', 'จัดการหลักสูตร', '/admin/courses', 'BookOpen', NULL, 'admin,staff,instructor', 1
  UNION ALL SELECT 'courses', 'จัดการการเรียนรู้', '/admin/learning', 'ClipboardList', NULL, 'admin,staff,instructor', 2
  UNION ALL SELECT 'courses', 'ผู้เข้าอบรม', '/admin/enrollments', 'GraduationCap', NULL, 'admin,staff,instructor', 3
  UNION ALL SELECT 'courses', 'วัดผล/ข้อสอบ', '/admin/assessments', 'FileQuestion', NULL, 'admin,staff,instructor', 4
  UNION ALL SELECT 'registrations', 'รายการลงทะเบียน', '/admin/registrations', 'ClipboardCheck', 'pendingRegistrations', 'admin,staff', 1
  UNION ALL SELECT 'registrations', 'ตรวจหลักฐานชำระเงิน', '/admin/payments', 'CreditCard', 'pendingPayments', 'admin,staff', 2
  UNION ALL SELECT 'registrations', 'ใบประกาศนียบัตร', '/admin/certificates', 'Award', NULL, 'admin,staff', 3
  UNION ALL SELECT 'system', 'รายงาน', '/admin/reports', 'BarChart3', NULL, 'admin,staff', 1
  UNION ALL SELECT 'system', 'ผู้ใช้งาน', '/admin/users', 'Users', NULL, 'admin', 2
  UNION ALL SELECT 'system', 'จัดการเมนู', '/admin/navigation', 'Navigation', NULL, 'admin', 3
  UNION ALL SELECT 'system', 'ตั้งค่าเว็บไซต์', '/admin/settings', 'Settings', NULL, 'admin', 4
  UNION ALL SELECT 'bottom', 'ข้อความติดต่อ', '/feedback', 'MessageCircle', NULL, 'admin,staff,instructor', 1
  UNION ALL SELECT 'bottom', 'คู่มือระบบ', '/help', 'HelpCircle', NULL, 'admin,staff,instructor', 2
) seed ON seed.section_code = s.code;
