insert into public.project_section_kinds (id)
values ('goal'),('questions'),('findings'),('background')
on conflict (id) do nothing;
