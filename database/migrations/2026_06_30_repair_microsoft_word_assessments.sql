USE spc_skillcert_online;

UPDATE assessments a
JOIN courses c ON c.id = a.course_id
LEFT JOIN course_sections s
  ON s.id = a.section_id
 AND s.course_id = a.course_id
 AND s.status <> 'archived'
 AND s.deleted_at IS NULL
SET a.section_id = NULL
WHERE c.slug = 'microsoft-word'
  AND a.section_id IS NOT NULL
  AND a.deleted_at IS NULL
  AND s.id IS NULL;

UPDATE assessments a
JOIN courses c ON c.id = a.course_id
LEFT JOIN lessons l
  ON l.id = a.lesson_id
 AND l.status <> 'archived'
 AND l.deleted_at IS NULL
SET a.lesson_id = NULL
WHERE c.slug = 'microsoft-word'
  AND a.lesson_id IS NOT NULL
  AND a.deleted_at IS NULL
  AND l.id IS NULL;

UPDATE assessments a
JOIN courses c ON c.id = a.course_id
SET a.section_id = NULL,
    a.lesson_id = NULL,
    a.title = 'ข้อสอบก่อนเรียน',
    a.description = 'ประเมินพื้นฐานก่อนเริ่มเรียน คะแนนใช้เพื่อเปรียบเทียบความก้าวหน้าเท่านั้น',
    a.passing_score = 0,
    a.max_attempts = 1,
    a.time_limit_minutes = COALESCE(a.time_limit_minutes, 15),
    a.question_limit = COALESCE(a.question_limit, 10),
    a.is_required = TRUE,
    a.counts_toward_completion = FALSE,
    a.compare_group = 'main',
    a.randomize_questions = TRUE,
    a.randomize_options = TRUE,
    a.show_answers = 'never',
    a.status = 'published',
    a.sort_order = 1
WHERE c.slug = 'microsoft-word'
  AND a.type = 'pre_test'
  AND a.deleted_at IS NULL;

INSERT INTO assessments (
  course_id,
  section_id,
  lesson_id,
  shared_question_source_id,
  title,
  type,
  description,
  passing_score,
  max_attempts,
  time_limit_minutes,
  question_limit,
  is_required,
  counts_toward_completion,
  compare_group,
  randomize_questions,
  randomize_options,
  show_answers,
  status,
  sort_order
)
SELECT
  c.id,
  NULL,
  NULL,
  pre.id,
  'ข้อสอบหลังเรียน',
  'post_test',
  'ประเมินผลหลังเรียนโดยใช้ชุดคำถามเดียวกับก่อนเรียนและสุ่มลำดับข้อสอบ',
  70,
  2,
  COALESCE(pre.time_limit_minutes, 15),
  COALESCE(pre.question_limit, 10),
  TRUE,
  TRUE,
  'main',
  TRUE,
  TRUE,
  'never',
  'published',
  2
FROM courses c
JOIN assessments pre
  ON pre.course_id = c.id
 AND pre.type = 'pre_test'
 AND pre.deleted_at IS NULL
WHERE c.slug = 'microsoft-word'
  AND NOT EXISTS (
    SELECT 1
    FROM assessments post
    WHERE post.course_id = c.id
      AND post.type = 'post_test'
      AND post.deleted_at IS NULL
  )
LIMIT 1;

UPDATE assessments post
JOIN courses c ON c.id = post.course_id
JOIN assessments pre
  ON pre.course_id = c.id
 AND pre.type = 'pre_test'
 AND pre.deleted_at IS NULL
SET post.section_id = NULL,
    post.lesson_id = NULL,
    post.shared_question_source_id = pre.id,
    post.title = 'ข้อสอบหลังเรียน',
    post.description = 'ประเมินผลหลังเรียนโดยใช้ชุดคำถามเดียวกับก่อนเรียนและสุ่มลำดับข้อสอบ',
    post.passing_score = 70,
    post.max_attempts = COALESCE(post.max_attempts, 2),
    post.time_limit_minutes = COALESCE(post.time_limit_minutes, pre.time_limit_minutes, 15),
    post.question_limit = COALESCE(post.question_limit, pre.question_limit, 10),
    post.is_required = TRUE,
    post.counts_toward_completion = TRUE,
    post.compare_group = 'main',
    post.randomize_questions = TRUE,
    post.randomize_options = TRUE,
    post.show_answers = 'never',
    post.status = 'published',
    post.sort_order = 2
WHERE c.slug = 'microsoft-word'
  AND post.type = 'post_test'
  AND post.deleted_at IS NULL;
