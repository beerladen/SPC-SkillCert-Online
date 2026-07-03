-- Learning task passing_score is an absolute score, not a percentage.
-- Repair older rows where 70 was stored as a percent while max_score was lower.

UPDATE learning_tasks
SET passing_score = ROUND(max_score * 0.7, 2)
WHERE max_score > 0
  AND passing_score > max_score;
