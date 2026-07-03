ALTER TABLE certificate_approval_steps
  ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255) NULL AFTER acted_name,
  ADD COLUMN IF NOT EXISTS signer_position VARCHAR(255) NULL AFTER signer_name,
  ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500) NULL AFTER signer_position;
