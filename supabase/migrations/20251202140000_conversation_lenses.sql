-- =====================================================================
-- Conversation Lenses Migration
-- =====================================================================
-- Migrates from sales-specific lens structure to generic template-based
-- conversation analysis system. Supports multiple frameworks: Customer
-- Discovery, User Testing, Sales (BANT/MEDDIC), Empathy Map, JTBD, etc.
--
-- Strategy:
-- - Preserve existing sales_lens_* tables (no data loss)
-- - Create new generic lens infrastructure
-- - Future migration will migrate sales lens data to new structure
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Conversation Lens Templates Table
-- ─────────────────────────────────────────────────────────────────────
-- Stores reusable lens/template definitions that can be applied to
-- interviews. Each template defines the analytical framework with
-- sections and fields.

CREATE TABLE IF NOT EXISTS public.conversation_lens_templates (
    -- Unique key for the template (e.g., 'customer-discovery', 'user-testing')
    template_key text PRIMARY KEY,

    -- Display name (e.g., 'Customer Discovery', 'User Testing')
    template_name text NOT NULL,

    -- One-line description of the lens purpose
    summary text,

    -- Primary objective of this analysis framework
    primary_objective text,

    -- JSONB template definition with structure:
    -- {
    --   "sections": [
    --     {
    --       "section_key": "problem_validation",
    --       "section_name": "Problem Validation",
    --       "fields": [
    --         {
    --           "field_key": "problem_statement",
    --           "field_name": "Problem Statement",
    --           "field_type": "text|text_array|numeric|date|boolean",
    --           "description": "What problem is the user trying to solve?",
    --           "required": true
    --         }
    --       ]
    --     }
    --   ],
    --   "entities": ["stakeholders", "objections", "features_mentioned"],
    --   "recommendations_enabled": true
    -- }
    template_definition jsonb NOT NULL,

    -- Whether this template is active/available for selection
    is_active boolean DEFAULT true,

    -- Optional category for grouping (e.g., 'research', 'sales', 'product')
    category text,

    -- Display order in UI
    display_order integer DEFAULT 100,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_lens_templates_active_idx
    ON public.conversation_lens_templates(is_active, display_order)
    WHERE is_active = true;

CREATE INDEX conversation_lens_templates_category_idx
    ON public.conversation_lens_templates(category)
    WHERE category IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Conversation Lens Analyses Table
-- ─────────────────────────────────────────────────────────────────────
-- Stores the actual analysis results when a lens is applied to an
-- interview. Multiple lenses can be applied to the same interview.

CREATE TABLE IF NOT EXISTS public.conversation_lens_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core references
    interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    template_key text NOT NULL REFERENCES public.conversation_lens_templates(template_key) ON DELETE RESTRICT,
    account_id uuid NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Analysis data stored as JSONB with structure:
    -- {
    --   "sections": [
    --     {
    --       "section_key": "problem_validation",
    --       "fields": [
    --         {
    --           "field_key": "problem_statement",
    --           "value": "Users struggle with manual data entry",
    --           "confidence": 0.85,
    --           "evidence_ids": ["uuid1", "uuid2"],
    --           "anchors": [{"type": "media", "start_ms": 45000, "end_ms": 67000}]
    --         }
    --       ]
    --     }
    --   ],
    --   "entities": {
    --     "stakeholders": [...],
    --     "objections": [...],
    --     "features_mentioned": [...]
    --   },
    --   "recommendations": [
    --     {
    --       "type": "next_step",
    --       "description": "Follow up on pricing concerns",
    --       "priority": "high",
    --       "owner_person_id": "uuid",
    --       "evidence_ids": ["uuid"]
    --     }
    --   ]
    -- }
    analysis_data jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Overall confidence score for the entire analysis (0.0-1.0)
    confidence_score float CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Whether this lens was auto-detected vs manually selected
    auto_detected boolean DEFAULT false,

    -- User's stated goals/objectives for the interview (used for recommendations)
    user_goals text[],

    -- ICP (Ideal Customer Profile) context for tailored recommendations
    icp_context jsonb,

    -- Custom instructions provided by user for this specific analysis
    custom_instructions text,

    -- Processing metadata
    processed_at timestamptz,
    processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Status tracking
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Each interview can have one analysis per template
CREATE UNIQUE INDEX conversation_lens_analyses_interview_template_unique
    ON public.conversation_lens_analyses(interview_id, template_key);

CREATE INDEX conversation_lens_analyses_interview_idx
    ON public.conversation_lens_analyses(interview_id);

CREATE INDEX conversation_lens_analyses_template_idx
    ON public.conversation_lens_analyses(template_key);

CREATE INDEX conversation_lens_analyses_project_idx
    ON public.conversation_lens_analyses(project_id, template_key);

CREATE INDEX conversation_lens_analyses_account_idx
    ON public.conversation_lens_analyses(account_id);

CREATE INDEX conversation_lens_analyses_status_idx
    ON public.conversation_lens_analyses(status)
    WHERE status IN ('pending', 'processing');

-- ─────────────────────────────────────────────────────────────────────
-- 3. Triggers
-- ─────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_conversation_lens_templates_timestamp
    BEFORE INSERT OR UPDATE ON public.conversation_lens_templates
    FOR EACH ROW EXECUTE PROCEDURE accounts.trigger_set_timestamps();

CREATE TRIGGER set_conversation_lens_analyses_timestamp
    BEFORE INSERT OR UPDATE ON public.conversation_lens_analyses
    FOR EACH ROW EXECUTE PROCEDURE accounts.trigger_set_timestamps();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.conversation_lens_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_lens_analyses ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users
CREATE POLICY "Anyone can read active lens templates"
    ON public.conversation_lens_templates
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only service role can manage templates
CREATE POLICY "Service role can manage lens templates"
    ON public.conversation_lens_templates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Account members can manage their analyses
CREATE POLICY "Account members can read lens analyses"
    ON public.conversation_lens_analyses
    FOR SELECT
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can insert lens analyses"
    ON public.conversation_lens_analyses
    FOR INSERT
    TO authenticated
    WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can update lens analyses"
    ON public.conversation_lens_analyses
    FOR UPDATE
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()))
    WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Account members can delete lens analyses"
    ON public.conversation_lens_analyses
    FOR DELETE
    TO authenticated
    USING (account_id IN (SELECT accounts.get_accounts_with_role()));

