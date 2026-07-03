SET NAMES utf8mb4;
SET time_zone = '+07:00';

USE spc_skillcert_online;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER status;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER sort_order;
ALTER TABLE categories ADD INDEX IF NOT EXISTS idx_categories_deleted_sort (deleted_at, sort_order);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER published_at;
ALTER TABLE courses ADD INDEX IF NOT EXISTS idx_courses_deleted_status (deleted_at, status);

ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS code VARCHAR(50) AFTER course_id;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS objectives LONGTEXT AFTER description;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS competency TEXT AFTER objectives;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS hours INT NOT NULL DEFAULT 0 AFTER competency;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS learning_mode ENUM('online', 'live_online', 'blended') NOT NULL DEFAULT 'online' AFTER hours;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS passing_score DECIMAL(5,2) NOT NULL DEFAULT 70 AFTER learning_mode;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS unlock_rule VARCHAR(120) NOT NULL DEFAULT 'manual' AFTER passing_score;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published') NOT NULL DEFAULT 'draft' AFTER unlock_rule;
ALTER TABLE course_sections MODIFY COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft';
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER status;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description TEXT AFTER title;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_type ENUM('video', 'document', 'practice') NOT NULL DEFAULT 'video' AFTER content;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER is_preview;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER status;

ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS resource_type ENUM('pdf', 'doc', 'link', 'worksheet', 'video', 'image', 'other') NOT NULL DEFAULT 'pdf' AFTER title;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) AFTER file_url;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS file_size VARCHAR(80) AFTER file_name;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published' AFTER file_size;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER status;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER deleted_at;
ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sort_order;

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS note TEXT AFTER approved_by;

ALTER TABLE payment_evidences ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255) AFTER file_url;
ALTER TABLE payment_evidences ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) AFTER original_file_name;

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_position_seconds INT NOT NULL DEFAULT 0 AFTER progress_percent;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER completed_at;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS description TEXT AFTER type;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS section_id BIGINT UNSIGNED NULL AFTER course_id;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS shared_question_source_id BIGINT UNSIGNED NULL AFTER lesson_id;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS question_limit INT NULL AFTER time_limit_minutes;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS counts_toward_completion BOOLEAN NOT NULL DEFAULT TRUE AFTER is_required;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS compare_group VARCHAR(80) NULL AFTER counts_toward_completion;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS randomize_questions BOOLEAN NOT NULL DEFAULT FALSE AFTER is_required;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS randomize_options BOOLEAN NOT NULL DEFAULT FALSE AFTER randomize_questions;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS show_answers ENUM('immediate', 'after_close', 'never') NOT NULL DEFAULT 'after_close' AFTER randomize_options;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER show_answers;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER status;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER is_required;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sort_order;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
ALTER TABLE assessments ADD INDEX IF NOT EXISTS idx_assessments_shared_source (shared_question_source_id);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT AFTER score;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active' AFTER explanation;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sort_order;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS graded_by BIGINT UNSIGNED NULL AFTER graded_at;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS feedback TEXT AFTER graded_by;

ALTER TABLE course_completion_rules ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER require_all_assignments;

