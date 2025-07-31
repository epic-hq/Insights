class Persona {
  // Demographics
  name string @description("Persona name: up to 3 words")
  description string | null @description("Persona Archetype description: 3-7 sentences summarizing behavior, pain, motivations, and preferences")
  age string | null @description("Most common age or age range, e.g. '25-34'")
  gender string | null @description("Most common gender for this persona")
  location string | null @description("Most common location(s) for this persona")
  education string | null @description("Most common education level(s)")
  occupation string | null @description("Most common occupation(s)")
  income string | null @description("Most common income range or level")
  languages string | null @description("Most common languages spoken")
  segment string | null @description("Segment or group this persona belongs to")
  role string | null @description("Role or job title")
  color_hex string | null @description("Hex color for persona visualization")
  image_url string | null @description("URL to persona avatar/profile image")

  // Psychographics
  motivations string[] | null @description("Key motivations for this persona")
  values string[] | null @description("Core values for this persona")
  frustrations string[] | null @description("Top frustrations or pain points")
  preferences string | null @description("Notable preferences")
  learning_style string | null @description("Preferred learning style")
  tech_comfort_level string | null @description("Comfort level with technology")

  // Behavior
  frequency_of_purchase string | null @description("How often this persona purchases relevant products/services")
  frequency_of_use string | null @description("How often this persona uses relevant products/services")
  key_tasks string[] | null @description("Key tasks this persona performs")
  tools_used string[] | null @description("Tools or products commonly used by this persona")
  primary_goal string | null @description("Primary goal for this persona")
  secondary_goals string[] | null @description("Secondary goals for this persona")
  sources string[] | null @description("Main sources of information or influence")
  quotes string[] | null @description("Representative quotes from this persona")
  percentage float | null @description("Estimated percentage of users represented by this persona")
}

function ExtractPersona(people: string, insights: string, interviews: string) -> Persona {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher. Given the following people records and their insights, generate a detailed persona profile.

    1. Create a UX persona that represents the people records and insights.
       - Use up to 3 words for a catchy name.
       - Write a 3-7 sentence description summarizing behavior, pain, motivations, and preferences.
    2. For each of the following fields, aggregate and summarize the most common or representative value(s) from the data:
       - age, gender, location, education, occupation, income, languages, segment, role, color_hex, image_url
       - motivations, values, frustrations, preferences, learning_style, tech_comfort_level
       - frequency_of_purchase, frequency_of_use, key_tasks, tools_used, primary_goal, secondary_goals, sources, quotes, percentage
    3. For array fields, provide 2-5 representative items. For string fields, provide the most common or relevant value.
    4. Use direct quotes from the data where possible for the 'quotes' field.
    5. If a field is not present in the data, return null.

		Interview records:
		{{ interviews }}

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}

test ExtractPersona_Sample {
  functions [ExtractPersona]
  args {
    people #"""
[
  {
    "name": "Alice",
    "age": 29,
    "gender": "female",
    "location": "San Francisco",
    "education": "Bachelor's",
    "occupation": "Product Manager"
		makign 200k plus for years now
  },
  {
    "name": "Bob",
    "age": 32,
    "gender": "male",
    "location": "New York",
    "education": "Master's",
    "occupation": "designs menus for sushi restaurants"
		hates to eat raw fish
		earns 100k
		lives in a penthouse

  }
]
"""#
    insights #"""
[
  {
    "summary": "Struggles with onboarding",
    "details": "Both Alice and Bob found the onboarding process confusing and time-consuming."
  },
  {
    "summary": "Values collaboration",
    "details": "They prefer tools that make it easy to share progress and feedback with teammates."
  }
]
"""#
  }
}
