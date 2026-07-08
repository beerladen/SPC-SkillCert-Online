USE spc_skillcert_online;

CREATE TABLE IF NOT EXISTS backup_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('database', 'files', 'full') NOT NULL,
  status ENUM('queued', 'running', 'success', 'failed') NOT NULL DEFAULT 'queued',
  storage ENUM('local', 'google_drive') NOT NULL DEFAULT 'local',
  file_path TEXT NULL,
  file_name VARCHAR(255) NULL,
  file_size BIGINT UNSIGNED NULL,
  checksum_sha256 CHAR(64) NULL,
  cloud_status ENUM('skipped', 'pending', 'uploading', 'success', 'failed') NOT NULL DEFAULT 'skipped',
  cloud_remote VARCHAR(120) NULL,
  cloud_path TEXT NULL,
  cloud_error TEXT NULL,
  uploaded_at DATETIME NULL,
  message TEXT NULL,
  error_message TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_backup_jobs_status (status, created_at),
  INDEX idx_backup_jobs_type (type, status, created_at),
  INDEX idx_backup_jobs_cloud_status (cloud_status, uploaded_at),
  INDEX idx_backup_jobs_created_by (created_by),
  CONSTRAINT fk_backup_jobs_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS backup_settings (
  setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
  setting_value TEXT NULL,
  value_type ENUM('text', 'boolean', 'number', 'json') NOT NULL DEFAULT 'text',
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_backup_settings_updated_by (updated_by),
  CONSTRAINT fk_backup_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'backup_jobs'
    AND COLUMN_NAME = 'cloud_status'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE backup_jobs ADD COLUMN cloud_status ENUM(''skipped'', ''pending'', ''uploading'', ''success'', ''failed'') NOT NULL DEFAULT ''skipped'' AFTER checksum_sha256',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'backup_jobs'
    AND COLUMN_NAME = 'cloud_remote'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE backup_jobs ADD COLUMN cloud_remote VARCHAR(120) NULL AFTER cloud_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'backup_jobs'
    AND COLUMN_NAME = 'cloud_path'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE backup_jobs ADD COLUMN cloud_path TEXT NULL AFTER cloud_remote',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'backup_jobs'
    AND COLUMN_NAME = 'cloud_error'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE backup_jobs ADD COLUMN cloud_error TEXT NULL AFTER cloud_path',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'backup_jobs'
    AND COLUMN_NAME = 'uploaded_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE backup_jobs ADD COLUMN uploaded_at DATETIME NULL AFTER cloud_error',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
