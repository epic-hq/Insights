-- Create people_personas junction table for many-to-many relationships
-- This allows one person to have multiple personas across different interviews/projects

-- Ensure dependent view is removed before schema changes
DROP VIEW IF EXISTS persona_distribution;

-- Remove the simple persona_id column from people table (denormalize)
ALTER TABLE people DROP COLUMN IF EXISTS persona_id;

-- Create junction table for people-persona relationships
CREATE TABLE people_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    
    -- Context fields - which interview/project this persona assignment applies to
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Metadata for tracking and AI confidence
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    source TEXT CHECK (source IN ('manual', 'ai_assigned', 'interview_derived')) DEFAULT 'ai_assigned',
    notes TEXT,
    
    -- Business constraints
    -- Allow multiple personas per person, but only one persona per person per interview
    UNIQUE(person_id, interview_id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_people_personas_person_id ON people_personas(person_id);
CREATE INDEX idx_people_personas_persona_id ON people_personas(persona_id);
CREATE INDEX idx_people_personas_interview_id ON people_personas(interview_id);
CREATE INDEX idx_people_personas_project_id ON people_personas(project_id);
CREATE INDEX idx_people_personas_account_id ON people_personas(account_id);

-- RLS policies for account isolation
ALTER TABLE people_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_personas_account_isolation" ON people_personas
    FOR ALL USING (account_id = (auth.jwt() ->> 'sub')::uuid);

-- Grant permissions
GRANT ALL ON people_personas TO authenticated;
GRANT ALL ON people_personas TO service_role;

-- Add helpful comments
COMMENT ON TABLE people_personas IS 'Junction table linking people to personas with interview/project context';
COMMENT ON COLUMN people_personas.confidence_score IS 'AI confidence score for persona assignment (0.00-1.00)';
COMMENT ON COLUMN people_personas.source IS 'How this persona was assigned: manual, ai_assigned, or interview_derived';
COMMENT ON COLUMN people_personas.interview_id IS 'Specific interview where this persona applies';
COMMENT ON COLUMN people_personas.project_id IS 'Project context for this persona assignment';
