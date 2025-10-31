# Conversation Insights Quickstart

Use the built-in interview pipeline to analyse ad-hoc conversations—no separate workflow required.

## Capture options
- **Record Now** (Home page): spins up a quick project, records in real time, and pipes the call through the standard interview analysis.
- **Upload an interview**: visit `/interviews/upload` within a project to drop in an existing file.
- **Attach from a person profile**: hit "Attach Recording" on a person detail page to start the upload flow with that contact pre-selected.

## Automatic goal backfill
- During transcript processing, if the destination project has no `research_goal` section the system calls the BAML `AnalyzeStandaloneConversation` function.
- The generated overview is saved as the initial project goal, giving discovery teams an instant starting point.

## Output
- Transcripts, structured insights, and the auto-generated goal live on the interview just like any other recording.
- Key takeaways, open questions, and recommended follow-ups are available in the interview insights view.

## Tips
- Add participants to the project first so interview linkage (and downstream CRM workflows) stay accurate.
- Re-run Record Now on the same project to keep all related calls, insights, and goal refinements in one place.
