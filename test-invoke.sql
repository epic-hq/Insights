-- Test calling the edge function directly via invoke_edge_function
SELECT public.invoke_edge_function(
  'embed-person-facet',
  json_build_object(
    'person_id', '3f3d602f-aa2d-43c6-9439-81032c80fb37',
    'facet_account_id', 4,
    'label', 'Test Label',
    'kind_slug', 'test'
  )::jsonb
);

-- Check if embedding was written
SELECT embedding IS NOT NULL as has_embedding
FROM person_facet
WHERE person_id = '3f3d602f-aa2d-43c6-9439-81032c80fb37'
  AND facet_account_id = 4;
