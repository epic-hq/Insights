-- Add is_platform_admin column to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- Create function to check if current user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM user_settings WHERE user_id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
