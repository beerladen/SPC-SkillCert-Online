USE spc_skillcert_online;

CREATE TABLE IF NOT EXISTS certificate_approval_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_no VARCHAR(80) NOT NULL UNIQUE,
  course_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('certificate', 'honor_certificate') NOT NULL DEFAULT 'certificate',
  course_title VARCHAR(255) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  owner_name VARCHAR(255),
  criteria_summary TEXT,
  total_learners INT NOT NULL DEFAULT 0,
  status ENUM(
    'pending_academic',
    'academic_returned',
    'pending_registrar',
    'registrar_returned',
    'pending_director',
    'director_returned',
    'approved',
    'issued',
    'cancelled'
  ) NOT NULL DEFAULT 'pending_academic',
  verification_token VARCHAR(120) NOT NULL UNIQUE,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cert_reports_course_status (course_id, status),
  INDEX idx_cert_reports_status_created (status, created_at),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_approval_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  learner_name VARCHAR(255) NOT NULL,
  learner_email VARCHAR(255),
  registration_no VARCHAR(80),
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  completed_lessons INT NOT NULL DEFAULT 0,
  total_lessons INT NOT NULL DEFAULT 0,
  post_test_score DECIMAL(6,2),
  passed_tasks INT NOT NULL DEFAULT 0,
  total_tasks INT NOT NULL DEFAULT 0,
  evaluation_status VARCHAR(80) NOT NULL DEFAULT 'passed',
  certificate_id BIGINT UNSIGNED,
  certificate_no VARCHAR(80),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cert_report_enrollment (report_id, enrollment_id),
  INDEX idx_cert_report_items_report (report_id, sort_order),
  INDEX idx_cert_report_items_enrollment (enrollment_id),
  FOREIGN KEY (report_id) REFERENCES certificate_approval_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_approval_steps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  step_key ENUM('academic', 'registrar', 'director') NOT NULL,
  role_label VARCHAR(160) NOT NULL,
  status ENUM('waiting', 'pending', 'approved', 'returned') NOT NULL DEFAULT 'waiting',
  token VARCHAR(120) NOT NULL UNIQUE,
  acted_by BIGINT UNSIGNED,
  acted_name VARCHAR(255),
  acted_at DATETIME,
  note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cert_report_step (report_id, step_key),
  INDEX idx_cert_report_steps_report_sort (report_id, sort_order),
  INDEX idx_cert_report_steps_token_status (token, status),
  FOREIGN KEY (report_id) REFERENCES certificate_approval_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (acted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
