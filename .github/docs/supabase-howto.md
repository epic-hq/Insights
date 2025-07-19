# Supabase How To

## Schema

create in supabase/schemas

`supabase db diff -f description` to generate a migration. This will create a new migration file in the `supabase/migrations` directory. We should then run `supabase db push` to apply the migration to the database. or `supabase db reset` to reset the database to the state of the migration files. It will drop the database and recreate it from the migration files and run seed.sql.

`supabase db push --linked` to apply the migration to the database in the cloud.

## Functions

Run deno locally. `supabase functions serve --env-file .env`

## Storage