ALTER TABLE instructors ADD UNIQUE INDEX IF NOT EXISTS uniq_instructor_user (user_id);
ALTER TABLE course_outcomes ADD UNIQUE INDEX IF NOT EXISTS uniq_course_outcome_order (course_id, sort_order);
ALTER TABLE course_requirements ADD UNIQUE INDEX IF NOT EXISTS uniq_course_requirement_order (course_id, sort_order);
ALTER TABLE course_audiences ADD UNIQUE INDEX IF NOT EXISTS uniq_course_audience_order (course_id, sort_order);
ALTER TABLE course_sections ADD UNIQUE INDEX IF NOT EXISTS uniq_course_section_order (course_id, sort_order);
ALTER TABLE lessons ADD UNIQUE INDEX IF NOT EXISTS uniq_section_lesson_order (section_id, sort_order);
ALTER TABLE lesson_resources ADD UNIQUE INDEX IF NOT EXISTS uniq_lesson_resource_order (lesson_id, sort_order);
ALTER TABLE assessments ADD UNIQUE INDEX IF NOT EXISTS uniq_course_assessment_order (course_id, type, sort_order);
ALTER TABLE questions ADD UNIQUE INDEX IF NOT EXISTS uniq_assessment_question_order (assessment_id, sort_order);
ALTER TABLE question_options ADD UNIQUE INDEX IF NOT EXISTS uniq_question_option_order (question_id, sort_order);
ALTER TABLE certificate_templates ADD UNIQUE INDEX IF NOT EXISTS uniq_certificate_template_name (name);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('student', 'instructor', 'staff', 'admin') NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uniq_role_permission (role, permission_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type ENUM('amount', 'percent') NOT NULL DEFAULT 'amount',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  starts_at DATETIME,
  ends_at DATETIME,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_promotion_name (name),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_promotions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  promotion_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_course_promotion_course (course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  submission_no VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  submitted_file_url VARCHAR(500),
  submitted_file_name VARCHAR(255),
  status ENUM('draft', 'submitted', 'pending_review', 'graded', 'needs_revision') NOT NULL DEFAULT 'submitted',
  score DECIMAL(6,2),
  feedback TEXT,
  submitted_at DATETIME,
  graded_at DATETIME,
  graded_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assignment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED,
  lesson_id BIGINT UNSIGNED,
  assessment_id BIGINT UNSIGNED,
  task_type ENUM('worksheet', 'practice') NOT NULL DEFAULT 'worksheet',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instruction_html LONGTEXT,
  instruction_file_url VARCHAR(500),
  instruction_file_name VARCHAR(255),
  resource_url VARCHAR(500),
  submission_mode ENUM('file', 'link', 'file_or_link', 'text') NOT NULL DEFAULT 'file_or_link',
  max_score DECIMAL(6,2) NOT NULL DEFAULT 100,
  passing_score DECIMAL(6,2) NOT NULL DEFAULT 70,
  weight_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  due_days_after_enrollment INT,
  allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE,
  require_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_required_count INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_learning_task_order (course_id, task_type, sort_order),
  INDEX idx_learning_tasks_course_type (course_id, task_type, status),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_task_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_type ENUM('pdf', 'doc', 'sheet', 'image', 'link', 'other') NOT NULL DEFAULT 'other',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_learning_task_attachment_order (task_id, sort_order),
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_task_rubrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  max_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_learning_task_rubric_order (task_id, sort_order),
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_task_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  submission_no VARCHAR(60) NOT NULL UNIQUE,
  answer_text LONGTEXT,
  submitted_file_url VARCHAR(500),
  submitted_file_name VARCHAR(255),
  submitted_link_url VARCHAR(500),
  note TEXT,
  status ENUM('draft', 'submitted', 'pending_review', 'graded', 'passed', 'not_passed', 'needs_revision') NOT NULL DEFAULT 'submitted',
  score DECIMAL(6,2),
  feedback TEXT,
  submitted_at DATETIME,
  graded_at DATETIME,
  graded_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_learning_task_submission (task_id, enrollment_id),
  INDEX idx_learning_task_submissions_status (status),
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_task_evidences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED,
  task_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  evidence_type ENUM('file', 'image', 'link', 'text') NOT NULL DEFAULT 'file',
  evidence_url VARCHAR(500),
  evidence_text TEXT,
  file_name VARCHAR(255),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_learning_task_evidence_task (task_id, enrollment_id),
  FOREIGN KEY (submission_id) REFERENCES learning_task_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_evaluation_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  criterion ENUM('lesson_progress', 'pre_test', 'post_test', 'worksheet', 'practice') NOT NULL,
  title VARCHAR(255) NOT NULL,
  weight_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  passing_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_course_evaluation_criterion (course_id, criterion),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_announcement_title (title),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT,
  value_type ENUM('text', 'number', 'boolean', 'json') NOT NULL DEFAULT 'text',
  updated_by BIGINT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
