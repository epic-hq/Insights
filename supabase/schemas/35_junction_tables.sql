-- Junction tables for many-to-many relationships
-- These tables improve data normalization and enable better querying

-- Insight-Tags junction table (replaces related_tags array in insights)
CREATE TABLE IF NOT EXISTS insight_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Ensure unique insight-tag pairs per account
    UNIQUE(insight_id, tag_id, account_id)
);

-- Interview-Tags junction table (tag interviews directly)
CREATE TABLE IF NOT EXISTS interview_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Ensure unique interview-tag pairs per account
    UNIQUE(interview_id, tag_id, account_id)
);

-- Opportunity-Insights junction table (replaces related_insight_ids array)
CREATE TABLE IF NOT EXISTS opportunity_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
    weight DECIMAL(3,2) DEFAULT 1.0, -- How strongly this insight supports the opportunity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Ensure unique opportunity-insight pairs
    UNIQUE(opportunity_id, insight_id)
);

-- Project-People junction table (track people across projects)
CREATE TABLE IF NOT EXISTS project_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role TEXT, -- e.g., 'primary_user', 'stakeholder', 'expert'
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    interview_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),

    -- Ensure unique project-person pairs
    UNIQUE(project_id, person_id)
);

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
            SELECT 1 FROM people pe
            WHERE pe.id = people_personas.person_id
            AND pe.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE TABLE IF NOT EXISTS persona_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2) DEFAULT 1.0, -- How relevant this insight is to the persona
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Ensure unique persona-insight pairs
    UNIQUE(persona_id, insight_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_insight_tags_insight_id ON insight_tags(insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_tags_tag_id ON insight_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_insight_tags_account_id ON insight_tags(account_id);

CREATE INDEX IF NOT EXISTS idx_interview_tags_interview_id ON interview_tags(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_tags_tag_id ON interview_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_interview_tags_account_id ON interview_tags(account_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_insights_opportunity_id ON opportunity_insights(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_insights_insight_id ON opportunity_insights(insight_id);

CREATE INDEX IF NOT EXISTS idx_project_people_project_id ON project_people(project_id);
CREATE INDEX IF NOT EXISTS idx_project_people_person_id ON project_people(person_id);

CREATE INDEX IF NOT EXISTS idx_persona_insights_persona_id ON persona_insights(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_insights_insight_id ON persona_insights(insight_id);

-- Add RLS policies for all junction tables
ALTER TABLE insight_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for insight_tags
CREATE POLICY "Users can view insight_tags for their account" ON insight_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM insights i
            WHERE i.id = insight_tags.insight_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert insight_tags for their account" ON insight_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM insights i
            WHERE i.id = insight_tags.insight_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update insight_tags for their account" ON insight_tags
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM insights i
            WHERE i.id = insight_tags.insight_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete insight_tags for their account" ON insight_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM insights i
            WHERE i.id = insight_tags.insight_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- RLS policies for interview_tags
CREATE POLICY "Users can view interview_tags for their account" ON interview_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM interviews i
            WHERE i.id = interview_tags.interview_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert interview_tags for their account" ON interview_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM interviews i
            WHERE i.id = interview_tags.interview_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update interview_tags for their account" ON interview_tags
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM interviews i
            WHERE i.id = interview_tags.interview_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete interview_tags for their account" ON interview_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM interviews i
            WHERE i.id = interview_tags.interview_id
            AND i.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- RLS policies for opportunity_insights
CREATE POLICY "Users can view opportunity_insights for their account" ON opportunity_insights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM opportunities o
            WHERE o.id = opportunity_insights.opportunity_id
            AND o.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert opportunity_insights for their account" ON opportunity_insights
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM opportunities o
            WHERE o.id = opportunity_insights.opportunity_id
            AND o.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update opportunity_insights for their account" ON opportunity_insights
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM opportunities o
            WHERE o.id = opportunity_insights.opportunity_id
            AND o.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete opportunity_insights for their account" ON opportunity_insights
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM opportunities o
            WHERE o.id = opportunity_insights.opportunity_id
            AND o.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- RLS policies for project_people
CREATE POLICY "Users can view project_people for their account" ON project_people
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_people.project_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert project_people for their account" ON project_people
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_people.project_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update project_people for their account" ON project_people
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_people.project_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete project_people for their account" ON project_people
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_people.project_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

-- RLS policies for persona_insights
CREATE POLICY "Users can view persona_insights for their account" ON persona_insights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM personas p
            WHERE p.id = persona_insights.persona_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert persona_insights for their account" ON persona_insights
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM personas p
            WHERE p.id = persona_insights.persona_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update persona_insights for their account" ON persona_insights
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM personas p
            WHERE p.id = persona_insights.persona_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete persona_insights for their account" ON persona_insights
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM personas p
            WHERE p.id = persona_insights.persona_id
            AND p.account_id IN (
                SELECT account_id FROM accounts.account_user
                WHERE user_id = auth.uid()
            )
        )
    );
