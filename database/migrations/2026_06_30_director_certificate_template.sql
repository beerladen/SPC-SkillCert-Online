USE spc_skillcert_online;

ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS issuer_name VARCHAR(255) AFTER signature_url;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255) AFTER issuer_name;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS signer_position VARCHAR(255) AFTER signer_name;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS layout_config_json JSON AFTER signer_position;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'active' AFTER layout_config_json;
ALTER TABLE certificate_templates ADD INDEX IF NOT EXISTS idx_certificate_templates_status_default (status, is_default);

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
  issuer_name = VALUES(issuer_name),
  signer_name = VALUES(signer_name),
  signer_position = VALUES(signer_position),
  layout_config_json = VALUES(layout_config_json),
  status = 'active',
  is_default = TRUE;

UPDATE certificates
SET template_id = (
  SELECT id
  FROM certificate_templates
  WHERE name = 'เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย'
  LIMIT 1
)
WHERE status = 'issued';
