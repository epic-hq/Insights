# Mobile-first user experience

## With AAI

what you can build with AssemblyAI to stream audio, detect topic changes, and generate live chapters and insights:

Real-Time Streaming Transcription
– Capture system or mic audio via WebSocket and receive incremental “turn” events with both interim and formatted final transcripts.
AssemblyAI

– Use parameters like format_turns=true for cleaner, punctuated segments as they happen.

Automatic Chaptering (Post-Processing)
– For any full transcript, enable auto_chapters=true to get back time-stamped chapters, each with a headline, one-line gist, and full summary.
AssemblyAI

– Ideal for indexing podcasts, lectures, or recorded calls.

LLM-Driven Segmentation & Analysis (LeMUR)
– Stream or batch transcript text into LeMUR to split conversations into custom phases (e.g., “Intro,” “Problem,” “Solution”).
AssemblyAI
+1
AssemblyAI
+1

– You can even feed in sliding windows of transcript during a live session for near-real-time topic detection.

On-Demand Summarization
– Toggle summarization=true to generate bullets, paragraphs, headlines, or “gist” summaries of your audio.
AssemblyAI

– Note: Summarization and Auto Chapters are mutually exclusive in one request.

Audio Intelligence Models
– Entity Detection for people, orgs, dates, SSNs, etc.
AssemblyAI

– Speaker Diarization & Name Identification via LeMUR or dedicated endpoints
– Sentiment Analysis, Content Moderation, Keyword/Highlight Extraction, Language Detection, and more.

How to piece it together?

Step 1: Spin up the Streaming STT WebSocket to grab real-time “turns”.

Step 2: Buffer transcript chunks (e.g., every 30–60 s) and either:

Call the Auto Chapters or Summarization API on that window, or

Send it to LeMUR with a prompt to detect topic shifts and emit chapter metadata.

Step 3: Render chapters live in your UI, update as new segments arrive, and layer on entity/sentiment tags for deep analysis.

Opinionated take:

If you need ultra-fast, low-latency chapter updates, lean on LeMUR with a sliding-window approach—define your own “topics” and get JSON back in seconds.

If you prefer off-the-shelf chapters with minimal fuss, batch the final transcript into auto_chapters after the session ends.

For executive summaries or action-item extraction, combine summarization=true with LeMUR for a two-step “summarize-then-refine” workflow.
