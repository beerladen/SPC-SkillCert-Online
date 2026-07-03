USE spc_skillcert_online;

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER last_login_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by BIGINT UNSIGNED NULL AFTER deleted_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS delete_reason TEXT NULL AFTER deleted_by;
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_deleted_role_status (deleted_at, role, status);
