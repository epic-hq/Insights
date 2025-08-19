alter table "public"."annotations" 	drop constraint "annotations_entity_type_check";
alter table "public"."annotations" add constraint "annotations_entity_type_check" CHECK ((entity_type = ANY (ARRAY['insight'::text, 'persona'::text, 'opportunity'::text, 'interview'::text, 'person'::text, 'project'::text]))) not valid;
