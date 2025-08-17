-- Add new project section kinds for onboarding and research structure
insert into public.project_section_kinds (id) values 
  ('target_market'), 
  ('risks'), 
  ('methodology'), 
  ('assumptions'), 
  ('recommendations')
on conflict (id) do nothing;