SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE DATABASE IF NOT EXISTS spc_skillcert_online
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE spc_skillcert_online;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'instructor', 'staff', 'admin') NOT NULL DEFAULT 'student',
  status ENUM('active', 'disabled', 'pending') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  deleted_at DATETIME NULL,
  deleted_by BIGINT UNSIGNED NULL,
  delete_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, status),
  INDEX idx_users_deleted_role_status (deleted_at, role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  user_agent VARCHAR(500),
  ip_address VARCHAR(80),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sessions_user (user_id),
  INDEX idx_user_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_password_reset_user (user_id, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS admin_navigation_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  title VARCHAR(120),
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_admin_nav_section_code (code),
  INDEX idx_admin_nav_sections_status (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_navigation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id BIGINT UNSIGNED,
  title VARCHAR(120) NOT NULL,
  href VARCHAR(255) NOT NULL,
  icon_key VARCHAR(80) NOT NULL DEFAULT 'Circle',
  badge_key VARCHAR(80),
  allowed_roles VARCHAR(120) NOT NULL DEFAULT 'admin,staff,instructor',
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_admin_nav_item_href (href),
  INDEX idx_admin_nav_items_status (status, sort_order),
  INDEX idx_admin_nav_items_section (section_id, sort_order),
  FOREIGN KEY (section_id) REFERENCES admin_navigation_sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  citizen_id VARCHAR(20),
  phone VARCHAR(30),
  address TEXT,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_profiles_phone (phone),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instructors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  display_name VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  bio TEXT,
  signature_url VARCHAR(500),
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_instructor_user (user_id),
  INDEX idx_instructors_status_user (status, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  icon VARCHAR(50),
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categories_deleted_sort (deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  instructor_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  short_description TEXT,
  description LONGTEXT,
  cover_image_url VARCHAR(500),
  registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  original_fee DECIMAL(10,2),
  duration_minutes INT NOT NULL DEFAULT 0,
  capacity INT,
  format ENUM('online', 'live_online', 'recorded') NOT NULL DEFAULT 'online',
  level ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  status ENUM('draft', 'open', 'nearly_full', 'closed', 'archived') NOT NULL DEFAULT 'draft',
  starts_at DATETIME,
  ends_at DATETIME,
  published_at DATETIME,
  deleted_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_courses_status (status),
  INDEX idx_courses_deleted_status (deleted_at, status),
  INDEX idx_courses_instructor_status_deleted (instructor_id, status, deleted_at),
  INDEX idx_courses_category (category_id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (instructor_id) REFERENCES instructors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_instructors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  instructor_id BIGINT UNSIGNED NOT NULL,
  role ENUM('primary', 'co_instructor') NOT NULL DEFAULT 'co_instructor',
  can_edit TINYINT(1) NOT NULL DEFAULT 1,
  can_grade TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_course_instructor (course_id, instructor_id),
  INDEX idx_course_instructors_course_role (course_id, role, sort_order),
  INDEX idx_course_instructors_instructor (instructor_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_outcomes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  outcome TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_course_outcome_order (course_id, sort_order),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_requirements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  requirement TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_course_requirement_order (course_id, sort_order),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_audiences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  audience TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_course_audience_order (course_id, sort_order),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  objectives LONGTEXT,
  competency TEXT,
  hours INT NOT NULL DEFAULT 0,
  learning_mode ENUM('online', 'live_online', 'blended') NOT NULL DEFAULT 'online',
  passing_score DECIMAL(5,2) NOT NULL DEFAULT 70,
  unlock_rule VARCHAR(120) NOT NULL DEFAULT 'manual',
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  deleted_at DATETIME,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_course_section_order (course_id, sort_order),
  INDEX idx_course_sections_course_status_deleted_sort (course_id, status, deleted_at, sort_order),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content LONGTEXT,
  lesson_type ENUM('video', 'document', 'practice') NOT NULL DEFAULT 'video',
  video_url VARCHAR(500),
  duration_minutes INT NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  deleted_at DATETIME,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_section_lesson_order (section_id, sort_order),
  INDEX idx_lessons_section_status_deleted_sort (section_id, status, deleted_at, sort_order),
  FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_resources (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  resource_type ENUM('pdf', 'doc', 'link', 'worksheet', 'video', 'image', 'other') NOT NULL DEFAULT 'pdf',
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size VARCHAR(80),
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
  deleted_at DATETIME,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lesson_resource_order (lesson_id, sort_order),
  INDEX idx_lesson_resources_lesson_status_deleted_sort (lesson_id, status, deleted_at, sort_order),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_no VARCHAR(50) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('draft', 'pending_payment', 'pending_review', 'approved', 'rejected', 'cancelled', 'completed') NOT NULL DEFAULT 'draft',
  submitted_at DATETIME,
  approved_at DATETIME,
  approved_by BIGINT UNSIGNED,
  note TEXT,
  deleted_at DATETIME,
  deleted_by BIGINT UNSIGNED,
  delete_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_registrations_status (status),
  INDEX idx_registrations_user (user_id),
  INDEX idx_registrations_deleted_status (deleted_at, status),
  INDEX idx_registrations_user_status_deleted_submitted (user_id, status, deleted_at, submitted_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registration_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  registration_fee DECIMAL(10,2) NOT NULL,
  original_fee DECIMAL(10,2),
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  promotion_id BIGINT UNSIGNED,
  promotion_name VARCHAR(255),
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL,
  UNIQUE KEY uniq_registration_course (registration_id, course_id),
  INDEX idx_registration_items_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registration_status_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(60) NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS registration_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('bank_transfer', 'promptpay', 'cash', 'waived') NOT NULL DEFAULT 'bank_transfer',
  status ENUM('pending', 'pending_review', 'approved', 'rejected', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME,
  reviewed_at DATETIME,
  reviewed_by BIGINT UNSIGNED,
  note TEXT,
  deleted_at DATETIME,
  deleted_by BIGINT UNSIGNED,
  delete_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_status (status),
  INDEX idx_payments_deleted_status (deleted_at, status),
  INDEX idx_payments_registration_status_deleted (registration_id, status, deleted_at),
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_evidences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(255),
  mime_type VARCHAR(120),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES registration_payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  registration_item_id BIGINT UNSIGNED,
  status ENUM('active', 'completed', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (registration_item_id) REFERENCES registration_items(id) ON DELETE SET NULL,
  UNIQUE KEY uniq_user_course (user_id, course_id),
  INDEX idx_enrollments_status (status),
  INDEX idx_enrollments_user_course_status (user_id, course_id, status),
  INDEX idx_enrollments_course_status_progress (course_id, status, progress_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_position_seconds INT NOT NULL DEFAULT 0,
  completed_at DATETIME,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_progress_lesson (enrollment_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  section_id BIGINT UNSIGNED,
  lesson_id BIGINT UNSIGNED,
  shared_question_source_id BIGINT UNSIGNED,
  title VARCHAR(255) NOT NULL,
  type ENUM('pre_test', 'quiz', 'post_test', 'assignment', 'final_project') NOT NULL,
  description TEXT,
  passing_score DECIMAL(5,2) NOT NULL DEFAULT 70,
  max_attempts INT,
  time_limit_minutes INT,
  question_limit INT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  counts_toward_completion BOOLEAN NOT NULL DEFAULT TRUE,
  compare_group VARCHAR(80),
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
  show_answers ENUM('immediate', 'after_close', 'never') NOT NULL DEFAULT 'after_close',
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  deleted_at DATETIME,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_course_assessment_order (course_id, type, sort_order),
  INDEX idx_assessments_shared_source (shared_question_source_id),
  INDEX idx_assessments_course_type_status_deleted (course_id, type, status, deleted_at),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (shared_question_source_id) REFERENCES assessments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay', 'file_upload') NOT NULL,
  score DECIMAL(6,2) NOT NULL DEFAULT 1,
  explanation TEXT,
  status ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_assessment_question_order (assessment_id, sort_order),
  INDEX idx_questions_assessment_status_sort (assessment_id, status, sort_order),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_question_option_order (question_id, sort_order),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  attempt_no INT NOT NULL DEFAULT 1,
  score DECIMAL(6,2),
  max_score DECIMAL(6,2),
  status ENUM('in_progress', 'submitted', 'graded', 'passed', 'failed') NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  graded_at DATETIME,
  graded_by BIGINT UNSIGNED,
  feedback TEXT,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_attempts_status (status),
  INDEX idx_attempts_enrollment_assessment_status (enrollment_id, assessment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text TEXT,
  selected_option_id BIGINT UNSIGNED,
  file_url VARCHAR(500),
  score DECIMAL(6,2),
  feedback TEXT,
  FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL
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
  INDEX idx_learning_tasks_course_status_deleted_sort (course_id, status, deleted_at, task_type, sort_order),
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
  INDEX idx_learning_task_submissions_enrollment_status (enrollment_id, status),
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

CREATE TABLE IF NOT EXISTS course_completion_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL UNIQUE,
  required_progress_percent DECIMAL(5,2) NOT NULL DEFAULT 80,
  required_post_test_score DECIMAL(5,2) NOT NULL DEFAULT 70,
  require_all_assignments BOOLEAN NOT NULL DEFAULT TRUE,
  certificate_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  certificate_document_type ENUM('certificate', 'honor_certificate') NOT NULL DEFAULT 'honor_certificate',
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  background_url VARCHAR(500),
  signature_url VARCHAR(500),
  issuer_name VARCHAR(255),
  signer_name VARCHAR(255),
  signer_position VARCHAR(255),
  layout_config_json JSON,
  status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_certificate_template_name (name),
  INDEX idx_certificate_templates_status_default (status, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  certificate_no VARCHAR(80) NOT NULL UNIQUE,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED,
  document_type ENUM('certificate', 'honor_certificate') NOT NULL DEFAULT 'honor_certificate',
  learner_name VARCHAR(255) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  issued_at DATETIME NOT NULL,
  status ENUM('issued', 'revoked', 'reissued', 'expired') NOT NULL DEFAULT 'issued',
  pdf_url VARCHAR(500),
  qr_payload VARCHAR(500),
  revoked_at DATETIME,
  revoked_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_certificates_document_type (document_type),
  INDEX idx_certificates_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_verification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  certificate_id BIGINT UNSIGNED,
  certificate_no VARCHAR(80) NOT NULL,
  ip_address VARCHAR(80),
  user_agent VARCHAR(500),
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL,
  INDEX idx_verify_certificate_no (certificate_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  signer_name VARCHAR(255),
  signer_position VARCHAR(255),
  signature_url VARCHAR(500),
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

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  summary TEXT,
  content LONGTEXT,
  cover_image_url VARCHAR(500),
  category VARCHAR(120) NOT NULL DEFAULT 'general',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  show_on_home BOOLEAN NOT NULL DEFAULT TRUE,
  cta_label VARCHAR(120),
  cta_url VARCHAR(500),
  course_id BIGINT UNSIGNED,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME,
  expires_at DATETIME,
  view_count INT NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED,
  updated_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_announcement_title (title),
  UNIQUE KEY uniq_announcements_slug (slug),
  INDEX idx_announcements_home_status (show_on_home, status, is_featured, published_at),
  INDEX idx_announcements_category_status (category, status, published_at),
  INDEX idx_announcements_course (course_id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_exports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED,
  report_type VARCHAR(100) NOT NULL,
  filters_json JSON,
  file_url VARCHAR(500),
  status ENUM('queued', 'completed', 'failed') NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_report_type (report_type)
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id BIGINT UNSIGNED,
  detail_json JSON,
  ip_address VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
