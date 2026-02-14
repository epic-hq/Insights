// Infer job_function and seniority_level from a person's title

enum JobFunction {
  Engineering @description("Software engineering, development, DevOps, SRE, QA")
  Product @description("Product management, product owner, product design")
  Design @description("UX/UI design, graphic design, creative")
  Sales @description("Sales, account executive, business development")
  Marketing @description("Marketing, growth, demand gen, content")
  CustomerSuccess @description("Customer success, support, account management")
  Operations @description("Operations, RevOps, BizOps, procurement")
  Finance @description("Finance, accounting, FP&A")
  HR @description("Human resources, people ops, recruiting, talent")
  Legal @description("Legal, compliance, contracts")
  Executive @description("CEO, founder, general management")
  Data @description("Data science, analytics, BI, data engineering")
  IT @description("IT, infrastructure, systems admin")
  Research @description("User research, market research, insights")
  Other @description("Does not fit other categories")
}

enum SeniorityLevel {
  CLevel @description("CEO, CTO, CFO, CMO, CRO, COO, Chief")
  VP @description("VP, Vice President, SVP, EVP")
  Director @description("Director, Senior Director, Head of")
  Manager @description("Manager, Senior Manager, Team Lead")
  Senior @description("Senior individual contributor, Staff, Principal")
  IC @description("Individual contributor, Associate, Analyst, Junior")
  Intern @description("Intern, Trainee, Apprentice")
  Unknown @description("Cannot determine seniority from title")
}

class PersonSegmentInput {
  title string | null @description("Job title like 'VP of Engineering' or 'Senior Product Manager'")
  role string | null @description("DEPRECATED: No longer populated. Will always be null. Kept for schema compatibility.")
  company string | null @description("Company name for additional context")
}

class InferredPersonSegments {
  job_function JobFunction @description("Primary job function inferred from title")
  seniority_level SeniorityLevel @description("Seniority level inferred from title")
  confidence float @description("0-1 confidence in the inference, lower if title is ambiguous")
}

function InferPersonSegments(input: PersonSegmentInput) -> InferredPersonSegments {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    You are a job title classifier. Given a person's title, infer their:
    1. Job function (Engineering, Product, Sales, Marketing, etc.)
    2. Seniority level (C-Level, VP, Director, Manager, Senior IC, IC, etc.)

    Rules:
    - Use the title as the primary signal, role as backup context
    - "Head of X" typically maps to Director level
    - "Lead" without manager typically maps to Senior IC
    - Founders/Co-founders map to Executive function and C-Level seniority
    - When uncertain, use the closest match with lower confidence

    {{ _.role("user") }}
    Classify this person:
    Title: {{ input.title or "(none)" }}
    Role: {{ input.role or "(none)" }}
    Company: {{ input.company or "(unknown)" }}

    Respond with {{ ctx.output_format }}.
  "#
}
