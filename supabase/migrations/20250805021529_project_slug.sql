set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_accounts()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'accounts', 'public'
AS $function$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'account_id', au.account_id,
        'account_role', au.account_role,
        'is_primary_owner', a.primary_owner_user_id = auth.uid(),
        'name', a.name,
        'slug', a.slug,
        'personal_account', a.personal_account,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'projects', COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'description', p.description,
              'status', p.status,
							'slug', p.slug,
              'created_at', p.created_at,
              'updated_at', p.updated_at
            )
          )
          FROM public.projects p
          WHERE p.account_id = au.account_id
          ), '[]'::json
        )
      )
    ),
    '[]'::json
  )
  FROM accounts.account_user au
  JOIN accounts.accounts a ON a.id = au.account_id
  WHERE au.user_id = auth.uid();
$function$
;


