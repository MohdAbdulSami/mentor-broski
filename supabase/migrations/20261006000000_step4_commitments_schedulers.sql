-- Migration: 20261006000000_step4_commitments_schedulers.sql
-- Step 4: Commitments + Reminders + Proactive Engagement RPC Functions

-- 1. Atomic claim function for due reminders to prevent multi-tab race conditions
CREATE OR REPLACE FUNCTION public.claim_due_reminders(
    p_user_id UUID,
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
        WHERE user_id = p_user_id
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

-- 2. Atomic claim function for proactive check-in to enforce 12h inactivity and single execution
CREATE OR REPLACE FUNCTION public.claim_proactive_checkin(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_inactivity_threshold INTERVAL := INTERVAL '12 hours';
BEGIN
    -- Lock user profile for update
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = p_user_id
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 1. Exclude first-time / incomplete onboarding users
    IF COALESCE(v_profile.onboarding_completed, FALSE) = FALSE AND COALESCE(v_profile.onboarding_step, '') != 'ONBOARDING_COMPLETE' THEN
        RETURN FALSE;
    END IF;

    -- 2. Must have last_user_activity_at and must be >= 12 hours ago
    IF v_profile.last_user_activity_at IS NULL OR (v_now - v_profile.last_user_activity_at) < v_inactivity_threshold THEN
        RETURN FALSE;
    END IF;

    -- 3. Check last_proactive_checkin_at: must be NULL or >= 12 hours ago
    IF v_profile.last_proactive_checkin_at IS NOT NULL AND (v_now - v_profile.last_proactive_checkin_at) < v_inactivity_threshold THEN
        RETURN FALSE;
    END IF;

    -- 4. Check next_proactive_checkin_at: must be NULL or <= NOW()
    IF v_profile.next_proactive_checkin_at IS NOT NULL AND v_profile.next_proactive_checkin_at > v_now THEN
        RETURN FALSE;
    END IF;

    -- Atomic claim successful! Update profile timestamps
    UPDATE public.profiles
    SET last_proactive_checkin_at = v_now,
        next_proactive_checkin_at = v_now + v_inactivity_threshold,
        engagement_status = 'CHECKED_IN'
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$;

-- 3. Atomic upsert function for commitments to prevent duplicate pending commitments
CREATE OR REPLACE FUNCTION public.upsert_commitment(
    p_user_id UUID,
    p_conversation_id UUID,
    p_statement TEXT,
    p_action TEXT,
    p_target_window TEXT,
    p_due_at TIMESTAMPTZ
)
RETURNS public.commitments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id UUID;
    v_result public.commitments%ROWTYPE;
BEGIN
    -- Check if an active (PENDING or REMINDING) commitment with matching action exists for user
    SELECT id INTO v_existing_id
    FROM public.commitments
    WHERE user_id = p_user_id
      AND status IN ('PENDING', 'REMINDING')
      AND LOWER(TRIM(action)) = LOWER(TRIM(p_action))
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing commitment instead of duplicating
        UPDATE public.commitments
        SET due_at = p_due_at,
            target_window = p_target_window,
            statement = p_statement,
            conversation_id = COALESCE(p_conversation_id, conversation_id),
            notification_status = 'PENDING',
            reminder_count = 0,
            escalation_level = 0,
            next_reminder_at = NULL
        WHERE id = v_existing_id
        RETURNING * INTO v_result;
    ELSE
        -- Insert new commitment record
        INSERT INTO public.commitments (
            user_id,
            conversation_id,
            statement,
            action,
            target_window,
            due_at,
            status,
            notification_status,
            reminder_count,
            escalation_level
        ) VALUES (
            p_user_id,
            p_conversation_id,
            p_statement,
            p_action,
            p_target_window,
            p_due_at,
            'PENDING',
            'PENDING',
            0,
            0
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;
