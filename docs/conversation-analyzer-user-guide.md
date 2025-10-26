# Conversation Analyzer User Guide

The Conversation Analyzer turns any uploaded meeting recording into a structured sales summary.

## When to use it
- Rapidly understand ad-hoc calls that sit outside a formal project.
- Capture stakeholder goals and objections before entering data into a CRM.
- Identify open questions and recommended next steps for follow-up emails or MAPs.

## How it works
1. Navigate to **Home → Conversation Analyzer**.
2. Upload an audio or video file (MP3, WAV, MP4, WEBM, etc.).
3. Optionally add a meeting title, attendee list, and analyst notes. These hints feed the model context and show up in the UI.
4. Submit. The task uploads the file, queues a Trigger.dev run, transcribes the recording, and calls the BAML `AnalyzeStandaloneConversation` function.
5. Refresh happens automatically every few seconds. Once complete you’ll see:
   - Executive summary
   - Questions asked (with speaker attribution and evidence)
   - Participant goals
   - Key takeaways with supporting snippets
   - Recommended next steps and open questions

## Interpreting the output
- Confidence values are normalised to 0–1. Low confidence suggests manual review.
- Evidence snippets link back to the transcript text saved in Supabase for auditing.
- “Recommended next steps” can be copied directly into follow-up emails or MAP tasks.

## Managing results
- Recent analyses appear in the right-hand column. Selecting one loads the details panel.
- Failed jobs surface the error returned by transcription or the model. Re-upload after fixing the source file if needed.
- Sales teams can jump directly into CRM hygiene by launching a **Sales Workspace** from the Home page.
