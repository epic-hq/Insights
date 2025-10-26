-- Conversation Analyses -------------------------------------------------------
do $$
begin
    create type public.conversation_analysis_status as enum ('pending','processing','completed','failed');
exception when duplicate_object then
    null;
end $$;

create table if not exists public.conversation_analyses (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts.accounts(id) on delete cascade,
    created_by uuid references auth.users(id) on delete set null,
    recording_url text not null,
    transcript text,
    status public.conversation_analysis_status not null default 'pending',
    summary text,
    detected_questions jsonb,
    participant_goals jsonb,
    key_takeaways jsonb,
    open_questions jsonb,
    recommendations jsonb,
    duration_seconds numeric,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists conversation_analyses_account_idx on public.conversation_analyses(account_id);
create index if not exists conversation_analyses_status_idx on public.conversation_analyses(status);

create trigger set_conversation_analyses_timestamps
    before insert or update on public.conversation_analyses
    for each row
execute procedure accounts.trigger_set_timestamps();

alter table public.conversation_analyses enable row level security;

create policy "Account members can read conversation analyses" on public.conversation_analyses
    for select
    to authenticated
    using (
        account_id in (
            select account_id from accounts.account_user where user_id = auth.uid()
        )
    );

create policy "Account members can insert conversation analyses" on public.conversation_analyses
    for insert
    to authenticated
    with check (
        account_id in (
            select account_id from accounts.account_user where user_id = auth.uid()
        )
    );

create policy "Account members can update conversation analyses" on public.conversation_analyses
    for update
    to authenticated
    using (
        account_id in (
            select account_id from accounts.account_user where user_id = auth.uid()
        )
    )
    with check (
        account_id in (
            select account_id from accounts.account_user where user_id = auth.uid()
        )
    );
