-- Migration: 20261015000001_fix_push_double_claim.sql
-- Issue 5 Fix: Double-claim bug in Web Push pipeline.
--
-- ROOT CAUSE:
--   process_all_scheduled_reminders() calls process_scheduled_commitments() which
--   internally calls claim_due_reminders() marking commitments as REMINDING and setting
--   next_reminder_at into the future.
--
--   Then net.http_post is called with body='{}', so dispatch-push-notifications calls
--   claim_due_reminders() AGAIN — finding 0 records — and sends 0 push notifications.
--
-- FIX:
--   1. Add a new function process_scheduled_commitments_for_push() that claims commitments
--      AND returns their IDs for the push pipeline (instead of silently claiming them).
--   2. Update process_all_scheduled_reminders() to collect claimed IDs and pass them
--      in the body of the net.http_post call.
--   3. The Edge Function already handles reqBody.userId + title + body for direct dispatch.
--      We add a new Case 0 path: if body contains commitmentIds[], fetch those records
--      directly by ID (no re-claiming) and dispatch push notifications.
--
-- This preserves all existing behavior. The DB still marks commitments atomically.
-- The Edge Function now dispatches based on IDs passed from the DB side.

-- =========================================================
-- Updated: claim_due_commitments_for_push()
-- Same atomic claim as claim_due_reminders() but returns only the ID + user_id + action/statement
-- for lightweight push dispatch body construction.
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_due_commitments_for_push(
    p_limit INT DEFAULT 20
)
RETURNS TABLE(
    commitment_id UUID,
    user_id UUID,
    action TEXT,
    statement TEXT,
    reminder_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_claimed_ids UUID[];
BEGIN
    -- Atomically claim due commitment IDs across all users
    SELECT ARRAY_AGG(c.id) INTO v_claimed_ids
    FROM (
        SELECT id
        FROM public.commitments
        WHERE status IN ('PENDING', 'REMINDING')
          AND due_at <= NOW()
          AND (next_reminder_at IS NULL OR next_reminder_at <= NOW())
        ORDER BY due_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    ) c;

    IF v_claimed_ids IS NULL OR array_length(v_claimed_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Mark them claimed
    UPDATE public.commitments
    SET status = 'REMINDING',
        notification_status = 'DELIVERED',
        reminder_count = COALESCE(commitments.reminder_count, 0) + 1,
        escalation_level = LEAST(3, COALESCE(commitments.reminder_count, 0)),
        last_reminded_at = NOW(),
        next_reminder_at = NOW() + (COALESCE(commitments.reminder_interval_minutes, 10) || ' minutes')::INTERVAL
    WHERE commitments.id = ANY(v_claimed_ids);

    -- Return lightweight rows for push body
    RETURN QUERY
    SELECT c.id, c.user_id, c.action, c.statement, c.reminder_count
    FROM public.commitments c
    WHERE c.id = ANY(v_claimed_ids);
END;
$$;

-- =========================================================
-- Updated: process_all_scheduled_reminders()
-- Now passes claimed IDs to the Edge Function body.
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_all_scheduled_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commitments_processed INT := 0;
  v_missions_processed INT := 0;
  v_commitment_ids JSONB := '[]'::JSONB;
  v_mission_ids JSONB := '[]'::JSONB;
  v_rec RECORD;
  v_m RECORD;
  v_conv_id UUID;
  v_user_name TEXT;
  v_personality TEXT;
  v_reminder_text TEXT;
BEGIN
  -- 1. Claim due commitments atomically and collect IDs for push dispatch
  FOR v_rec IN SELECT * FROM public.claim_due_commitments_for_push(10) LOOP
    v_commitments_processed := v_commitments_processed + 1;
    v_commitment_ids := v_commitment_ids || jsonb_build_array(v_rec.commitment_id::TEXT);

    -- Generate and persist reminder chat message
    SELECT id, personality INTO v_conv_id, v_personality
    FROM public.conversations
    WHERE user_id = v_rec.user_id
    ORDER BY updated_at DESC
    LIMIT 1;

    SELECT COALESCE(display_name, full_name, 'Student') INTO v_user_name
    FROM public.profiles
    WHERE user_id = v_rec.user_id;

    IF v_user_name IS NULL THEN v_user_name := 'Student'; END IF;
    IF v_personality IS NULL THEN v_personality := 'FRIENDLY'; END IF;

    IF v_rec.reminder_count <= 1 THEN
      IF v_personality = 'STRICT' THEN
        v_reminder_text := 'Hey ' || v_user_name || '. Your task "' || COALESCE(v_rec.action, v_rec.statement) || '" is due now. You promised to complete it. Start now.';
      ELSIF v_personality = 'BUBBLY' THEN
        v_reminder_text := 'Hellooo ' || v_user_name || '! 👋 Friendly reminder that "' || COALESCE(v_rec.action, v_rec.statement) || '" is waiting for you! Let''s get it done! 🚀';
      ELSE
        v_reminder_text := 'Hey ' || v_user_name || '! 🙌 Just checking in on your promise to "' || COALESCE(v_rec.action, v_rec.statement) || '". Ready to get started?';
      END IF;
    ELSIF v_rec.reminder_count = 2 THEN
      IF v_personality = 'STRICT' THEN
        v_reminder_text := 'Still haven''t started "' || COALESCE(v_rec.action, v_rec.statement) || '"? Delaying builds bad habits. Let''s get moving right now.';
      ELSIF v_personality = 'BUBBLY' THEN
        v_reminder_text := 'Hey ' || v_user_name || '! 👀 Quick check! Did you start "' || COALESCE(v_rec.action, v_rec.statement) || '" or are we procrastinating? Let me know! 💫';
      ELSE
        v_reminder_text := 'Hey ' || v_user_name || ', "' || COALESCE(v_rec.action, v_rec.statement) || '" is still pending. What''s stopping you from getting started?';
      END IF;
    ELSIF v_rec.reminder_count = 3 THEN
      IF v_personality = 'STRICT' THEN
        v_reminder_text := 'You are behind schedule on "' || COALESCE(v_rec.action, v_rec.statement) || '". Stop postponing and take action immediately.';
      ELSIF v_personality = 'BUBBLY' THEN
        v_reminder_text := 'Hey! We really need to get "' || COALESCE(v_rec.action, v_rec.statement) || '" done! Don''t break your momentum now! 💪';
      ELSE
        v_reminder_text := 'Hey ' || v_user_name || ', you''re falling behind on "' || COALESCE(v_rec.action, v_rec.statement) || '". Do you want to work on it now or reschedule?';
      END IF;
    ELSE
      IF v_personality = 'STRICT' THEN
        v_reminder_text := 'Repeated delays on "' || COALESCE(v_rec.action, v_rec.statement) || '" will disrupt your entire career roadmap. Are you doing it now, or setting a firm new time?';
      ELSIF v_personality = 'BUBBLY' THEN
        v_reminder_text := 'Okay ' || v_user_name || ', intervention time! 🛑 You''ve postponed "' || COALESCE(v_rec.action, v_rec.statement) || '" multiple times. Let''s make a real plan!';
      ELSE
        v_reminder_text := 'Hey ' || v_user_name || ', you''ve missed multiple reminders for "' || COALESCE(v_rec.action, v_rec.statement) || '". Let''s reset: are you starting now, or rescheduling?';
      END IF;
    END IF;

    IF v_conv_id IS NOT NULL THEN
      INSERT INTO public.messages (
        conversation_id, user_id, sender, text, is_proactive, created_at
      ) VALUES (
        v_conv_id, v_rec.user_id, 'mentor', v_reminder_text, true, NOW()
      );
    END IF;
  END LOOP;

  -- 2. Process unfinished mission accountability reminders and collect their IDs
  FOR v_m IN SELECT * FROM public.claim_unfinished_mission_reminders(10) LOOP
    v_missions_processed := v_missions_processed + 1;
    v_mission_ids := v_mission_ids || jsonb_build_array(v_m.id::TEXT);
  END LOOP;

  -- 3. Trigger Edge Function Web Push Dispatcher via pg_net if any items were processed.
  --    CRITICAL FIX: Pass the already-claimed commitment IDs in the body so the Edge
  --    Function dispatches notifications by ID without re-claiming via claim_due_reminders().
  IF (v_commitments_processed > 0 OR v_missions_processed > 0) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://lfzdstodflyprsptelqy.supabase.co/functions/v1/dispatch-push-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'commitmentIds', v_commitment_ids,
          'missionIds', v_mission_ids
        ),
        timeout_milliseconds := 15000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Non-blocking: edge function trigger is best effort
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'commitments_processed', v_commitments_processed,
    'missions_processed', v_missions_processed,
    'timestamp', NOW()
  );
END;
$$;
