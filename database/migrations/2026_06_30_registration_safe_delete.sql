USE spc_skillcert_online;

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER note;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS deleted_by BIGINT UNSIGNED NULL AFTER deleted_at;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS delete_reason TEXT NULL AFTER deleted_by;
ALTER TABLE registrations ADD INDEX IF NOT EXISTS idx_registrations_deleted_status (deleted_at, status);

ALTER TABLE registration_payments ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER note;
ALTER TABLE registration_payments ADD COLUMN IF NOT EXISTS deleted_by BIGINT UNSIGNED NULL AFTER deleted_at;
ALTER TABLE registration_payments ADD COLUMN IF NOT EXISTS delete_reason TEXT NULL AFTER deleted_by;
ALTER TABLE registration_payments ADD INDEX IF NOT EXISTS idx_payments_deleted_status (deleted_at, status);
