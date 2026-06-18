# Architecture And Roadmap

## Folder Architecture

- `reddit-ai-audit-tool/`: user-facing dashboard.
- `reddit-ai-audit-tool/server.js`: local-only API for Gemini and RAG.
- `reddit-ai-audit-tool/app.js`: browser logic, batch processing, AI coach, analytics.
- `reddit-ai-audit-tool/style.css`: dashboard UI.
- `rag-knowledge-system/data/sources/`: local project memory and source notes.
- `rag-knowledge-system/data/indexes/`: future generated indexes.
- `rag-knowledge-system/src/retrieval/`: local search utilities.
- `rag-knowledge-system/src/memory/`: append-only project memory store.
- `rag-knowledge-system/skills/`: project-level skill notes if needed.

## Roadmap

1. Local RAG foundation: store project decisions, library recommendations, and dashboard records.
2. Gemini inside dashboard: ask a strategy coach and refine selected Reddit audits.
3. Visual intelligence: add local forecast/funnel/category views without extra dependencies.
4. Optional chart upgrade: add Apache ECharts through npm once the static analytics need more power.
5. Optional deployable mode: run the same server on a host with environment variables and rate limits.

## Assumptions

- The user wants local-only by default.
- Only Google AI Studio/Gemini API is allowed for AI generation.
- The dashboard should not directly post to Reddit.
- Security matters more than automation speed.
- The current static dashboard should be enhanced, not replaced by a large framework migration yet.
