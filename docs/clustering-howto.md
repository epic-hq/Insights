# Feature Goal: Insight Clustering Visualization

Using this approach [umap hdscan](https://pair-code.github.io/understanding-umap/)  vs t-SNE

Current embedding is based on: insights name + pain

## Implemented here:`supabase/schemas/50_queues.sql`

- trigger: `trg_enqueue_insight`
- function: `enqueue_insight_embedding`
- edge function: `supabase/functions/embed/index.ts`

## Front End

- `routes/_NavLayout.insights-map.tsx`
- `routes/_NavLayout.insights/index.tsx`

## TODO

- [ ] integrate insight map to /insights
- [ ] store insights cluster in db table `insights_clusters`
- [ ] automatically update `insights_clusters` when new insights are added or updated (trigger on insert/update any row in project)
- [ ] understand hdscan ouput and terms, what is noise, how to work with cluster data.
