create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
	first_name text,
	last_name text,
	company_name text,
	title text,
	role text,
	industry text,
	email text,
	mobile_phone text,
	image_url text,
	signup_data jsonb, -- signup data from chat
	trial_goals jsonb, -- success metrics
	referral_source text, -- marketing attribution
	metadata jsonb, -- misc
  onboarding_completed boolean not null default false,
  onboarding_steps jsonb not null default '{}',
  theme text default 'system',
  language text default 'en',
  notification_preferences jsonb not null default '{}',
  ui_preferences jsonb not null default '{}',
  last_used_account_id uuid,
  last_used_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can upsert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);

create trigger set_user_settings_timestamp
before insert or update on public.user_settings
for each row execute function accounts.trigger_set_timestamps();