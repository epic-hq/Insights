// Tests for GenerateContextualSuggestions

test GenerateContextualSuggestions_DecisionQuestions_SaaS {
  functions [GenerateContextualSuggestions]
  args {
    research_goal "Increase trial-to-paid conversion for a B2B SaaS analytics product"
    current_input "Users drop off after connecting their first data source"
    suggestion_type "decision_questions"
    existing_items ["What blocks teams from completing setup?", "Which roles influence purchase?"]
    project_context "SMB teams evaluating analytics tools; 14-day trials; self-serve onboarding"
  }
}

test GenerateContextualSuggestions_Roles_Healthcare {
  functions [GenerateContextualSuggestions]
  args {
    research_goal "Improve patient intake and follow‑up in outpatient clinics"
    current_input "Confusion around discharge instructions and next steps"
    suggestion_type "roles"
    existing_items ["Front-desk staff", "Primary-care physicians"]
    project_context "Regional nonprofit hospital network; 6 clinics; chronic care programs for diabetes and hypertension"
  }
}

