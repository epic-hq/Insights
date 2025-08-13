-- Function to upsert signup chat metadata into account_settings
create or replace function upsert_signup_data(
    p_user_id uuid,
    p_signup_data jsonb
) returns void as $$
begin
    update user_settings
    set signup_data = coalesce(signup_data, '{}'::jsonb) || p_signup_data
    where user_id = p_user_id;

    -- If no row was updated, the account_id doesn't exist in account_settings
    -- This shouldn't happen in normal flow, but we can handle it gracefully
    if not found then
        raise exception 'User settings not found for user_id: %', p_user_id;
    end if;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function upsert_signup_data(uuid, jsonb) to authenticated;
