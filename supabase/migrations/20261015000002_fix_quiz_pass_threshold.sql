-- Migration: 20261015000002_fix_quiz_pass_threshold.sql
-- Fix quiz pass threshold from 70% to 60%
--
-- RATIONALE: With 3-question quizzes (the current default), a 70% threshold
-- is mathematically equivalent to requiring 100% (3/3) correct because:
--   2/3 = 66.67% → ROUND = 67% < 70%  (fails)
--   3/3 = 100% >= 70%                   (passes)
-- This made it impossible for students to pass unless they answered every
-- question correctly. 60% correctly gates at 2/3 correct (67% >= 60%).
-- This matches standard educational grading (D/passing = 60%).
--
-- Also retroactively marks past quiz_attempts with score >= 60 as passed.

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_quiz_id UUID,
  p_answers INT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_id UUID;
  v_roadmap_owner UUID;
  v_questions JSONB;
  v_correct_count INT := 0;
  v_total_count INT := 0;
  v_elem JSONB;
  v_idx INT := 1;
  v_correct_idx INT;
  v_explanation TEXT;
  v_user_ans INT;
  v_score INT;
  v_passed BOOLEAN;
  v_attempt_id UUID;
  v_details JSONB := '[]'::jsonb;
  v_question_text TEXT;
  v_options JSONB;
  v_user_ans_text TEXT;
  v_correct_ans_text TEXT;
  v_is_correct BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  -- Fetch quiz & verify ownership
  SELECT q.roadmap_id, q.questions, r.user_id 
  INTO v_roadmap_id, v_questions, v_roadmap_owner
  FROM public.quizzes q
  JOIN public.roadmaps r ON r.id = q.roadmap_id
  WHERE q.id = p_quiz_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Quiz belongs to another user';
  END IF;

  -- Evaluate answers
  v_total_count := jsonb_array_length(v_questions);

  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_text := v_elem->>'question';
    v_options := v_elem->'options';
    v_correct_idx := (v_elem->>'correctOptionIndex')::int;
    v_explanation := v_elem->>'explanation';
    v_user_ans := CASE WHEN v_idx <= array_length(p_answers, 1) THEN p_answers[v_idx] ELSE -1 END;

    v_is_correct := (v_user_ans = v_correct_idx);
    IF v_is_correct THEN
      v_correct_count := v_correct_count + 1;
    END IF;

    -- Extract text for selected option and correct option
    v_user_ans_text := CASE 
      WHEN v_user_ans >= 0 AND v_user_ans < jsonb_array_length(v_options) 
      THEN v_options->>v_user_ans 
      ELSE 'No answer selected' 
    END;

    v_correct_ans_text := CASE 
      WHEN v_correct_idx >= 0 AND v_correct_idx < jsonb_array_length(v_options) 
      THEN v_options->>v_correct_idx 
      ELSE '' 
    END;

    v_details := v_details || jsonb_build_object(
      'question_index', v_idx - 1,
      'question', v_question_text,
      'options', v_options,
      'user_answer_index', v_user_ans,
      'user_answer_text', v_user_ans_text,
      'correct_answer_index', v_correct_idx,
      'correct_answer_text', v_correct_ans_text,
      'is_correct', v_is_correct,
      'explanation', v_explanation
    );

    v_idx := v_idx + 1;
  END LOOP;

  v_score := ROUND((v_correct_count::numeric / v_total_count::numeric) * 100);
  -- Pass threshold: 60% (allows 2/3 correct for 3-question quizzes)
  v_passed := v_score >= 60;

  -- Insert attempt record
  INSERT INTO public.quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (v_user_id, p_quiz_id, v_score, v_passed, to_jsonb(p_answers))
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'passed', v_passed,
    'total_count', v_total_count,
    'correct_count', v_correct_count,
    'details', v_details
  );
END;
$$;

-- Retroactively correct past quiz attempts that should have passed at 60%
UPDATE public.quiz_attempts
SET passed = TRUE
WHERE score >= 60 AND passed = FALSE;