-- ─────────────────────────────────────────────────────────────────────
-- 5. Grants
-- ─────────────────────────────────────────────────────────────────────

GRANT SELECT ON TABLE public.conversation_lens_templates TO authenticated, service_role;
GRANT ALL ON TABLE public.conversation_lens_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversation_lens_analyses TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Seed Initial Templates
-- ─────────────────────────────────────────────────────────────────────

-- Customer Discovery Template
INSERT INTO public.conversation_lens_templates (
    template_key,
    template_name,
    summary,
    primary_objective,
    category,
    display_order,
    template_definition
) VALUES (
    'customer-discovery',
    'Customer Discovery',
    'Validate problem-solution fit and gather insights for product development',
    'Understand customer problems, validate hypotheses, and identify opportunities',
    'research',
    10,
    '{
        "sections": [
            {
                "section_key": "problem_validation",
                "section_name": "Problem Validation",
                "fields": [
                    {
                        "field_key": "problem_statement",
                        "field_name": "Primary Problem",
                        "field_type": "text",
                        "description": "What is the main problem the customer is experiencing?"
                    },
                    {
                        "field_key": "problem_frequency",
                        "field_name": "Problem Frequency",
                        "field_type": "text",
                        "description": "How often does this problem occur?"
                    },
                    {
                        "field_key": "current_solutions",
                        "field_name": "Current Solutions",
                        "field_type": "text_array",
                        "description": "What are they currently doing to solve this problem?"
                    },
                    {
                        "field_key": "pain_severity",
                        "field_name": "Pain Severity",
                        "field_type": "text",
                        "description": "How severe is this problem for them? (scale or description)"
                    }
                ]
            },
            {
                "section_key": "solution_validation",
                "section_name": "Solution Validation",
                "fields": [
                    {
                        "field_key": "proposed_solution_reaction",
                        "field_name": "Solution Reaction",
                        "field_type": "text",
                        "description": "How did they react to the proposed solution?"
                    },
                    {
                        "field_key": "value_proposition_resonance",
                        "field_name": "Value Prop Resonance",
                        "field_type": "text",
                        "description": "Which parts of the value proposition resonated most?"
                    },
                    {
                        "field_key": "concerns_objections",
                        "field_name": "Concerns/Objections",
                        "field_type": "text_array",
                        "description": "What concerns or objections did they raise?"
                    }
                ]
            },
            {
                "section_key": "market_insights",
                "section_name": "Market Insights",
                "fields": [
                    {
                        "field_key": "competitive_alternatives",
                        "field_name": "Competitive Alternatives",
                        "field_type": "text_array",
                        "description": "What other solutions have they considered or tried?"
                    },
                    {
                        "field_key": "switching_costs",
                        "field_name": "Switching Costs",
                        "field_type": "text",
                        "description": "What barriers exist to switching solutions?"
                    },
                    {
                        "field_key": "willingness_to_pay",
                        "field_name": "Willingness to Pay",
                        "field_type": "text",
                        "description": "Indicators of pricing expectations or budget"
                    }
                ]
            }
        ],
        "entities": ["stakeholders", "objections"],
        "recommendations_enabled": true
    }'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- User Testing Template
