-- Migration: 20261014000001_phase2_advance_roadmap_day_security.sql
-- Security Hardening for advance_roadmap_day RPC
-- Enforces:
--  1. Ownership via auth.uid()
--  2. Row-level lock via SELECT ... FOR UPDATE (concurrency protection)
--  3. Exact day match: p_completed_day MUST equal current_day (rejects arbitrary/future day values)
--  4. Full task completion: All learning tasks for p_completed_day must exist and be completed
--  5. Mandatory passed quiz: A server-recorded passed quiz attempt is strictly required
--  6. Single day advancement: current_day advances by exactly 1
--  7. Re-entrance protection: Repeated/concurrent calls cannot unlock additional days

CREATE OR REPLACE FUNCTION public.advance_roadmap_day(
  p_roadmap_id UUID,
  p_completed_day INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap RECORD;
  v_stage JSONB;
  v_task JSONB;
  v_tasks_found INT := 0;
  v_tasks_completed INT := 0;
  v_quiz_passed BOOLEAN := FALSE;
  v_next_day INT;
BEGIN
  -- 1. Ownership & Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  -- 2. Lock the roadmap row for update (prevents race conditions & concurrent duplicate advancement)
  SELECT * INTO v_roadmap
  FROM public.roadmaps
  WHERE id = p_roadmap_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roadmap not found or access denied: %', p_roadmap_id;
  END IF;

  -- 3. Require p_completed_day = current_day (reject arbitrary or future-day values)
  IF p_completed_day <> COALESCE(v_roadmap.current_day, 1) THEN
    RAISE EXCEPTION 'Progression security error: Cannot advance Day %. Current active day is Day %.',
      p_completed_day, COALESCE(v_roadmap.current_day, 1);
  END IF;

  -- 4. Confirm that the active day's required learning tasks exist and are completed
  FOR v_stage IN SELECT * FROM jsonb_array_elements(v_roadmap.stages)
  LOOP
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks')
    LOOP
      IF (v_task->>'day')::int = p_completed_day THEN
        v_tasks_found := v_tasks_found + 1;
        IF COALESCE((v_task->>'completed')::boolean, FALSE) THEN
          v_tasks_completed := v_tasks_completed + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF v_tasks_found = 0 THEN
    RAISE EXCEPTION 'Progression error: No tasks found for Day % in roadmap %', p_completed_day, p_roadmap_id;
  END IF;

  IF v_tasks_completed < v_tasks_found THEN
    RAISE EXCEPTION 'Progression blocked: Day % has % incomplete learning task(s). All tasks must be completed before advancing.',
      p_completed_day, (v_tasks_found - v_tasks_completed);
  END IF;

  -- 5. Require a valid, server-recorded passed quiz attempt for the active day
  -- A missing quiz or missing passed attempt must NOT count as a pass.
  SELECT EXISTS (
    SELECT 1 
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE q.roadmap_id = p_roadmap_id
      AND q.day_number = p_completed_day
      AND qa.user_id = v_user_id
      AND qa.passed = TRUE
  ) INTO v_quiz_passed;

  IF NOT v_quiz_passed THEN
    RAISE EXCEPTION 'Progression blocked: A server-recorded passed quiz attempt is required for Day % before advancing.', p_completed_day;
  END IF;

  -- 6. Advance exactly one day
  v_next_day := v_roadmap.current_day + 1;

  UPDATE public.roadmaps
  SET current_day = v_next_day
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'roadmap_id', p_roadmap_id,
    'previous_day', v_roadmap.current_day,
    'current_day', v_next_day
  );
END;
$$;
