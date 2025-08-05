alter table "public"."account_settings" add column "current_account_id" uuid;

alter table "public"."account_settings" add column "current_project_id" uuid;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_current_account_id(new_account_id uuid)
 RETURNS account_settings
 LANGUAGE plpgsql
AS $function$
declare
  updated_row public.account_settings;
begin
  update public.account_settings
  set current_account_id = new_account_id
  where user_id = auth.uid()
  returning * into updated_row;
  return updated_row;
end;
$function$
;


grant execute on function public.set_current_account_id(uuid) to authenticated, service_role;
