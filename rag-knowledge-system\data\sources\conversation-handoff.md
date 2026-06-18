# Conversation Handoff

## Final Direction

Build only the tool/prototype for the assignment. The user will present and submit the final
assignment. The tool supports the strategy, evidence, workflow, and demo assets.

## Tool Built

The Reddit AI Employee Audit Tool is a local-first dashboard that:

- Processes one or many Reddit pain posts.
- Classifies pain and maps it to an AI employee.
- Scores lead quality.
- Uses Google AI Studio/Gemini to analyze demand factors.
- Generates post-specific, manually reviewed reply drafts.
- Provides forecast, pain mix, lead queue, RAG search, and AI Strategy Coach.
- Exports CSV/report proof assets.

## Important Safety Decisions

- Do not implement Reddit auto-posting.
- Do not bulk-submit comments.
- Do not expose Google API keys in browser code.
- Keep GitHub repo private.
- Use only vetted libraries; avoid random GitHub repos/templates.

## Current Status

- Local app: working at `http://127.0.0.1:5178`.
- Google AI Studio/Gemini: configured locally and tested.
- RAG memory: working locally.
- GitHub: private repo pushed at `https://github.com/subhrajyoti-sen78/reddit-ai-audit-tool`.
- Vercel: not deployed. The token authenticates with the Vercel API, but the account reports `limited: true` and lacks permission to create a project.

## Next Needful Action

Verify/unlimit the Vercel account or use an Owner/Admin token with project creation permission, then deploy the `reddit-ai-audit-tool` folder with server-side `GOOGLE_AI_API_KEY` and `GEMINI_MODEL` environment variables.

Manual import link:

`https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsubhrajyoti-sen78%2Freddit-ai-audit-tool&project-name=reddit-ai-audit-tool&repository-name=reddit-ai-audit-tool&env=GOOGLE_AI_API_KEY,GEMINI_MODEL`
