SET NAMES utf8mb4;

INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by) VALUES
('home.hero.enabled', 'true', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.title', 'ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.subtitle', 'SPC SkillCert Online', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.description', 'เรียนออนไลน์ ได้มาตรฐาน พัฒนาทักษะวิชาชีพ พร้อมวัดผลและออกใบประกาศนียบัตรที่ตรวจสอบได้', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.image_url', '/images/spc-hero-vocational-training.png', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.primary_label', 'ดูหลักสูตรที่เปิดรับสมัคร', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.primary_url', '/courses', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.secondary_label', 'ตรวจสอบใบประกาศนียบัตร', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('home.hero.secondary_url', '/verify-certificate', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)))
ON DUPLICATE KEY UPDATE
  value_type = VALUES(value_type),
  updated_by = COALESCE(site_settings.updated_by, VALUES(updated_by));