INSERT INTO public.conversation_lens_templates (
    template_key,
    template_name,
    summary,
    primary_objective,
    category,
    display_order,
    template_definition
) VALUES (
    'user-testing',
    'User Testing',
    'Evaluate usability, identify friction points, and gather feature feedback',
    'Assess product usability and user experience quality',
    'product',
    20,
    '{
        "sections": [
            {
                "section_key": "usability",
                "section_name": "Usability",
                "fields": [
                    {
                        "field_key": "task_completion",
                        "field_name": "Task Completion",
                        "field_type": "text",
                        "description": "Were users able to complete key tasks successfully?"
                    },
                    {
                        "field_key": "friction_points",
                        "field_name": "Friction Points",
                        "field_type": "text_array",
                        "description": "Where did users struggle or get confused?"
                    },
                    {
                        "field_key": "unexpected_behaviors",
                        "field_name": "Unexpected Behaviors",
                        "field_type": "text_array",
                        "description": "What did users do that was unexpected?"
                    }
                ]
            },
            {
                "section_key": "feature_feedback",
                "section_name": "Feature Feedback",
                "fields": [
                    {
                        "field_key": "features_used",
                        "field_name": "Features Used",
                        "field_type": "text_array",
                        "description": "Which features did users interact with?"
                    },
                    {
                        "field_key": "features_requested",
                        "field_name": "Features Requested",
                        "field_type": "text_array",
                        "description": "What features did users ask for?"
                    },
                    {
                        "field_key": "feature_clarity",
                        "field_name": "Feature Clarity",
                        "field_type": "text",
                        "description": "Did users understand what features do?"
                    }
                ]
            },
            {
                "section_key": "satisfaction",
                "section_name": "Satisfaction",
                "fields": [
                    {
                        "field_key": "overall_impression",
                        "field_name": "Overall Impression",
                        "field_type": "text",
                        "description": "What was the user''s overall impression?"
                    },
                    {
                        "field_key": "comparison_to_expectations",
                        "field_name": "vs. Expectations",
                        "field_type": "text",
                        "description": "How did the experience compare to expectations?"
                    },
                    {
                        "field_key": "likelihood_to_recommend",
                        "field_name": "Likelihood to Recommend",
                        "field_type": "text",
                        "description": "Would they recommend this to others?"
                    }
                ]
            }
        ],
        "entities": ["stakeholders"],
        "recommendations_enabled": true
    }'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Sales BANT Template
INSERT INTO public.conversation_lens_templates (
    template_key,
    template_name,
    summary,
    primary_objective,
    category,
    display_order,
    template_definition
) VALUES (
    'sales-bant',
    'Sales BANT',
    'Qualify opportunities using Budget, Authority, Need, and Timeline',
    'Qualify sales opportunities and assess deal viability',
    'sales',
    30,
    '{
        "sections": [
            {
                "section_key": "bant",
                "section_name": "BANT Qualification",
                "fields": [
                    {
                        "field_key": "budget",
                        "field_name": "Budget",
                        "field_type": "text",
                        "description": "What budget is available? Any constraints or approval needed?"
                    },
                    {
                        "field_key": "authority",
                        "field_name": "Authority",
                        "field_type": "text",
                        "description": "Who is the decision maker? What is their role in purchasing?"
                    },
                    {
                        "field_key": "need",
                        "field_name": "Need",
                        "field_type": "text",
                        "description": "What is the business need or pain point driving this?"
                    },
                    {
                        "field_key": "timeline",
                        "field_name": "Timeline",
                        "field_type": "text",
                        "description": "When do they need a solution? Any critical dates?"
                    }
                ]
            },
            {
                "section_key": "opportunity",
                "section_name": "Opportunity Assessment",
                "fields": [
                    {
                        "field_key": "deal_size",
                        "field_name": "Potential Deal Size",
                        "field_type": "text",
                        "description": "Estimated value of the opportunity"
                    },
                    {
                        "field_key": "competition",
                        "field_name": "Competition",
                        "field_type": "text_array",
                        "description": "Who else are they considering?"
                    },
                    {
                        "field_key": "success_criteria",
                        "field_name": "Success Criteria",
                        "field_type": "text",
                        "description": "How will they measure success?"
                    }
                ]
            },
            {
                "section_key": "next_steps",
                "section_name": "Next Steps",
                "fields": [
                    {
                        "field_key": "agreed_next_steps",
                        "field_name": "Agreed Next Steps",
                        "field_type": "text_array",
                        "description": "What actions were agreed upon?"
                    },
                    {
                        "field_key": "blockers",
                        "field_name": "Blockers/Risks",
                        "field_type": "text_array",
                        "description": "What could prevent this deal from closing?"
                    }
                ]
            }
        ],
        "entities": ["stakeholders", "objections"],
        "recommendations_enabled": true
    }'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- Empathy Map / JTBD Template
