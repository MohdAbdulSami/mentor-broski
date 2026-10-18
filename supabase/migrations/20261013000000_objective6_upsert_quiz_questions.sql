-- Migration: 20261013000000_objective6_upsert_quiz_questions.sql
-- Objective 6: Add upsert_quiz_questions RPC so the client can persist
-- contextually-generated quiz questions (with answer keys) server-side
-- for any roadmap day that has no pre-authored curated content.
-- Answer keys are stored in the DB; the RPC returns only sanitized client data.

CREATE OR REPLACE FUNCTION public.upsert_quiz_questions(
  p_roadmap_id UUID,
  p_day_number INT,
  p_topic TEXT,
  p_questions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_owner UUID;
  v_quiz_id UUID;
  v_existing_questions JSONB;
  v_sanitized JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  IF p_roadmap_id IS NULL OR p_day_number IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters: p_roadmap_id and p_day_number are required';
  END IF;

  -- Verify roadmap belongs to authenticated user
  SELECT user_id INTO v_roadmap_owner
  FROM public.roadmaps
  WHERE id = p_roadmap_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Roadmap belongs to another user';
  END IF;

  -- Check if a quiz already exists for this day (protect existing curated content)
  SELECT id, questions INTO v_quiz_id, v_existing_questions
  FROM public.quizzes
  WHERE roadmap_id = p_roadmap_id AND day_number = p_day_number;

  IF v_quiz_id IS NOT NULL THEN
    -- Quiz already exists — return existing sanitized questions without overwriting
    -- (curated server-side content takes precedence over client-generated content)
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', elem->>'id',
        'question', elem->>'question',
        'options', elem->'options'
      )
    ) INTO v_sanitized
    FROM jsonb_array_elements(v_existing_questions) AS elem;

    RETURN jsonb_build_object(
      'id', v_quiz_id,
      'roadmap_id', p_roadmap_id,
      'day_number', p_day_number,
      'topic', p_topic,
      'questions', COALESCE(v_sanitized, '[]'::jsonb),
      'source', 'existing'
    );
  END IF;

  -- No existing quiz — upsert with the client-generated questions (with answer keys)
  INSERT INTO public.quizzes (roadmap_id, day_number, topic, questions)
  VALUES (p_roadmap_id, p_day_number, COALESCE(p_topic, 'Day ' || p_day_number || ' Milestone'), p_questions)
  ON CONFLICT (roadmap_id, day_number)
  DO UPDATE SET
    topic = EXCLUDED.topic,
    questions = EXCLUDED.questions
  RETURNING id INTO v_quiz_id;

  -- Return sanitized version (strip correctOptionIndex and explanation)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', elem->>'id',
      'question', elem->>'question',
      'options', elem->'options'
    )
  ) INTO v_sanitized
  FROM jsonb_array_elements(p_questions) AS elem;

  RETURN jsonb_build_object(
    'id', v_quiz_id,
    'roadmap_id', p_roadmap_id,
    'day_number', p_day_number,
    'topic', p_topic,
    'questions', COALESCE(v_sanitized, '[]'::jsonb),
    'source', 'generated'
  );
END;
$$;

-- Grant execute permission to authenticated users (RLS already enforces ownership)
GRANT EXECUTE ON FUNCTION public.upsert_quiz_questions(UUID, INT, TEXT, JSONB) TO authenticated;
