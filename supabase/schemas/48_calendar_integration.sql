-- Calendar Integration Schema
-- Stores user calendar connections and synced events for Meeting Intelligence

-- User calendar connections (one per user for now, Pro plan only)
CREATE TABLE IF NOT EXISTS public.calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Provider info
    provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'outlook')),
    provider_account_id TEXT, -- Google/Microsoft account ID
    provider_email TEXT, -- Email associated with the calendar

    -- OAuth tokens (encrypted at rest by Supabase)
    -- Nullable because Pica manages tokens when using AuthKit
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Pica AuthKit connection (alternative to direct OAuth)
    pica_connection_id TEXT,
    pica_connection_key TEXT,

    -- Sync settings
    calendar_id TEXT DEFAULT 'primary', -- Which calendar to sync (default = primary)
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT, -- Last error message if sync failed

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One connection per user per provider
    UNIQUE(user_id, provider)
);

-- Synced calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event identification
    external_id TEXT NOT NULL, -- Google/Outlook event ID

    -- Event data
    title TEXT,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT,
    location TEXT, -- Often contains meeting link
    meeting_url TEXT, -- Extracted Zoom/Meet/Teams link

    -- Attendees
    attendee_emails TEXT[] DEFAULT '{}',
    organizer_email TEXT,

    -- Classification
    is_customer_meeting BOOLEAN DEFAULT false,
    meeting_type TEXT CHECK (meeting_type IN ('customer', 'internal', 'unknown')),

    -- Matching to UpSight entities
    matched_person_ids UUID[] DEFAULT '{}',
    matched_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

    -- Meeting Intelligence status
    brief_generated_at TIMESTAMPTZ,
    brief_id UUID, -- Will reference meeting_briefs when created
    interview_id UUID REFERENCES public.interviews(id) ON DELETE SET NULL,

    -- Sync metadata
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_event JSONB, -- Full event data from provider for debugging

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique constraint on external ID per connection
    UNIQUE(connection_id, external_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON public.calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_account ON public.calendar_connections(account_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_account ON public.calendar_events(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection ON public.calendar_events(connection_id);

-- Index for customer meetings (frequently queried)
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_meetings
    ON public.calendar_events(account_id, start_time)
    WHERE is_customer_meeting = true;

-- RLS Policies
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Calendar connections: Users can only see their own connections
CREATE POLICY "Users can view own calendar connections"
    ON public.calendar_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar connections"
    ON public.calendar_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connections"
    ON public.calendar_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connections"
    ON public.calendar_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Calendar events: Users can see events from their account
-- (Uses account membership check via accounts schema)
CREATE POLICY "Account members can view calendar events"
    ON public.calendar_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts.account_user au
            WHERE au.account_id = calendar_events.account_id
            AND au.user_id = auth.uid()
        )
    );

-- Only the owner of the connection can insert/update/delete events
CREATE POLICY "Connection owners can manage calendar events"
    ON public.calendar_events FOR ALL
    USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_connections_updated_at
    BEFORE UPDATE ON public.calendar_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_events_updated_at
    BEFORE UPDATE ON public.calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.calendar_connections IS 'User calendar OAuth connections for Meeting Intelligence (Pro plan)';
COMMENT ON TABLE public.calendar_events IS 'Synced calendar events from connected calendars';
COMMENT ON COLUMN public.calendar_events.is_customer_meeting IS 'AI-classified: true if external attendees detected';
COMMENT ON COLUMN public.calendar_events.matched_person_ids IS 'Links to People records matched from attendee emails';
