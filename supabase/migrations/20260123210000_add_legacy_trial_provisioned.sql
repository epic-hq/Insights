-- Add column to track if legacy trial has been provisioned for this user
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS legacy_trial_provisioned_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_legacy_trial
ON public.user_settings(user_id)
WHERE legacy_trial_provisioned_at IS NOT NULL;

COMMENT ON COLUMN public.user_settings.legacy_trial_provisioned_at IS 'Timestamp when legacy trial was provisioned for existing users migrating to billing system';
