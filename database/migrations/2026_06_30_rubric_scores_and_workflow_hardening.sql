CREATE TABLE IF NOT EXISTS learning_task_rubric_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  rubric_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(6,2) NOT NULL DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rubric_score_submission (submission_id, rubric_id),
  FOREIGN KEY (submission_id) REFERENCES learning_task_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (rubric_id) REFERENCES learning_task_rubrics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
