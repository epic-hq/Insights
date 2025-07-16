-- Create comments table
create table "public"."comments" (
  "id" uuid not null default gen_random_uuid(),
  "org_id" uuid not null,
  "insight_id" uuid not null,
  "user_id" uuid not null,
  "content" text not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

-- Add primary key
alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY ("id");

-- Add foreign key to insights table
alter table "public"."comments"
  add constraint "comments_insight_id_fkey"
  foreign key ("insight_id")
  references "public"."insights"("id")
  on delete cascade;

-- Add foreign key to organizations table
alter table "public"."comments"
  add constraint "comments_org_id_fkey"
  foreign key ("org_id")
  references "public"."organizations"("id")
  on delete cascade;

-- Add row level security
create policy "Enable read access for all users"
on "public"."comments"
as permissive
for select
to authenticated, anon
using (true);

create policy "Enable insert for authenticated users"
on "public"."comments"
as permissive
for insert
to authenticated
with check (true);

create policy "Enable update for users based on user_id"
on "public"."comments"
as permissive
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Enable delete for users based on user_id"
on "public"."comments"
as permissive
for delete
to authenticated
using (auth.uid() = user_id);

-- Add indexes for better query performance
create index if not exists "comments_insight_id_idx" on "public"."comments" ("insight_id");
create index if not exists "comments_org_id_idx" on "public"."comments" ("org_id");
create index if not exists "comments_user_id_idx" on "public"."comments" ("user_id");
create index if not exists "comments_created_at_idx" on "public"."comments" ("created_at" desc);

-- Add trigger for updated_at
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_comments_modtime
before update on "public"."comments"
for each row
execute function update_modified_column();

-- Insert seed data (example data)
-- insert into "public"."comments" (org_id, insight_id, user_id, content) values
--   ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'This is a sample comment on insight 1'),
--   ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Another comment on the same insight'),
--   ('00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Comment on a different insight');

-- Grant permissions
grant select, insert, update, delete on table "public"."comments" to "authenticated";
grant select on table "public"."comments" to "anon";
grant all on table "public"."comments" to "service_role";
