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
  CONSTRAINT fk_course_instructors_course
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_course_instructors_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO course_instructors (course_id, instructor_id, role, can_edit, can_grade, sort_order)
SELECT c.id, c.instructor_id, 'primary', 1, 1, 0
FROM courses c
WHERE c.instructor_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  role = IF(role = 'co_instructor', role, VALUES(role)),
  can_edit = 1,
  can_grade = 1;

UPDATE admin_navigation_items
SET allowed_roles = 'admin,staff,instructor'
WHERE href IN (
  '/admin/dashboard',
  '/admin/courses',
  '/admin/learning',
  '/admin/enrollments',
  '/admin/assessments',
  '/admin/reports'
);

UPDATE admin_navigation_items
SET allowed_roles = 'admin,staff'
WHERE href IN (
  '/admin/registrations',
  '/admin/payments',
  '/admin/certificates',
  '/admin/users',
  '/admin/announcements'
);

UPDATE admin_navigation_items
SET allowed_roles = 'admin'
WHERE href IN ('/admin/navigation', '/admin/settings');
