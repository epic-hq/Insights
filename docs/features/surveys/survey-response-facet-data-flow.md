# Survey Response to Person Intelligence Data Flow

## JTBD and outcome
- JTBD: As a research/GTM operator, I need survey answers to become reusable person intelligence so I can score ICP fit and find the right people without manually normalizing fields.
- Outcome: A completed survey response now writes canonical records that support both:
  - semantic retrieval (`evidence_facet` with `kind_slug=survey_response`)
  - structured segmentation/ICP (`people` fields + `person_facet`)

## End-to-end flow

```mermaid
flowchart TD
    A["Respondent submits survey"] --> B["POST /api/research-links/:slug/save"]
    B --> C["research_link_responses.responses JSONB persisted"]
    B --> D{"completed=true?"}
    D -- No --> C
    D -- Yes --> E["findOrCreatePerson(email)"]
    E --> F["link research_link_responses.person_id"]
    D -- Yes --> G["applySurveyResponsesToPersonProfile"]
    G --> G1["Extract canonical attrs by taxonomyKey/personFieldKey\nor prompt inference"]
    G1 --> G2["Update people columns\n(title, job_function, seniority_level, role)"]
    G2 --> G3["Sync person_facet\n(job_function, seniority_level, job_title)"]
    G1 --> G4["Upsert extra person_facet\n(industry_vertical, team_size, company_stage, etc.)"]
    D -- Yes --> H["emitSurveyQuestionEvidenceAndFacets"]
    H --> H1["Create evidence row per answered question"]
    H1 --> H2["Link evidence_people (role=respondent)"]
    H2 --> H3["Ensure facet_account per survey question\n(kind=survey_response)"]
    H3 --> H4["Insert evidence_facet\n(kind_slug=survey_response,\nlabel=question, quote=answer,\nperson_id set when identified)"]
    G4 --> I["Person intelligence graph"]
    H4 --> I
    I --> J["Semantic search + theme pipelines\n(use evidence_facet)"]
    I --> K["ICP scoring + segmenting\n(use people + person_facet)"]
```

## How downstream systems use this
- Semantic/facet retrieval: reads `evidence_facet` (question/answer-level, embedded) to cluster/search survey statements.
- ICP scoring: reads `people` (title/job_function/etc.), org fields, and `person_facet` for target facet matching.
- People views/timelines: can consume both canonical profile facets and per-response Q/A facets.

## Notes
- `survey_response` facet kind uses per-question `facet_account` entries (question label as facet label).
- `quote` stores normalized answer text (including select/likert values) so all question types become searchable.
- For anonymous responses, `person_id` remains null on survey facets; identified responses attach `person_id`.
