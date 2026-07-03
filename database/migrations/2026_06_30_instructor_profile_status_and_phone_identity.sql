USE spc_skillcert_online;

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER signature_url;
ALTER TABLE instructors ADD INDEX IF NOT EXISTS idx_instructors_status_user (status, user_id);

ALTER TABLE profiles ADD INDEX IF NOT EXISTS idx_profiles_phone (phone);

UPDATE profiles p
JOIN users u ON u.id = p.user_id
SET p.phone = NULL
WHERE p.phone IN ('02-000-0000', '089-000-0000')
  AND u.email IN (
    'saengpet21@gmail.com',
    'admin@spc.ac.th',
    'staff@spc.ac.th',
    'learner@spc.ac.th',
    'somchai@example.com',
    'natthaporn@example.com',
    'kamonchanok@example.com'
  );

INSERT INTO instructors (user_id, display_name, position, bio, status)
SELECT id, name, 'ผู้สอนและผู้ดูแลระบบ', 'บัญชีแอดมินหลักที่สามารถเป็นผู้สอนประจำหลักสูตรได้', 'active'
FROM users
WHERE email = 'saengpet21@gmail.com'
  AND deleted_at IS NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  position = VALUES(position),
  bio = VALUES(bio),
  status = 'active';
