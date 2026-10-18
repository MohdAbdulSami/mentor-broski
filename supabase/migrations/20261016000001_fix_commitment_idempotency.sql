-- Migration: Fix commitment idempotency & push subscription atomicity
-- Deployed live to Supabase during debugging session (2026-10-16)
-- This migration documents the live SQL changes applied.

-- =============================================================================
-- 1. REPLACE upsert_commitment
--    Old behavior: matched action ILIKE across all PENDING/REMINDING rows — 
--    incorrectly merged new intentional reminders into old ones.
--    New behavior:
--      a) If p_source_message_id is provided → match only on that field (true idempotency).
--      b) Else → match only identical statement within a 5-second burst (rapid double-submit guard).
--      c) Otherwise → INSERT a brand-new distinct commitment row.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_commitment(
    p_user_id UUID,
    p_conversation_id UUID,
    p_statement TEXT,
    p_action TEXT,
    p_target_window TEXT,
    p_due_at TIMESTAMPTZ,
    p_source_message_id TEXT DEFAULT NULL
)
RETURNS public.commitments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_id UUID;
    v_result public.commitments%ROWTYPE;
BEGIN
    -- 1. Authentication check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: authentication is required to create commitments';
    END IF;

    -- 2. User ownership enforcement (allow service_role or matching auth.uid)
    IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Forbidden: cannot create commitments for another user';
    END IF;

    -- 3. If source_message_id is provided, check if that exact message operation was already recorded
    IF p_source_message_id IS NOT NULL AND TRIM(p_source_message_id) <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.commitments
        WHERE user_id = p_user_id
          AND source_message_id = p_source_message_id
        LIMIT 1;
    -- 4. If no source_message_id, deduplicate only identical statements within a 5-second burst
    ELSE
        SELECT id INTO v_existing_id
        FROM public.commitments
        WHERE user_id = p_user_id
          AND statement = p_statement
          AND created_at >= (NOW() - INTERVAL '5 seconds')
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        SELECT * INTO v_result FROM public.commitments WHERE id = v_existing_id;
        RETURN v_result;
    END IF;

    -- 5. Insert brand new distinct commitment record
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
        escalation_level,
        source_message_id
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
        0,
        p_source_message_id
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- 6-param wrapper for backward compatibility, forwarding to secure 7-param implementation
CREATE OR REPLACE FUNCTION public.upsert_commitment(
    p_user_id UUID,
    p_conversation_id UUID,
    p_statement TEXT,
    p_action TEXT,
    p_target_window TEXT,
    p_due_at TIMESTAMP WITH TIME ZONE
)
RETURNS public.commitments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.upsert_commitment(
        p_user_id,
        p_conversation_id,
        p_statement,
        p_action,
        p_target_window,
        p_due_at,
        NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_commitment(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_commitment(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.upsert_commitment(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_commitment(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;


-- =============================================================================
-- 2. CREATE upsert_push_subscription (SECURITY DEFINER)
--    Allows the authenticated user to insert or update their push subscription
--    by endpoint. Uses SECURITY DEFINER to allow endpoint reassignment across
--    user accounts without an RLS policy violation when the same browser 
--    subscription endpoint is re-registered after a sign-out/sign-in cycle.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
    p_endpoint TEXT,
    p_p256dh TEXT,
    p_auth TEXT,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.push_subscriptions (
        user_id,
        endpoint,
        p256dh,
        auth,
        user_agent,
        updated_at
    ) VALUES (
        v_user_id,
        p_endpoint,
        p_p256dh,
        p_auth,
        p_user_agent,
        NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE
    SET user_id    = v_user_id,
        p256dh     = EXCLUDED.p256dh,
        auth       = EXCLUDED.auth,
        user_agent = COALESCE(EXCLUDED.user_agent, public.push_subscriptions.user_agent),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
