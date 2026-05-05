-- =============================================
-- Hero Academy — Server-side rating rank RPCs
-- =============================================
-- Provides a single source of truth for "ranking in class / in school":
--  • get_user_rating_rank(user_id, scope)  → (rank, total) for the given user
--  • get_rating_leaderboard(user_id, scope, limit) → top-N rows with stable RANK()
--
-- Tie-break order: xp DESC, level DESC, streak_current DESC, created_at ASC.
-- Only role='student' rows are counted (teachers/admins excluded).
-- SECURITY DEFINER so RLS on heroes/users does not block class peers.

CREATE OR REPLACE FUNCTION get_user_rating_rank(
  p_user_id UUID,
  p_scope   TEXT DEFAULT 'class'
)
RETURNS TABLE(rank INT, total INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id  UUID;
  v_school_id UUID;
BEGIN
  SELECT class_id, school_id
    INTO v_class_id, v_school_id
  FROM users
  WHERE id = p_user_id;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      h.user_id,
      RANK() OVER (
        ORDER BY h.xp DESC, h.level DESC, h.streak_current DESC, h.created_at ASC
      )::INT AS r
    FROM heroes h
    INNER JOIN users u ON u.id = h.user_id
    WHERE u.role = 'student'
      AND (
        (p_scope = 'class'  AND v_class_id  IS NOT NULL AND u.class_id  = v_class_id)
        OR
        (p_scope = 'school' AND v_school_id IS NOT NULL AND u.school_id = v_school_id)
      )
  )
  SELECT
    COALESCE((SELECT r FROM ranked WHERE user_id = p_user_id), 0)::INT AS rank,
    (SELECT COUNT(*)::INT FROM ranked) AS total;
END;
$$;

CREATE OR REPLACE FUNCTION get_rating_leaderboard(
  p_user_id UUID,
  p_scope   TEXT DEFAULT 'class',
  p_limit   INT  DEFAULT 50
)
RETURNS TABLE(
  rank           INT,
  hero_id        UUID,
  user_id        UUID,
  display_name   TEXT,
  avatar_url     TEXT,
  level          INT,
  xp             INT,
  gold           INT,
  streak_current INT,
  is_self        BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id  UUID;
  v_school_id UUID;
BEGIN
  SELECT class_id, school_id
    INTO v_class_id, v_school_id
  FROM users
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      RANK() OVER (
        ORDER BY h.xp DESC, h.level DESC, h.streak_current DESC, h.created_at ASC
      )::INT                                AS rank,
      h.id                                  AS hero_id,
      h.user_id                             AS user_id,
      COALESCE(u.display_name, h.name)      AS display_name,
      u.avatar_url                          AS avatar_url,
      h.level                               AS level,
      h.xp                                  AS xp,
      h.gold                                AS gold,
      COALESCE(h.streak_current, 0)         AS streak_current,
      (h.user_id = p_user_id)               AS is_self
    FROM heroes h
    INNER JOIN users u ON u.id = h.user_id
    WHERE u.role = 'student'
      AND (
        (p_scope = 'class'  AND v_class_id  IS NOT NULL AND u.class_id  = v_class_id)
        OR
        (p_scope = 'school' AND v_school_id IS NOT NULL AND u.school_id = v_school_id)
      )
  ) ranked
  ORDER BY ranked.rank
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_rating_rank(UUID, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION get_rating_leaderboard(UUID, TEXT, INT) TO authenticated;
