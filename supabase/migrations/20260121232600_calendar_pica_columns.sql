/**
 * Add Pica AuthKit columns to calendar_connections
 *
 * Pica manages OAuth tokens via their Passthrough API, so we store
 * connection_id and connection_key instead of raw tokens.
 */

-- Add Pica-specific columns
ALTER TABLE public.calendar_connections
ADD COLUMN IF NOT EXISTS pica_connection_id TEXT,
ADD COLUMN IF NOT EXISTS pica_connection_key TEXT;

-- Make OAuth token columns nullable since Pica manages tokens
ALTER TABLE public.calendar_connections
ALTER COLUMN access_token DROP NOT NULL;

-- Add index for Pica connection lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_pica
    ON public.calendar_connections(pica_connection_id)
    WHERE pica_connection_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.calendar_connections.pica_connection_id IS 'Pica AuthKit connection ID';
COMMENT ON COLUMN public.calendar_connections.pica_connection_key IS 'Pica connection key for Passthrough API calls';
