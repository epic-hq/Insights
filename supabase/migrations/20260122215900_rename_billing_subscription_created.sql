-- Rename 'created' to 'created_at' for consistency with codebase standards
ALTER TABLE accounts.billing_subscriptions
RENAME COLUMN created TO created_at;

-- Update get_account function that references this column
CREATE OR REPLACE FUNCTION public.get_account(account_id uuid)
    returns json
    language plpgsql
    security definer
    set search_path = accounts,public
as
$$
declare
    user_id uuid;
    user_role text;
begin
    -- Get the current user's id from the JWT/session
    user_id := auth.uid();

    -- Check if the user is a member of the account
    select au.account_role into user_role
    from accounts.account_user au
    where au.account_id = get_account.account_id and au.user_id = auth.uid()
    limit 1;

    if user_role is null then
        raise exception 'You must be a member of an account to access it';
    end if;

    -- Return the account data
    return (
        select json_build_object(
            'account_id', a.id,
            'account_role', user_role,
            'is_primary_owner', a.primary_owner_user_id = auth.uid(),
            'name', a.name,
            'slug', a.slug,
            'personal_account', a.personal_account,
            'billing_enabled', case
                when a.personal_account = true then config.enable_personal_account_billing
                else config.enable_team_account_billing
            end,
            'billing_status', bs.status,
            'created_at', a.created_at,
            'updated_at', a.updated_at,
            'metadata', a.public_metadata
        )
        from accounts.accounts a
        join accounts.config config on true
        left join (
            select bs.account_id, bs.status
            from accounts.billing_subscriptions bs
            where bs.account_id = get_account.account_id
            order by bs.created_at desc
            limit 1
        ) bs on bs.account_id = a.id
        where a.id = get_account.account_id
    );
end;
$$;

-- Update get_account_billing_status function that references this column
CREATE OR REPLACE FUNCTION public.get_account_billing_status(account_id uuid)
    RETURNS jsonb
    security definer
    set search_path = public, accounts
AS
$$
DECLARE
    result      jsonb;
    role_result jsonb;
BEGIN
    select public.current_user_account_role(get_account_billing_status.account_id) into role_result;

    select jsonb_build_object(
                   'account_id', get_account_billing_status.account_id,
                   'billing_subscription_id', s.id,
                   'billing_enabled', case
                                          when a.personal_account = true then config.enable_personal_account_billing
                                          else config.enable_team_account_billing end,
                   'billing_status', s.status,
                   'billing_customer_id', c.id,
                   'billing_provider', config.billing_provider,
                   'billing_email',
                   coalesce(c.email, u.email)
               )
    into result
    from accounts.accounts a
             join auth.users u on u.id = a.primary_owner_user_id
             left join accounts.billing_subscriptions s on s.account_id = a.id
             left join accounts.billing_customers c on c.account_id = coalesce(s.account_id, a.id)
             join accounts.config config on true
    where a.id = get_account_billing_status.account_id
    order by s.created_at desc
    limit 1;

    return result || role_result;
END;
$$ LANGUAGE plpgsql;

-- Update service_role_upsert_customer_subscription function that references this column
CREATE OR REPLACE FUNCTION public.service_role_upsert_customer_subscription(account_id uuid,
                                                                            customer jsonb default null,
                                                                            subscription jsonb default null)
    RETURNS void AS
$$
BEGIN
    -- if the customer is not null, upsert the data into billing_customers
    if customer is not null then
        insert into accounts.billing_customers (id, account_id, email, provider)
        values (customer ->> 'id', service_role_upsert_customer_subscription.account_id, customer ->> 'billing_email',
                (customer ->> 'provider'))
        on conflict (id) do update
            set email = customer ->> 'billing_email';
    end if;

    -- if the subscription is not null, upsert the data into billing_subscriptions
    if subscription is not null then
        insert into accounts.billing_subscriptions (id, account_id, billing_customer_id, status, metadata, price_id,
                                                    quantity, cancel_at_period_end, created_at, current_period_start,
                                                    current_period_end, ended_at, cancel_at, canceled_at, trial_start,
                                                    trial_end, plan_name, provider)
        values (subscription ->> 'id', service_role_upsert_customer_subscription.account_id,
                subscription ->> 'billing_customer_id', (subscription ->> 'status')::accounts.subscription_status,
                subscription -> 'metadata',
                subscription ->> 'price_id', (subscription ->> 'quantity')::int,
                (subscription ->> 'cancel_at_period_end')::boolean,
                (subscription ->> 'created_at')::timestamptz, (subscription ->> 'current_period_start')::timestamptz,
                (subscription ->> 'current_period_end')::timestamptz, (subscription ->> 'ended_at')::timestamptz,
                (subscription ->> 'cancel_at')::timestamptz,
                (subscription ->> 'canceled_at')::timestamptz, (subscription ->> 'trial_start')::timestamptz,
                (subscription ->> 'trial_end')::timestamptz,
                subscription ->> 'plan_name', (subscription ->> 'provider'))
        on conflict (id) do update
            set billing_customer_id  = subscription ->> 'billing_customer_id',
                status               = (subscription ->> 'status')::accounts.subscription_status,
                metadata             = subscription -> 'metadata',
                price_id             = subscription ->> 'price_id',
                quantity             = (subscription ->> 'quantity')::int,
                cancel_at_period_end = (subscription ->> 'cancel_at_period_end')::boolean,
                current_period_start = (subscription ->> 'current_period_start')::timestamptz,
                current_period_end   = (subscription ->> 'current_period_end')::timestamptz,
                ended_at             = (subscription ->> 'ended_at')::timestamptz,
                cancel_at            = (subscription ->> 'cancel_at')::timestamptz,
                canceled_at          = (subscription ->> 'canceled_at')::timestamptz,
                trial_start          = (subscription ->> 'trial_start')::timestamptz,
                trial_end            = (subscription ->> 'trial_end')::timestamptz,
                plan_name            = subscription ->> 'plan_name';
    end if;
end;
$$ LANGUAGE plpgsql;
