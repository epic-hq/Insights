create table "public"."user_settings" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "onboarding_completed" boolean not null default false,
    "onboarding_steps" jsonb not null default '{}'::jsonb,
    "theme" text default 'system'::text,
    "language" text default 'en'::text,
    "notification_preferences" jsonb not null default '{}'::jsonb,
    "ui_preferences" jsonb not null default '{}'::jsonb,
    "last_used_account_id" uuid,
    "last_used_project_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."user_settings" enable row level security;

CREATE UNIQUE INDEX user_settings_pkey ON public.user_settings USING btree (id);

CREATE UNIQUE INDEX user_settings_user_id_key ON public.user_settings USING btree (user_id);

alter table "public"."user_settings" add constraint "user_settings_pkey" PRIMARY KEY using index "user_settings_pkey";

alter table "public"."user_settings" add constraint "user_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_settings" validate constraint "user_settings_user_id_fkey";

alter table "public"."user_settings" add constraint "user_settings_user_id_key" UNIQUE using index "user_settings_user_id_key";

grant delete on table "public"."user_settings" to "anon";

grant insert on table "public"."user_settings" to "anon";

grant references on table "public"."user_settings" to "anon";

grant select on table "public"."user_settings" to "anon";

grant trigger on table "public"."user_settings" to "anon";

grant truncate on table "public"."user_settings" to "anon";

grant update on table "public"."user_settings" to "anon";

grant delete on table "public"."user_settings" to "authenticated";

grant insert on table "public"."user_settings" to "authenticated";

grant references on table "public"."user_settings" to "authenticated";

grant select on table "public"."user_settings" to "authenticated";

grant trigger on table "public"."user_settings" to "authenticated";

grant truncate on table "public"."user_settings" to "authenticated";

grant update on table "public"."user_settings" to "authenticated";

grant delete on table "public"."user_settings" to "service_role";

grant insert on table "public"."user_settings" to "service_role";

grant references on table "public"."user_settings" to "service_role";

grant select on table "public"."user_settings" to "service_role";

grant trigger on table "public"."user_settings" to "service_role";

grant truncate on table "public"."user_settings" to "service_role";

grant update on table "public"."user_settings" to "service_role";

create policy "Users can update own settings"
on "public"."user_settings"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can upsert own settings"
on "public"."user_settings"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can view own settings"
on "public"."user_settings"
as permissive
for select
to public
using ((auth.uid() = user_id));


CREATE TRIGGER set_user_settings_timestamp BEFORE INSERT OR UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION accounts.trigger_set_timestamps();


