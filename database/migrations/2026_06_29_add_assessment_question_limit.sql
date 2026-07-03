ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS question_limit INT NULL AFTER time_limit_minutes;
