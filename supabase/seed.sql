-- Sample seed data for AI Learning App research project
-- Uses fixed UUIDs so front-end can reference deterministically

-- 1. Organizations ------------------------------------------------------------
insert into public.organizations (id, name)
values
  ('00000000-0000-0000-0000-000000000001', 'StudySmart Inc.');

-- 2. Research Projects ---------------------------------------------------------
insert into public.research_projects (id, org_id, code, title, description)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'STUDY-AI-2025', 'AI Learning App Student Study Habits', 'Qualitative research interviews with students to understand study patterns when using AI-assisted learning.');

-- 3. Interviews ---------------------------------------------------------------
insert into public.interviews (id, org_id, project_id, title, interview_date, participant_pseudonym, segment, duration_min, status)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – Freshman CS Major', '2025-06-10', '"Alex"', 'Undergraduate', 45, 'transcribed'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – Working Adult MBA', '2025-06-11', '"Jamie"', 'Graduate', 50, 'transcribed'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Interview – High-School Senior', '2025-06-12', '"Taylor"', 'High School', 40, 'transcribed');

-- 4. Transcripts (simplified) --------------------------------------------------
insert into public.transcripts (id, org_id, interview_id, text)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Full transcript text for Alex'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Full transcript text for Jamie'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Full transcript text for Taylor');

-- 5. Themes --------------------------------------------------------------------
insert into public.themes (id, org_id, name, category, color_hex)
values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Time-Management', 'Behavior', '#3b82f6'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Motivation', 'Behavior', '#10b981'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Distraction', 'Pain-Point', '#f59e0b');

-- 6. Personas ------------------------------------------------------------------
insert into public.personas (id, org_id, name, description, percentage, color_hex)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Focused Planner', 'Students who allocate study blocks and follow schedules', 0.35, '#2563EB'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Last-Minute Crammer', 'Students who study primarily right before deadlines', 0.4, '#E11D48'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Steady Improver', 'Students who review material incrementally each day', 0.25, '#14B8A6');

-- 7. Insights ------------------------------------------------------------------
insert into public.insights (id, org_id, interview_id, name, category, journey_stage, impact, novelty, jtbd, motivation, pain, desired_outcome, confidence, created_at)
values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Need micro-goals', 'Engagement', 'During Study', 4, 3, 'Break big assignments into bite-sized tasks', 'Wants sense of progress', 'Feels overwhelmed by long modules', 'See steady progress bar', 'high', now()),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Prefers audio summaries', 'Accessibility', 'Pre-Study', 3, 4, 'Review material on commute', 'Limited time', 'Reading long articles on phone is hard', 'Get concise audio overview', 'medium', now()),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'AI reminders reduce cramming', 'Retention', 'Post Study', 5, 4, 'Receive prompts before forgetting', 'Wants better grades', 'Tends to procrastinate', 'Automated spaced-repetition nudges', 'high', now());

-- 8. Comments ------------------------------------------------------------------
-- First, create a function to safely add comments with error handling
CREATE OR REPLACE FUNCTION safe_insert_comment(
  p_id uuid,
  p_org_id uuid,
  p_insight_id uuid,
  p_user_id uuid,
  p_content text,
  p_created_at timestamptz
) RETURNS void AS $$
BEGIN
  -- Only insert if the user exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    INSERT INTO public.comments (id, org_id, insight_id, user_id, content, created_at)
    VALUES (p_id, p_org_id, p_insight_id, p_user_id, p_content, p_created_at)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get a valid user ID from auth.users if available, or use NULL
DO $$
DECLARE
  valid_user_id uuid;
BEGIN
  -- Try to get a valid user ID from auth.users
  SELECT id INTO valid_user_id FROM auth.users LIMIT 1;
  
  -- Insert comments using the valid user ID if available, otherwise use NULL
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    valid_user_id,
    'This insight about micro-goals aligns with our previous research on student motivation. We should consider adding a progress visualization feature.',
    now() - interval '2 days'
  );
  
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    valid_user_id,
    'We tested a similar approach last quarter but with daily goals instead of task-based ones. The completion rate was 15% higher with task-based goals.',
    now() - interval '1 day'
  );
  
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    valid_user_id,
    'Audio summaries could be a game-changer for accessibility. We should explore text-to-speech integration options.',
    now() - interval '3 hours'
  );
  
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',
    valid_user_id,
    'The AI reminder feature shows great potential. Lets consider A/B testing different notification frequencies to find the optimal balance.',
    now() - interval '1 hour'
  );
  
  PERFORM safe_insert_comment(
    '60000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',
    valid_user_id,
    'We should check if this aligns with our existing spaced repetition algorithm or if we need to modify it.',
    now() - interval '30 minutes'
  );
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS safe_insert_comment(uuid, uuid, uuid, uuid, text, timestamptz);

-- 9. Quotes --------------------------------------------------------------------
insert into public.quotes (id, org_id, insight_id, quote, timestamp_sec)
values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'I lose track when a lesson drags on for 30 minutes straight.', 120),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'Listening to a summary on the bus would save me so much time.', 85),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'The AI nudges keep me from forgetting the content before exams.', 200);

-- 9. Tags ----------------------------------------------------------------------
insert into public.tags (tag, description)
values
  ('Time-Management', 'Managing study time effectively'),
  ('Motivation', 'Staying motivated to learn'),
  ('Accessibility', 'Making learning content easier to consume');

-- 10. Insight Tags -------------------------------------------------------------
insert into public.insight_tags (insight_id, tag)
values
  ('60000000-0000-0000-0000-000000000001', 'Time-Management'),
  ('60000000-0000-0000-0000-000000000002', 'Accessibility'),
  ('60000000-0000-0000-0000-000000000003', 'Motivation');

-- 11. Opportunities ------------------------------------------------------------
insert into public.opportunities (id, org_id, title, owner_id, kanban_status, related_insight_ids)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Micro-Goal Feature', null, 'Explore', ARRAY['60000000-0000-0000-0000-000000000001'::uuid]),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Audio Summary Mode', null, 'Validate', ARRAY['60000000-0000-0000-0000-000000000002'::uuid]),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Spaced-Repetition Reminders', null, 'Build', ARRAY['60000000-0000-0000-0000-000000000003'::uuid]);
