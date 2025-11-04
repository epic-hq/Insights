-- Add workflow type for projects and conversation analyses storage

-- Ensure enum exists before column usage
DO $$
BEGIN
    CREATE TYPE public.project_workflow_type AS ENUM ('research','sales','conversation_analysis');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS workflow_type public.project_workflow_type NOT NULL DEFAULT 'research';

DO $$
BEGIN
    CREATE TYPE public.conversation_analysis_status AS ENUM ('pending','processing','completed','failed');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.conversation_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    recording_url text NOT NULL,
    transcript text,
    status public.conversation_analysis_status NOT NULL DEFAULT 'pending',
    summary text,
    detected_questions jsonb,
    participant_goals jsonb,
    key_takeaways jsonb,
    open_questions jsonb,
    recommendations jsonb,
    duration_seconds numeric,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_analyses_account_idx ON public.conversation_analyses(account_id);
CREATE INDEX IF NOT EXISTS conversation_analyses_status_idx ON public.conversation_analyses(status);

CREATE TRIGGER set_conversation_analyses_timestamps
    BEFORE INSERT OR UPDATE ON public.conversation_analyses
    FOR EACH ROW
EXECUTE PROCEDURE accounts.trigger_set_timestamps();

ALTER TABLE public.conversation_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_analyses' AND policyname = 'Account members can read conversation analyses') THEN
        CREATE POLICY "Account members can read conversation analyses" ON public.conversation_analyses
            FOR SELECT
            TO authenticated
            USING (
                account_id IN (
                    SELECT account_id FROM accounts.account_user WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_analyses' AND policyname = 'Account members can insert conversation analyses') THEN
        CREATE POLICY "Account members can insert conversation analyses" ON public.conversation_analyses
            FOR INSERT
            TO authenticated
            WITH CHECK (
                account_id IN (
                    SELECT account_id FROM accounts.account_user WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_analyses' AND policyname = 'Account members can update conversation analyses') THEN
        CREATE POLICY "Account members can update conversation analyses" ON public.conversation_analyses
            FOR UPDATE
            TO authenticated
            USING (
                account_id IN (
                    SELECT account_id FROM accounts.account_user WHERE user_id = auth.uid()
                )
            )
            WITH CHECK (
                account_id IN (
                    SELECT account_id FROM accounts.account_user WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;
