-- Add leave_account function to allow users to remove themselves from an account
-- Primary owners cannot leave their own account - they must transfer ownership first

create or replace function public.leave_account(account_id uuid)
    returns void
    language plpgsql
as
$$
DECLARE
    current_user_id uuid := auth.uid();
    is_primary boolean;
BEGIN
    -- Check if user is a member of this account
    if not exists (
        select 1 from accounts.account_user au
        where au.account_id = leave_account.account_id
          and au.user_id = current_user_id
    ) then
        raise exception 'You are not a member of this account';
    end if;

    -- Check if user is the primary owner
    select is_primary_owner into is_primary
    from accounts.account_user au
    where au.account_id = leave_account.account_id
      and au.user_id = current_user_id;

    if is_primary = true then
        raise exception 'Primary owners cannot leave their account. Transfer ownership first or delete the account.';
    end if;

    -- Remove the user from the account
    delete from accounts.account_user au
    where au.account_id = leave_account.account_id
      and au.user_id = current_user_id;
END;
$$;

grant execute on function public.leave_account(uuid) to authenticated;
