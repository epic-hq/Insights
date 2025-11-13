# Agents Vision & Long-Term Signal

This file captures the north-star for automation work: where discovery experience should land once the `themes`/insights migration is fully trusted, and which context/architecture docs every agent should champion.

## 1. North-star vision
- A unified discovery fabric that traces Decision Questions → Research Questions → Prompts → Evidence → Themes. Agents should help maintain traceability so stakeholders can always jump from insights cards back to raw evidence without losing context (see `docs/_information_architecture.md`).
- AI helpers should treat every `insight` as a node in a graph: it has personas, tags, votes, LLM-assigned priority, and live evidence coverage metrics. Keeping this graph accurate unlocks future dashboards and recommendation engines.
- Operations should be self-healing: when new interviews or annotations land, the agents double-check that votes and persona links are reflected in `themes` so `fetchProjectStatusContext` stays consistent.

## 2. Long-term agent ideas
1. **Theme adoption coach** – watches how evidence coverage evolves, warns when themes drift from target personas, and suggests interviews or experiments.
2. **Decision Question concierge** – surfaces unanswered DQs (from `_information_architecture`) and enumerates evidence gaps, then routes follow-up prompts to researchers.
3. **Insights synthesis historian** – keeps a timeline of how priorities shifted, referencing `votes` and `priority` scores so teams can explain how opinions evolved.

## 3. Signal tracking for AI
- Push any new capability (like theme coverage dashboards) into `_task-board.md` and note it here once validated.
- Document new schema ambitions or manual SQL steps back in `docs/supabase-howto.md` so future agents understand why a manual migration exists.
- Mention deployment sequencing in `docs/deploy-howto.md` if you need to change views/functions or run manual scripts.
