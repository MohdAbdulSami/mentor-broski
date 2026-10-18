-- Migration: 20261015000000_phase4_mission_accountability.sql
-- Phase 4: Genuine Web Push & Unfinished Roadmap Mission Accountability
--
-- Components:
-- 1. Profiles preference columns (opt-in, quiet hours, daily cap, timezone)
-- 2. Mission accountability table (tracks started mission, activity timestamp, reminder count, snooze)
-- 3. Notification audit logs table (tracks daily notification cap & audit trail)
-- 4. RLS policies on new tables
-- 5. RPC: record_mission_engagement (called upon meaningful interaction)
-- 6. RPC: mark_mission_completed (stops inactivity sequence on mission pass)
-- 7. RPC: snooze_mission_reminders (pauses sequence for N minutes)
-- 8. RPC: set_accountability_preferences (user opt-in/quiet hours configuration)
-- 9. RPC: claim_unfinished_mission_reminders (atomic claim, independent verification, quiet hours check)
-- 10. Combined master scheduler RPC + pg_cron update + pg_net push trigger

-- =========================================================
-- 1. Profile Preference Columns
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accountability_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS daily_notification_cap INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS user_timezone TEXT NOT NULL DEFAULT 'UTC';

-- =========================================================
-- 2. Mission Accountability Table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.mission_accountability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  mission_title TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'PAUSED', 'SNOOZED'
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminded_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, roadmap_id, day_number)
);

-- =========================================================
-- 3. Notification Logs Table (Audit trail & Daily Cap Enforcement)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'COMMITMENT', 'UNFINISHED_MISSION', 'PROACTIVE_CHECKIN'
  reference_id TEXT,
  title TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. RLS Policies
-- =========================================================
ALTER TABLE public.mission_accountability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own mission accountability" ON public.mission_accountability;
CREATE POLICY "Users view own mission accountability"
  ON public.mission_accountability FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own notification logs" ON public.notification_logs;
CREATE POLICY "Users view own notification logs"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- =========================================================
-- 5. RPC: record_mission_engagement
-- Called when a student meaningfully interacts with today's mission
-- (e.g. starts mission, checks off task, attempts quiz, submits practice)
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_mission_engagement(
  p_roadmap_id UUID,
  p_day_number INT,
  p_mission_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_owner UUID;
  v_rec public.mission_accountability%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_next_reminder TIMESTAMPTZ := NOW() + INTERVAL '12 minutes';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  -- Verify roadmap belongs to user
  SELECT user_id INTO v_roadmap_owner
  FROM public.roadmaps
  WHERE id = p_roadmap_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Roadmap belongs to another user';
  END IF;

  -- Upsert engagement row
  INSERT INTO public.mission_accountability (
    user_id,
    roadmap_id,
    day_number,
    mission_title,
    started_at,
    last_activity_at,
    status,
    reminder_count,
    next_reminder_at,
    is_completed,
    updated_at
  ) VALUES (
    v_user_id,
    p_roadmap_id,
    p_day_number,
    COALESCE(p_mission_title, 'Day ' || p_day_number || ' Mission'),
    v_now,
    v_now,
    'ACTIVE',
    0,
    v_next_reminder,
    FALSE,
    v_now
  )
  ON CONFLICT (user_id, roadmap_id, day_number)
  DO UPDATE SET
    last_activity_at = v_now,
    -- If was completed, do not revert; otherwise ensure ACTIVE and reset reminders on re-engagement
    status = CASE WHEN mission_accountability.is_completed THEN 'COMPLETED' ELSE 'ACTIVE' END,
    reminder_count = CASE WHEN mission_accountability.is_completed THEN mission_accountability.reminder_count ELSE 0 END,
    next_reminder_at = CASE WHEN mission_accountability.is_completed THEN NULL ELSE v_next_reminder END,
    updated_at = v_now
  RETURNING * INTO v_rec;

  -- Update user last activity timestamp in profile
  UPDATE public.profiles
  SET last_user_activity_at = v_now,
      engagement_status = 'ACTIVE'
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'engagement_id', v_rec.id,
    'day_number', v_rec.day_number,
    'status', v_rec.status,
    'last_activity_at', v_rec.last_activity_at,
    'next_reminder_at', v_rec.next_reminder_at
  );
