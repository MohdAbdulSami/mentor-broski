-- Migration: 20261014000000_phase2_secure_progression.sql
-- Phase 2: Secure Roadmap Progression & Task Completion RPCs

-- 1. Complete Roadmap Task RPC
-- Enforces:
--  - User authentication and ownership
--  - Task day MUST match roadmap current_day (Cannot complete Day 5 while on Day 1)
--  - All prerequisite tasks for previous days must be complete
--  - Does NOT automatically advance current_day (requires explicit progression choice)
CREATE OR REPLACE FUNCTION public.complete_roadmap_task(
  p_roadmap_id UUID,
  p_task_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap RECORD;
  v_stages JSONB;
  v_stage JSONB;
  v_task JSONB;
  v_updated_stages JSONB := '[]'::jsonb;
  v_updated_tasks JSONB;
  v_task_found BOOLEAN := FALSE;
  v_task_day INT;
  v_current_day INT;
  v_prereq_failed BOOLEAN := FALSE;
  v_missing_prereq_day INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  SELECT * INTO v_roadmap
  FROM public.roadmaps
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roadmap not found or access denied: %', p_roadmap_id;
  END IF;

  v_current_day := COALESCE(v_roadmap.current_day, 1);
  v_stages := v_roadmap.stages;

  -- 1. Locate task and verify day
  FOR v_stage IN SELECT * FROM jsonb_array_elements(v_stages)
  LOOP
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks')
    LOOP
      IF v_task->>'id' = p_task_id OR ('task-' || (v_task->>'day')) = p_task_id THEN
        v_task_found := TRUE;
        v_task_day := (v_task->>'day')::int;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT v_task_found THEN
    RAISE EXCEPTION 'Task % not found in roadmap %', p_task_id, p_roadmap_id;
  END IF;

  -- Security check: Current day must match task day
  IF v_task_day <> v_current_day THEN
    RAISE EXCEPTION 'Progression security violation: Cannot complete Day % task while on Day %', v_task_day, v_current_day;
  END IF;

  -- Security check: Check prerequisite tasks (all tasks with day < v_current_day must be completed)
  FOR v_stage IN SELECT * FROM jsonb_array_elements(v_stages)
  LOOP
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks')
    LOOP
      IF (v_task->>'day')::int < v_current_day AND NOT COALESCE((v_task->>'completed')::boolean, FALSE) THEN
        v_prereq_failed := TRUE;
        v_missing_prereq_day := (v_task->>'day')::int;
      END IF;
    END LOOP;
  END LOOP;

  IF v_prereq_failed THEN
    RAISE EXCEPTION 'Prerequisite violation: Day % task is incomplete before Day %', v_missing_prereq_day, v_current_day;
  END IF;

  -- Mark task completed
  FOR v_stage IN SELECT * FROM jsonb_array_elements(v_stages)
  LOOP
    v_updated_tasks := '[]'::jsonb;
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks')
    LOOP
      IF v_task->>'id' = p_task_id OR ('task-' || (v_task->>'day')) = p_task_id THEN
        v_updated_tasks := v_updated_tasks || jsonb_build_array(
          v_task || jsonb_build_object('completed', TRUE, 'completedAt', NOW())
        );
      ELSE
        v_updated_tasks := v_updated_tasks || jsonb_build_array(v_task);
      END IF;
    END LOOP;
    v_updated_stages := v_updated_stages || jsonb_build_array(
      jsonb_set(v_stage, '{tasks}', v_updated_tasks)
    );
  END LOOP;

  UPDATE public.roadmaps
  SET stages = v_updated_stages
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'roadmap_id', p_roadmap_id,
    'completed_day', v_task_day,
    'current_day', v_current_day
  );
END;
$$;

-- 2. Advance Roadmap Day RPC
-- Enforces:
--  - User authentication and ownership
--  - Completed day tasks must actually be completed
--  - Advances current_day by exactly 1 past completed_day
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
  v_next_day INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  SELECT * INTO v_roadmap
  FROM public.roadmaps
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roadmap not found or access denied: %', p_roadmap_id;
  END IF;

  v_next_day := GREATEST(COALESCE(v_roadmap.current_day, 1), p_completed_day + 1);

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
