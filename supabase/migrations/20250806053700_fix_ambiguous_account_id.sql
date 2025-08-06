-- Fix ambiguous account_id references in get_account function
-- This resolves the "column reference 'account_id' is ambiguous" error

CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = accounts,public
AS
$$
DECLARE
    user_id uuid;
    user_role text;
BEGIN
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account (fixed ambiguous references)
    SELECT au.account_role INTO user_role
    FROM accounts.account_user au
    WHERE au.account_id = get_account.account_id AND au.user_id = user_id
    LIMIT 1;

    IF user_role IS NULL THEN
        RAISE EXCEPTION 'You must be a member of an account to access it';
    END IF;

    -- Return the account data (fixed ambiguous references)
    RETURN (
        SELECT json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = user_id,
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', CASE
                WHEN a.personal_account = true THEN config.enable_personal_account_billing
                ELSE config.enable_team_account_billing
            END,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        FROM accounts.accounts a
        JOIN accounts.config config ON true
        LEFT JOIN (
            SELECT bs.account_id, bs.status
            FROM accounts.billing_subscriptions bs
            WHERE bs.account_id = get_account.account_id
            ORDER BY bs.created DESC
            LIMIT 1
        ) bs ON bs.account_id = a.id
        WHERE a.id = get_account.account_id
    );
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_account(uuid) TO anon, authenticated, service_role;
