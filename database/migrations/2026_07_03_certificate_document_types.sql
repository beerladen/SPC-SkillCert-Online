USE spc_skillcert_online;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_completion_rules'
    AND COLUMN_NAME = 'certificate_document_type'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE course_completion_rules ADD COLUMN certificate_document_type ENUM(''certificate'', ''honor_certificate'') NOT NULL DEFAULT ''honor_certificate'' AFTER certificate_enabled',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificates'
    AND COLUMN_NAME = 'document_type'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE certificates ADD COLUMN document_type ENUM(''certificate'', ''honor_certificate'') NOT NULL DEFAULT ''honor_certificate'' AFTER template_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificates'
    AND INDEX_NAME = 'idx_certificates_document_type'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE certificates ADD INDEX idx_certificates_document_type (document_type)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
