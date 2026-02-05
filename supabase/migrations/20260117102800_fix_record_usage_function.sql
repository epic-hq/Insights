-- Fix: resource_id accepts TEXT and converts to UUID
-- Fix: total_tokens is a generated column, don't insert into it

DROP FUNCTION IF EXISTS public.record_usage_event;

CREATE OR REPLACE FUNCTION public.record_usage_event(
    p_account_id UUID,
    p_project_id UUID,
    p_user_id UUID,
    p_provider TEXT,
    p_model TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_estimated_cost_usd DECIMAL,
    p_credits_charged INTEGER,
    p_feature_source TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_resource_id UUID;
BEGIN
    -- Convert resource_id from text to UUID if provided
    IF p_resource_id IS NOT NULL AND p_resource_id <> '' THEN
        v_resource_id := p_resource_id::UUID;
    ELSE
        v_resource_id := NULL;
    END IF;

    INSERT INTO billing.usage_events (
        account_id,
        project_id,
        user_id,
        provider,
        model,
        input_tokens,
        output_tokens,
        estimated_cost_usd,
        credits_charged,
        feature_source,
        resource_type,
        resource_id,
        idempotency_key
    ) VALUES (
        p_account_id,
        p_project_id,
        p_user_id,
        p_provider,
        p_model,
        p_input_tokens,
        p_output_tokens,
        p_estimated_cost_usd,
        p_credits_charged,
        p_feature_source,
        p_resource_type,
        v_resource_id,
        COALESCE(p_idempotency_key, gen_random_uuid()::TEXT)
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_usage_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_event TO service_role;
