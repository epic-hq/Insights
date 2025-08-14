-- Function to upsert signup chat data into user_settings
create or replace function upsert_signup_data(
    p_user_id uuid,
    p_signup_data jsonb
) returns void as $$
begin
    -- Insert or update user_settings with signup_data
    insert into user_settings (user_id, signup_data)
    values (p_user_id, p_signup_data)
    on conflict (user_id) 
    do update set 
        signup_data = coalesce(user_settings.signup_data, '{}'::jsonb) || excluded.signup_data,
        updated_at = now();
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function upsert_signup_data(uuid, jsonb) to authenticated;
