// Generate a concise, descriptive title from content

function GenerateTitleFromContent(
  content: string
) -> string {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    Generate a concise, descriptive title (2-5 words) for this content.

    RULES:
    - Title should capture the main topic or theme
    - Use 2-5 words maximum
    - Use title case
    - Do NOT use generic titles like "Interview", "Recording", "Conversation", or "Notes"
    - Do NOT include quotes, punctuation, or formatting
    - If content is unclear or empty, respond with "Untitled"

    {{ _.role("user") }}
    Content:
    {{ content }}

    {{ _.role("assistant") }}
  "#
}