INSERT INTO public.conversation_lens_templates (
    template_key,
    template_name,
    summary,
    primary_objective,
    category,
    display_order,
    template_definition
) VALUES (
    'empathy-map-jtbd',
    'Empathy Map / JTBD',
    'Understand user motivations, jobs-to-be-done, and emotional drivers',
    'Map user perspective and identify underlying motivations',
    'research',
    40,
    '{
        "sections": [
            {
                "section_key": "empathy_map",
                "section_name": "Empathy Map",
                "fields": [
                    {
                        "field_key": "says",
                        "field_name": "Says",
                        "field_type": "text_array",
                        "description": "Direct quotes and explicit statements"
                    },
                    {
                        "field_key": "thinks",
                        "field_name": "Thinks",
                        "field_type": "text_array",
                        "description": "What might they be thinking? (inferred)"
                    },
                    {
                        "field_key": "does",
                        "field_name": "Does",
                        "field_type": "text_array",
                        "description": "Actions and behaviors mentioned"
                    },
                    {
                        "field_key": "feels",
                        "field_name": "Feels",
                        "field_type": "text_array",
                        "description": "Emotional states and feelings expressed"
                    },
                    {
                        "field_key": "pains",
                        "field_name": "Pains",
                        "field_type": "text_array",
                        "description": "Frustrations, obstacles, and challenges"
                    },
                    {
                        "field_key": "gains",
                        "field_name": "Gains",
                        "field_type": "text_array",
                        "description": "Desired outcomes and benefits sought"
                    }
                ]
            },
            {
                "section_key": "jobs_to_be_done",
                "section_name": "Jobs to be Done",
                "fields": [
                    {
                        "field_key": "functional_jobs",
                        "field_name": "Functional Jobs",
                        "field_type": "text_array",
                        "description": "Practical tasks they need to accomplish"
                    },
                    {
                        "field_key": "social_jobs",
                        "field_name": "Social Jobs",
                        "field_type": "text_array",
                        "description": "How they want to be perceived by others"
                    },
                    {
                        "field_key": "emotional_jobs",
                        "field_name": "Emotional Jobs",
                        "field_type": "text_array",
                        "description": "How they want to feel"
                    }
                ]
            }
        ],
        "entities": ["stakeholders"],
        "recommendations_enabled": true
    }'::jsonb
) ON CONFLICT (template_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Migration Notes
-- ─────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.conversation_lens_templates IS
    'Reusable conversation analysis templates/frameworks. Defines the structure for analyzing interviews through different lenses (Customer Discovery, Sales, UX Testing, etc.)';

COMMENT ON TABLE public.conversation_lens_analyses IS
    'Applied lens analyses on interviews. Links interviews to templates and stores the extracted/analyzed data. Multiple lenses can be applied to the same interview.';

COMMENT ON COLUMN public.conversation_lens_analyses.analysis_data IS
    'JSONB containing the actual analysis results organized by sections and fields as defined in the template';

COMMENT ON COLUMN public.conversation_lens_analyses.auto_detected IS
    'True if this lens was automatically suggested by the system, false if manually selected by user';

COMMENT ON COLUMN public.conversation_lens_analyses.user_goals IS
    'Array of user-stated goals/objectives for this interview. Used to tailor recommendations.';

COMMENT ON COLUMN public.conversation_lens_analyses.icp_context IS
    'JSONB containing Ideal Customer Profile context (industry, company size, role, etc.) for personalized analysis';

-- =====================================================================
-- Future Migration Strategy
-- =====================================================================
-- The existing sales_lens_* tables will remain intact for now.
-- A future migration (20251202150000_migrate_sales_lens_data.sql) will:
--
-- 1. Migrate data from sales_lens_summaries to conversation_lens_analyses
--    - Map each sales framework (BANT, SPICED, MEDDIC, MAP) to appropriate template
--    - Transform sales_lens_slots into analysis_data JSONB sections
--    - Preserve stakeholders and hygiene data
--
-- 2. Update application code to use new lens structure
--    - Gradually phase out salesLens.server.ts
--    - Introduce lens application via BAML functions
--
-- 3. Eventually deprecate old sales_lens_* tables once migration is stable
-- =====================================================================
