-- Grant execute permission to authenticated users
grant execute on function upsert_signup_data(uuid, jsonb) to authenticated;
