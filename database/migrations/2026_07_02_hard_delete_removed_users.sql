USE spc_skillcert_online;

DROP TEMPORARY TABLE IF EXISTS tmp_hard_delete_removed_users;

CREATE TEMPORARY TABLE tmp_hard_delete_removed_users (
  id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=MEMORY;

INSERT IGNORE INTO tmp_hard_delete_removed_users (id)
SELECT u.id
FROM users u
WHERE u.deleted_at IS NOT NULL
  AND u.role <> 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM instructors i
    JOIN courses c ON c.instructor_id = i.id
    WHERE i.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM instructors i
    JOIN course_instructors ci ON ci.instructor_id = i.id
    WHERE i.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM enrollments e
    JOIN certificates cert ON cert.enrollment_id = e.id
    WHERE e.user_id = u.id
  );

DELETE FROM registrations
WHERE user_id IN (SELECT id FROM tmp_hard_delete_removed_users);

DELETE FROM enrollments
WHERE user_id IN (SELECT id FROM tmp_hard_delete_removed_users);

DELETE FROM user_sessions
WHERE user_id IN (SELECT id FROM tmp_hard_delete_removed_users);

DELETE FROM password_reset_tokens
WHERE user_id IN (SELECT id FROM tmp_hard_delete_removed_users);

UPDATE instructors
SET status = 'inactive'
WHERE user_id IN (SELECT id FROM tmp_hard_delete_removed_users);

DELETE FROM users
WHERE id IN (SELECT id FROM tmp_hard_delete_removed_users);

DROP TEMPORARY TABLE IF EXISTS tmp_hard_delete_removed_users;
