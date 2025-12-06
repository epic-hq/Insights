-- Fix sales-bant template:
-- 1. Remove redundant "next_steps" section (entity extraction provides richer structured data)
-- 2. Add "next_steps" to entities array to explicitly enable next_steps entity extraction
-- 3. Move "blockers" into opportunity section as it's deal-related info

update public.conversation_lens_templates
set template_definition = '{
  "sections": [
    {
      "section_key": "bant",
      "section_name": "BANT Qualification",
      "fields": [
        {"field_key": "budget", "field_name": "Budget", "field_type": "text"},
        {"field_key": "authority", "field_name": "Authority", "field_type": "text"},
        {"field_key": "need", "field_name": "Need", "field_type": "text"},
        {"field_key": "timeline", "field_name": "Timeline", "field_type": "text"}
      ]
    },
    {
      "section_key": "opportunity",
      "section_name": "Opportunity Assessment",
      "fields": [
        {"field_key": "deal_size", "field_name": "Potential Deal Size", "field_type": "text"},
        {"field_key": "competition", "field_name": "Competition", "field_type": "text_array"},
        {"field_key": "success_criteria", "field_name": "Success Criteria", "field_type": "text"},
        {"field_key": "blockers", "field_name": "Blockers/Risks", "field_type": "text_array"}
      ]
    }
  ],
  "entities": ["stakeholders", "next_steps", "objections"],
  "recommendations_enabled": true
}'::jsonb
where template_key = 'sales-bant';
