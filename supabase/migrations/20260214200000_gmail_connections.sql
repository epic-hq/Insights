-- Gmail Connection Schema
-- Stores user Gmail connections via Pica AuthKit for survey distribution
-- Pattern matches calendar_connections but simplified (no legacy OAuth token fields)

CREATE TABLE IF NOT EXISTS public.gmail_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Pica AuthKit connection
    pica_connection_id TEXT NOT NULL,
    pica_connection_key TEXT NOT NULL,

    -- User's Gmail address (from Pica connection identity)
    email TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One Gmail connection per user per account
    UNIQUE(user_id, account_id)
);

-- Survey sends tracking table
-- Tracks individual survey invites sent via Gmail
CREATE TABLE IF NOT EXISTS public.survey_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Survey reference
    survey_id UUID NOT NULL REFERENCES public.research_links(id) ON DELETE CASCADE,

    -- Gmail connection used to send
    gmail_connection_id UUID NOT NULL REFERENCES public.gmail_connections(id) ON DELETE CASCADE,

    -- Recipient
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    to_name TEXT,

    -- Email content snapshot
    subject TEXT NOT NULL,
    from_email TEXT NOT NULL,

    -- Personalized survey link for this recipient
    personalized_link TEXT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'completed', 'bounced', 'failed')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Gmail threading
    gmail_message_id TEXT,
    gmail_thread_id TEXT,

    -- Auto-nudge tracking
    nudge_count INTEGER NOT NULL DEFAULT 0,
    last_nudged_at TIMESTAMPTZ,
    next_nudge_at TIMESTAMPTZ,
    nudge_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Error tracking
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user ON public.gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_account ON public.gmail_connections(account_id);

CREATE INDEX IF NOT EXISTS idx_survey_sends_survey ON public.survey_sends(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_sends_account ON public.survey_sends(account_id);
CREATE INDEX IF NOT EXISTS idx_survey_sends_status ON public.survey_sends(survey_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_sends_nudge ON public.survey_sends(next_nudge_at)
    WHERE nudge_enabled = true AND status NOT IN ('completed', 'bounced', 'failed');

-- RLS Policies
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_sends ENABLE ROW LEVEL SECURITY;

-- Gmail connections: Users can only manage their own
CREATE POLICY "Users can view own gmail connections"
    ON public.gmail_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail connections"
    ON public.gmail_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail connections"
    ON public.gmail_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail connections"
    ON public.gmail_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Survey sends: Account members can view, connection owner can manage
CREATE POLICY "Account members can view survey sends"
    ON public.survey_sends FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts.account_user au
            WHERE au.account_id = survey_sends.account_id
            AND au.user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can insert survey sends"
    ON public.survey_sends FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM accounts.account_user au
            WHERE au.account_id = survey_sends.account_id
            AND au.user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can update survey sends"
    ON public.survey_sends FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM accounts.account_user au
            WHERE au.account_id = survey_sends.account_id
            AND au.user_id = auth.uid()
        )
    );

-- Updated_at triggers
CREATE TRIGGER gmail_connections_updated_at
    BEFORE UPDATE ON public.gmail_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER survey_sends_updated_at
    BEFORE UPDATE ON public.survey_sends
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

-- Comments
COMMENT ON TABLE public.gmail_connections IS 'User Gmail connections via Pica AuthKit for survey distribution';
COMMENT ON TABLE public.survey_sends IS 'Individual survey invites sent via Gmail with auto-nudge tracking';
COMMENT ON COLUMN public.survey_sends.nudge_count IS 'Number of reminder emails sent (Day 3, Day 7)';
COMMENT ON COLUMN public.survey_sends.next_nudge_at IS 'When the next auto-nudge should fire (null = no more nudges)';
