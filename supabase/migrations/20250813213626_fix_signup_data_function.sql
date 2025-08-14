-- Ensure user_settings table has signup_data field
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS signup_data jsonb;

-- Update the upsert_signup_data function to use INSERT ON CONFLICT
CREATE OR REPLACE FUNCTION upsert_signup_data(
    p_user_id uuid,
    p_signup_data jsonb
) RETURNS void AS $$
BEGIN
    -- Insert or update user_settings with signup_data
    INSERT INTO user_settings (user_id, signup_data)
    VALUES (p_user_id, p_signup_data)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        signup_data = COALESCE(user_settings.signup_data, '{}'::jsonb) || excluded.signup_data,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_signup_data(uuid, jsonb) TO authenticated;