insert into public.project_section_kinds (id) values
  ('goal'), ('questions'), ('findings'), ('background'), ('target_market'), ('risks'), ('methodology'), ('assumptions'), ('recommendations'), ('unknowns'), ('custom_instructions'),('target_roles'),('target_orgs'),('research_goal'),('research_goal_details'),('decision_questions'),('research_questions'),('interview_prompts'),('settings')
  on conflict (id) do nothing;
