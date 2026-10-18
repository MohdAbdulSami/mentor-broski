-- Migration: 20261006000001_step4a_server_scheduler.sql
-- Step 4A: Server-Side Scheduled Invocation via pg_cron

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Update claim_due_reminders to accept NULL p_user_id (for server-wide execution)
CREATE OR REPLACE FUNCTION public.claim_due_reminders(
    p_user_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS SETOF public.commitments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claimed_ids UUID[];
BEGIN
    -- Find and lock due commitment IDs using FOR UPDATE SKIP LOCKED
    SELECT ARRAY_AGG(id) INTO v_claimed_ids
    FROM (
        SELECT id
        FROM public.commitments
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
          AND status IN ('PENDING', 'REMINDING')
          AND due_at <= NOW()
          AND (next_reminder_at IS NULL OR next_reminder_at <= NOW())
        ORDER BY due_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    ) sub;

    IF v_claimed_ids IS NULL OR array_length(v_claimed_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Atomically update the locked commitments and return them
    RETURN QUERY
    UPDATE public.commitments
    SET status = 'REMINDING',
        notification_status = 'DELIVERED',
        reminder_count = COALESCE(reminder_count, 0) + 1,
        escalation_level = LEAST(3, COALESCE(reminder_count, 0)),
        last_reminded_at = NOW(),
        next_reminder_at = NOW() + (COALESCE(reminder_interval_minutes, 10) || ' minutes')::INTERVAL
    WHERE id = ANY(v_claimed_ids)
    RETURNING *;
END;
$$;

-- 2. Server-Side Scheduled Function: Process Due Commitments & Generate Mentor Messages
CREATE OR REPLACE FUNCTION public.process_scheduled_commitments()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec RECORD;
    v_count INT := 0;
    v_conv_id UUID;
    v_user_name TEXT;
    v_personality TEXT;
    v_reminder_text TEXT;
BEGIN
    -- Claim all due commitments across all users atomically using FOR UPDATE SKIP LOCKED
    FOR v_rec IN SELECT * FROM public.claim_due_reminders(NULL, 10) LOOP
        v_count := v_count + 1;

        -- Find active conversation for user
        SELECT id, personality INTO v_conv_id, v_personality
        FROM public.conversations
        WHERE user_id = v_rec.user_id
        ORDER BY updated_at DESC
        LIMIT 1;

        -- Get user display name or full name
        SELECT COALESCE(display_name, full_name, 'Student') INTO v_user_name
        FROM public.profiles
        WHERE user_id = v_rec.user_id;

        IF v_user_name IS NULL THEN v_user_name := 'Student'; END IF;
        IF v_personality IS NULL THEN v_personality := 'FRIENDLY'; END IF;

        -- Generate escalated reminder text based on escalation level and mentor tone
        IF v_rec.reminder_count <= 1 THEN
            IF v_personality = 'STRICT' THEN
                v_reminder_text := 'Hey ' || v_user_name || '. Your task "' || COALESCE(v_rec.action, v_rec.statement) || '" is due now. You promised to complete it. Start now.';
            ELSIF v_personality = 'BUBBLY' THEN
                v_reminder_text := 'Hellooo ' || v_user_name || '! ✨ Friendly reminder that "' || COALESCE(v_rec.action, v_rec.statement) || '" is waiting for you! Let''s get it done! 🎉';
            ELSE
                v_reminder_text := 'Hey ' || v_user_name || '! 😊 Just checking in on your promise to "' || COALESCE(v_rec.action, v_rec.statement) || '". Ready to get started?';
            END IF;
        ELSIF v_rec.reminder_count = 2 THEN
            IF v_personality = 'STRICT' THEN
                v_reminder_text := 'Still haven''t started "' || COALESCE(v_rec.action, v_rec.statement) || '"? Delaying builds bad habits. Let''s get moving right now.';
            ELSIF v_personality = 'BUBBLY' THEN
                v_reminder_text := 'Hey ' || v_user_name || '! 👀 Quick check! Did you start "' || COALESCE(v_rec.action, v_rec.statement) || '" or are we procrastinating? Let me know! ✨';
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
                v_reminder_text := 'Okay ' || v_user_name || ', intervention time! 🚨 You''ve postponed "' || COALESCE(v_rec.action, v_rec.statement) || '" multiple times. Let''s make a real plan!';
            ELSE
                v_reminder_text := 'Hey ' || v_user_name || ', you''ve missed multiple reminders for "' || COALESCE(v_rec.action, v_rec.statement) || '". Let''s reset: are you starting now, or rescheduling?';
            END IF;
        END IF;

        -- Persist reminder mentor message into user conversation if conversation exists
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
                v_rec.user_id,
                'mentor',
                v_reminder_text,
                true,
                NOW()
            );
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 3. Server-Side Scheduled Function: Process Proactive Check-Ins
CREATE OR REPLACE FUNCTION public.process_scheduled_proactive_checkins()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof RECORD;
    v_count INT := 0;
    v_conv_id UUID;
    v_personality TEXT;
    v_user_name TEXT;
    v_checkin_text TEXT;
    v_claimed BOOLEAN;
BEGIN
    FOR v_prof IN
        SELECT user_id, display_name, full_name, onboarding_completed, onboarding_step
        FROM public.profiles
        WHERE (onboarding_completed = true OR onboarding_step = 'ONBOARDING_COMPLETE')
          AND (last_user_activity_at IS NULL OR last_user_activity_at <= NOW() - INTERVAL '12 hours')
          AND (last_proactive_checkin_at IS NULL OR last_proactive_checkin_at <= NOW() - INTERVAL '12 hours')
          AND (next_proactive_checkin_at IS NULL OR next_proactive_checkin_at <= NOW())
    LOOP
        -- Atomically claim checkin for this user
        v_claimed := public.claim_proactive_checkin(v_prof.user_id);
        IF v_claimed THEN
            v_count := v_count + 1;

            -- Get conversation & personality
            SELECT id, personality INTO v_conv_id, v_personality
            FROM public.conversations
            WHERE user_id = v_prof.user_id
            ORDER BY updated_at DESC
            LIMIT 1;

            v_user_name := COALESCE(v_prof.display_name, v_prof.full_name, 'Student');
            IF v_personality IS NULL THEN v_personality := 'FRIENDLY'; END IF;

            IF v_personality = 'STRICT' THEN
                v_checkin_text := 'Hey ' || v_user_name || '. I haven''t heard from you today. Progress requires consistency. Let''s check in.';
            ELSIF v_personality = 'BUBBLY' THEN
                v_checkin_text := 'Hey ' || v_user_name || '! 👋 Missed seeing you today! How are things going? Drop a message when you get a chance! ✨';
            ELSE
                v_checkin_text := 'Hey ' || v_user_name || ', haven''t heard from you today. How''s everything going?';
            END IF;

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
                    v_prof.user_id,
                    'mentor',
                    v_checkin_text,
                    true,
                    NOW()
                );
            END IF;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 4. Register pg_cron jobs (Idempotent cleanup & scheduling)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('process_due_reminders_job', 'process_proactive_checkins_job');

SELECT cron.schedule(
    'process_due_reminders_job',
    '* * * * *',
    $$SELECT public.process_scheduled_commitments()$$
);

SELECT cron.schedule(
    'process_proactive_checkins_job',
    '*/15 * * * *',
    $$SELECT public.process_scheduled_proactive_checkins()$$
);
