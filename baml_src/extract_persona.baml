class PersonaDemographics {
  // Example: { "age_range": "25-34", "gender_distribution": { "female": 60, "male": 40 }, "locations": ["San Francisco", "New York"] }
  age_range string | null @description("Most common age range for this persona, e.g. '25-34'")
  gender_distribution map<string, int> | null @description("Distribution of gender for this persona, e.g. { 'female': 60, 'male': 40 }")
  locations string[] | null @description("Most common locations for this persona")
  education_levels string[] | null @description("Most common education levels")
  occupations string[] | null @description("Most common occupations")
  other_demographics string | null @description("Other notable demographic patterns")
}

class PersonaInsightSummary {
  name string @description("Short summary of the insight")
  details string | null @description("Details or context for the insight")
}

class PersonaSummary {
	personaName string @description("Persona name: up to 3 words")
	personaDescription string @description("Describes the persona, based on the people records and insights. Captures the essence of behavior, pain, motivations and preferences.")
  demographics PersonaDemographics @description("Aggregated demographic data for this persona")
  summarized_insights PersonaInsightSummary[] @description("List of key insights for this persona")
}

function ExtractPersona(people: string, insights: string) -> PersonaSummary {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher. Given the following people records and their insights, generate a summary for this persona.

    1. Create a UX persona that represents the people records and insights.
		 that captures the essence of behavior, pain, motivations and preferences.
		 up to 3 words for a catchy name, and 3 to 7 sentencees for a description.
    2. Aggregate and summarize common demographics (age range, gender distribution, locations, education, occupations, other patterns).
    3. List the most important insights for this persona, each with a short summary and details.

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}