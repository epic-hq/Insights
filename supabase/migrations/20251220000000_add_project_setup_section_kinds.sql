-- Add new section kinds for project setup flow
INSERT INTO project_section_kinds (id)
VALUES
  ('customer_problem'),
  ('offerings'),
  ('competitors')
ON CONFLICT (id) DO NOTHING;
