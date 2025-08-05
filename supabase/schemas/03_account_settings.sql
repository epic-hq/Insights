-- Function: public.set_current_account_id
-- Updates the current_account_id in public.account_settings for the authenticated user

create or replace function public.set_current_account_id(new_account_id uuid)
  returns void
  language plpgsql
as
$$
begin
  update public.account_settings
  set current_account_id = new_account_id
  where user_id = auth.uid();
end;
$$;

grant execute on function public.set_current_account_id(uuid) to authenticated, service_role;