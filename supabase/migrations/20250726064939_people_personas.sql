

-- Persona-Insights junction table (which insights inform which personas)

-- People-Personas junction table (link people to personas)
CREATE TABLE IF NOT EXISTS people_personas (
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    interview_id UUID REFERENCES interviews(id) ON DELETE SET NULL,
    project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
    confidence_score REAL DEFAULT 1.0,
    source TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (person_id, persona_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_people_personas_person_id ON people_personas(person_id);
CREATE INDEX IF NOT EXISTS idx_people_personas_persona_id ON people_personas(persona_id);
CREATE INDEX IF NOT EXISTS idx_people_personas_project_id ON people_personas(project_id);

-- Enable RLS
ALTER TABLE people_personas ENABLE ROW LEVEL SECURITY;

-- RLS policies for people_personas
CREATE POLICY "Users can view people_personas for their account" ON people_personas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM people pe
            WHERE pe.id = people_personas.person_id
            AND pe.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can modify people_personas for their account" ON people_personas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM people pe
            WHERE pe.id = people_personas.person_id
            AND pe.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    ) WITH CHECK (true);

CREATE POLICY "Users can delete people_personas for their account" ON people_personas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM people p
            WHERE p.id = people_personas.person_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- Add indexes for performance

-- Add RLS policies for all junction tables

-- RLS policies for insight_tags

-- RLS policies for interview_tags

-- RLS policies for opportunity_insights
-- RLS policies for project_people
-- RLS policies for persona_insights
-- RLS policies for people_personas
