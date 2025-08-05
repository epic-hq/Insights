
# Process Interview Media & Extract Insights

## Ingestion & Storage

## Transcription

1. Submit media URL to AssemblyAI.
2. Poll for completion.
3. Store full transcript in `interview.transcript`.

## Insight Generation

1. Push a job to **pgmq** queue `transcribe` once the transcript is saved.
2. Worker (or Remix action for MVP) pulls transcript text.
3. Run **o3** + **BAML** to produce structured JSON: interview, insights, personas, people
4. Insert rows via `@supabase/supabase-js` with full type safety.

## Embeddings

Automatically created on change of `pain` field of `insights` table.

1. A database trigger (`trg_enqueue_insight`) runs on insert/update of `insights` table adds job to queue `insights_embedding_queue`
2. Cron worker pulls job from queue `insights_embedding_queue` every 1 minute and calls `invoke_edge_function` which gets SUPABASE_ANON_KEY from vault and calls edge function `supabase/functions/embed/index.ts`.
 **which anon key?**

3. embed uses OpenAI to generate embedding for `name` and `pain`. and inserts embedding into `insights.embedding` using the SUPABASE_SERVICE_ROLE_KEY.`
Result is stored in `insights.embedding`.

## TO VIEW INSIGHTS CLUSTERS

1. Display insights clusters in Recharts Cartesian plot.
2. Reduce dimensions to 2D. Use UMAP and DBSCAN to cluster insights by JTBD and Category. (t-SNE alternative)

* Scatter-plot in the UI → fetch `SELECT id, name, embedding FROM themes` and apply PCA/UMAP in client.

## User Notification

1. On success, notify with insight count and link to interview.
2. On failure, notify with error message.

## FUTURE

| Phase | Storage | Key Steps |
|-------|---------|-----------|
| **1 – MVP** | Google Drive links | 1. User pastes a Drive URL.<br>2. Convert the link to a direct-download URL (per AssemblyAI guide). ** Note we had issues, Google did not return clean download links, instead had virus scan html etc. files too large. So we are doing local file upload. Temp storage on AAI who then deletes it. for now. TODO: upgrade to store in r2. |
| **2 – Prod** | Supabase R2 (S3-compatible) | 1. Client requests a presigned upload URL via Edge Function (JWT-authenticated).<br>2. Client uploads media directly to R2.<br>3. Edge Function inserts a `media_files` row with metadata.<br>4. Client requests short-lived signed download URLs the same way. |
