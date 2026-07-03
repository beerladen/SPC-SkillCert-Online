USE spc_skillcert_online;

ALTER TABLE courses
  ADD INDEX IF NOT EXISTS idx_courses_instructor_status_deleted (instructor_id, status, deleted_at);

ALTER TABLE course_sections
  ADD INDEX IF NOT EXISTS idx_course_sections_course_status_deleted_sort (course_id, status, deleted_at, sort_order);

ALTER TABLE lessons
  ADD INDEX IF NOT EXISTS idx_lessons_section_status_deleted_sort (section_id, status, deleted_at, sort_order);

ALTER TABLE lesson_resources
  ADD INDEX IF NOT EXISTS idx_lesson_resources_lesson_status_deleted_sort (lesson_id, status, deleted_at, sort_order);

ALTER TABLE registrations
  ADD INDEX IF NOT EXISTS idx_registrations_user_status_deleted_submitted (user_id, status, deleted_at, submitted_at);

ALTER TABLE registration_items
  ADD INDEX IF NOT EXISTS idx_registration_items_course (course_id);

ALTER TABLE registration_payments
  ADD INDEX IF NOT EXISTS idx_payments_registration_status_deleted (registration_id, status, deleted_at);

ALTER TABLE enrollments
  ADD INDEX IF NOT EXISTS idx_enrollments_user_course_status (user_id, course_id, status);

ALTER TABLE enrollments
  ADD INDEX IF NOT EXISTS idx_enrollments_course_status_progress (course_id, status, progress_percent);

ALTER TABLE assessments
  ADD INDEX IF NOT EXISTS idx_assessments_course_type_status_deleted (course_id, type, status, deleted_at);

ALTER TABLE questions
  ADD INDEX IF NOT EXISTS idx_questions_assessment_status_sort (assessment_id, status, sort_order);

ALTER TABLE assessment_attempts
  ADD INDEX IF NOT EXISTS idx_attempts_enrollment_assessment_status (enrollment_id, assessment_id, status);

ALTER TABLE learning_tasks
  ADD INDEX IF NOT EXISTS idx_learning_tasks_course_status_deleted_sort (course_id, status, deleted_at, task_type, sort_order);

ALTER TABLE learning_task_submissions
  ADD INDEX IF NOT EXISTS idx_learning_task_submissions_enrollment_status (enrollment_id, status);
