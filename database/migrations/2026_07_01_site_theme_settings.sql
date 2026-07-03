USE spc_skillcert_online;

INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by) VALUES
('theme.mode', 'light', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1))),
('theme.preset', 'blue', 'text', COALESCE((SELECT id FROM users WHERE email = 'saengpet21@gmail.com' LIMIT 1), (SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1)))
ON DUPLICATE KEY UPDATE
  value_type = VALUES(value_type),
  updated_by = COALESCE(site_settings.updated_by, VALUES(updated_by));