END;
$$;

-- =========================================================
-- 6. RPC: mark_mission_completed
-- Called when a mission is verified passed/completed
-- Stops all inactivity reminders for this mission
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_mission_completed(
  p_roadmap_id UUID,
  p_day_number INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_roadmap_owner UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  SELECT user_id INTO v_roadmap_owner
  FROM public.roadmaps
  WHERE id = p_roadmap_id;

  IF v_roadmap_owner IS NULL OR v_roadmap_owner <> v_user_id THEN
    RAISE EXCEPTION 'Access denied: Roadmap belongs to another user';
  END IF;

  UPDATE public.mission_accountability
  SET is_completed = TRUE,
      status = 'COMPLETED',
      next_reminder_at = NULL,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND roadmap_id = p_roadmap_id
    AND day_number = p_day_number;

  RETURN jsonb_build_object('success', true, 'status', 'COMPLETED');
END;
$$;

-- =========================================================
-- 7. RPC: snooze_mission_reminders
-- =========================================================
CREATE OR REPLACE FUNCTION public.snooze_mission_reminders(
  p_roadmap_id UUID,
  p_day_number INT,
  p_minutes INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_snooze_until TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  v_snooze_until := NOW() + (COALESCE(p_minutes, 60) || ' minutes')::INTERVAL;

  UPDATE public.mission_accountability
  SET status = 'SNOOZED',
      snoozed_until = v_snooze_until,
      next_reminder_at = v_snooze_until,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND roadmap_id = p_roadmap_id
    AND day_number = p_day_number
    AND NOT is_completed;

  RETURN jsonb_build_object('success', true, 'snoozed_until', v_snooze_until);
END;
$$;

-- =========================================================
-- 8. RPC: set_accountability_preferences
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_accountability_preferences(
  p_opt_in BOOLEAN DEFAULT TRUE,
  p_quiet_start TIME DEFAULT '22:00',
  p_quiet_end TIME DEFAULT '08:00',
  p_cap INT DEFAULT 4,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;

  UPDATE public.profiles
  SET accountability_opt_in = COALESCE(p_opt_in, TRUE),
      quiet_hours_start = COALESCE(p_quiet_start, '22:00'::TIME),
      quiet_hours_end = COALESCE(p_quiet_end, '08:00'::TIME),
      daily_notification_cap = COALESCE(p_cap, 4),
      user_timezone = COALESCE(p_timezone, 'UTC')
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================================
-- 9. RPC: claim_unfinished_mission_reminders
-- Atomic claim function with FOR UPDATE SKIP LOCKED
-- Independently validates that the mission is still incomplete in roadmaps
-- Enforces: opt-in, quiet hours, daily cap, varied mentor templates
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_unfinished_mission_reminders(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  roadmap_id UUID,
  day_number INT,
  mission_title TEXT,
  reminder_count INT,
  notification_title TEXT,
  notification_body TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cand RECORD;
  v_profile RECORD;
  v_roadmap RECORD;
  v_local_time TIME;
  v_in_quiet BOOLEAN;
  v_recent_notif_count INT;
  v_conv_id UUID;
  v_personality TEXT;
  v_mentor_id TEXT;
  v_user_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_all_tasks_done BOOLEAN;
  v_quiz_passed BOOLEAN;
  v_stage JSONB;
  v_task JSONB;
BEGIN
  -- Loop over candidate due rows locked with FOR UPDATE SKIP LOCKED
  FOR v_cand IN
    SELECT ma.*
    FROM public.mission_accountability ma
    WHERE ma.status = 'ACTIVE'
      AND ma.is_completed = FALSE
      AND ma.next_reminder_at <= NOW()
      AND (ma.snoozed_until IS NULL OR ma.snoozed_until <= NOW())
    ORDER BY ma.next_reminder_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    -- 1. Fetch user profile
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE public.profiles.user_id = v_cand.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Check user opt-in preference
    IF COALESCE(v_profile.accountability_opt_in, TRUE) = FALSE THEN
      UPDATE public.mission_accountability
      SET status = 'PAUSED', next_reminder_at = NULL, updated_at = NOW()
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- 2. Backend Independent Verification: is the mission STILL incomplete?
    SELECT * INTO v_roadmap
    FROM public.roadmaps
    WHERE public.roadmaps.id = v_cand.roadmap_id;

    IF NOT FOUND THEN
      UPDATE public.mission_accountability
      SET status = 'COMPLETED', is_completed = TRUE, next_reminder_at = NULL
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- If roadmap current_day has advanced past this mission's day, it is completed!
    IF COALESCE(v_roadmap.current_day, 1) > v_cand.day_number THEN
      UPDATE public.mission_accountability
      SET status = 'COMPLETED', is_completed = TRUE, next_reminder_at = NULL, updated_at = NOW()
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- Check if all tasks for this day are completed AND passed quiz exists
    v_all_tasks_done := TRUE;
    FOR v_stage IN SELECT * FROM jsonb_array_elements(v_roadmap.stages)
    LOOP
      FOR v_task IN SELECT * FROM jsonb_array_elements(v_stage->'tasks')
      LOOP
        IF (v_task->>'day')::int = v_cand.day_number AND COALESCE((v_task->>'completed')::boolean, FALSE) = FALSE THEN
          v_all_tasks_done := FALSE;
        END IF;
      END LOOP;
    END LOOP;

    -- Check quiz passed attempt
    SELECT EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE q.roadmap_id = v_cand.roadmap_id
        AND q.day_number = v_cand.day_number
        AND qa.user_id = v_cand.user_id
        AND qa.passed = TRUE
    ) INTO v_quiz_passed;

    IF v_all_tasks_done AND v_quiz_passed THEN
      -- Mission is actually complete! Stop sequence.
      UPDATE public.mission_accountability
      SET status = 'COMPLETED', is_completed = TRUE, next_reminder_at = NULL, updated_at = NOW()
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- 3. Quiet Hours Check (Timezone-safe)
    v_local_time := (NOW() AT TIME ZONE COALESCE(v_profile.user_timezone, 'UTC'))::time;
    IF v_profile.quiet_hours_start > v_profile.quiet_hours_end THEN
      -- Overnight quiet hours (e.g. 22:00 to 08:00)
      v_in_quiet := (v_local_time >= v_profile.quiet_hours_start OR v_local_time < v_profile.quiet_hours_end);
    ELSE
      -- Daytime quiet hours
      v_in_quiet := (v_local_time >= v_profile.quiet_hours_start AND v_local_time < v_profile.quiet_hours_end);
    END IF;

    IF v_in_quiet THEN
      -- Postpone next reminder until quiet hours end
      UPDATE public.mission_accountability
      SET next_reminder_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- 4. Daily Notification Cap Check
    SELECT COUNT(*) INTO v_recent_notif_count
    FROM public.notification_logs
    WHERE public.notification_logs.user_id = v_cand.user_id
      AND sent_at >= NOW() - INTERVAL '24 hours';

    IF v_recent_notif_count >= COALESCE(v_profile.daily_notification_cap, 4) THEN
      -- Suppress notification for today to avoid spamming
      UPDATE public.mission_accountability
      SET next_reminder_at = NOW() + INTERVAL '4 hours', updated_at = NOW()
      WHERE public.mission_accountability.id = v_cand.id;
      CONTINUE;
    END IF;

    -- 5. Build Mentor-Tailored Notification Copy
    v_personality := COALESCE(v_profile.personality, 'FRIENDLY');
    v_mentor_id := COALESCE(v_profile.active_mentor_id, 'AARYA');
    v_user_name := COALESCE(v_profile.display_name, v_profile.full_name, 'Student');
    v_title := 'Mentor Broski — Day ' || v_cand.day_number || ' Mission';

    IF v_cand.reminder_count = 0 THEN
      -- Reminder 1 (~10-15m inactivity): Gentle poke
      IF v_personality = 'BUBBLY' THEN
        v_body := 'Hey, where did you disappear? We still have today''s mission to finish 👀';
      ELSIF v_personality = 'STRICT' THEN
        v_body := 'You paused midway through Day ' || v_cand.day_number || '. Inconsistency breaks momentum. Return and finish it.';
      ELSE
        v_body := 'Hey ' || v_user_name || '! Where did you disappear? We still have today''s mission to finish 😊';
      END IF;
    ELSIF v_cand.reminder_count = 1 THEN
      -- Reminder 2 (~20-30m inactivity): Supportive check-in
      IF v_personality = 'BUBBLY' THEN
        v_body := 'Still waiting for you! Are you stuck somewhere? We can work through it together! ✨';
      ELSIF v_personality = 'STRICT' THEN
        v_body := 'Still waiting. If you are stuck on a concept, break it down and push through. Don''t leave it unfinished.';
      ELSE
        v_body := 'Still waiting for you. Are you stuck somewhere? We can work through it together.';
      END IF;
    ELSE
      -- Reminder 3 (~30-45m inactivity): Final motivational push
      IF v_personality = 'BUBBLY' THEN
        v_body := 'A little progress is better than none! Want to finish what we started today? 🚀';
      ELSIF v_personality = 'STRICT' THEN
        v_body := 'Even small progress beats giving up for the day. Return and complete your mission.';
      ELSE
        v_body := 'A little progress is better than none. Want to finish what we started?';
      END IF;
    END IF;

    -- 6. Atomically update mission accountability state
    UPDATE public.mission_accountability
    SET reminder_count = v_cand.reminder_count + 1,
        last_reminded_at = NOW(),
        -- Pause after 3 reminders to avoid infinite spamming until user re-engages
        status = CASE WHEN v_cand.reminder_count + 1 >= 3 THEN 'PAUSED' ELSE 'ACTIVE' END,
        next_reminder_at = CASE WHEN v_cand.reminder_count + 1 >= 3 THEN NULL ELSE NOW() + INTERVAL '12 minutes' END,
        updated_at = NOW()
    WHERE public.mission_accountability.id = v_cand.id;

    -- 7. Record in notification_logs (audit & cap tracking)
    INSERT INTO public.notification_logs (
      user_id,
      notification_type,
      reference_id,
      title,
      body,
      sent_at
    ) VALUES (
      v_cand.user_id,
      'UNFINISHED_MISSION',
      v_cand.id::text,
      v_title,
      v_body,
      NOW()
    );

    -- 8. Record in chat conversation for continuity
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE public.conversations.user_id = v_cand.user_id
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
      INSERT INTO public.messages (
        conversation_id,
        user_id,
        sender,
        text,
        is_proactive,
        created_at
      ) VALUES (
        v_conv_id,
        v_cand.user_id,
        'mentor',
        v_body,
        TRUE,
        NOW()
      );
    END IF;

    -- 9. Return row for Web Push dispatch
    id := v_cand.id;
    user_id := v_cand.user_id;
    roadmap_id := v_cand.roadmap_id;
    day_number := v_cand.day_number;
    mission_title := v_cand.mission_title;
    reminder_count := v_cand.reminder_count + 1;
    notification_title := v_title;
    notification_body := v_body;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =========================================================
-- 10. Combined Master Scheduler Function
-- Invoked by pg_cron every minute:
-- Processes commitments + processes unfinished missions + triggers Web Push
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
  v_m RECORD;
BEGIN
  -- 1. Process due commitments (existing flow)
  v_commitments_processed := public.process_scheduled_commitments();

  -- 2. Process unfinished mission accountability reminders
  FOR v_m IN SELECT * FROM public.claim_unfinished_mission_reminders(10) LOOP
    v_missions_processed := v_missions_processed + 1;
  END LOOP;

  -- 3. Trigger Edge Function Web Push Dispatcher via pg_net if any items were processed
  IF (v_commitments_processed > 0 OR v_missions_processed > 0) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://lfzdstodflyprsptelqy.supabase.co/functions/v1/dispatch-push-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- Non-blocking: edge function trigger is best effort
      NULL;
    END BEGIN;
  END IF;

  RETURN jsonb_build_object(
    'commitments_processed', v_commitments_processed,
    'missions_processed', v_missions_processed,
    'timestamp', NOW()
  );
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.record_mission_engagement(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mission_completed(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snooze_mission_reminders(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_accountability_preferences(BOOLEAN, TIME, TIME, INT, TEXT) TO authenticated;

-- Update pg_cron job to call process_all_scheduled_reminders
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_due_reminders_job';

SELECT cron.schedule(
    'process_due_reminders_job',
    '* * * * *',
    $$SELECT public.process_all_scheduled_reminders()$$
);
