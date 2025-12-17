-- Update legacy task clusters to new default categories
update public.tasks
set cluster = case cluster
  when 'Core product – capture & workflow' then 'Product'
  when 'Core product – intelligence' then 'Product'
  when 'Foundation – reliability & UX' then 'Usability'
  when 'Monetization & pricing' then 'Sales'
  when 'Engagement & analytics' then 'Engagement'
  when 'Acquisition & marketing' then 'Acquisition'
  else cluster
end
where cluster in (
  'Core product – capture & workflow',
  'Core product – intelligence',
  'Foundation – reliability & UX',
  'Monetization & pricing',
  'Engagement & analytics',
  'Acquisition & marketing'
);

-- Normalize any remaining or null clusters to "Other"
update public.tasks
set cluster = 'Other'
where cluster is null
   or cluster not in (
     'Product',
     'Usability',
     'Value',
     'Engagement',
     'Acquisition',
     'Sales',
     'Support',
     'Trust & Risk',
     'Ops & Scale',
     'Other'
   );
