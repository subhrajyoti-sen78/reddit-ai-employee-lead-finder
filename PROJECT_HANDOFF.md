# Project Handoff

## What This Is

This is the tool/prototype part of the assignment, not the final submission.

It helps prove this growth system:

> Find Reddit business pain, analyze demand, generate AI Employee audits, write helpful manual-review replies, and convert interested readers into qualified leads.

## Done

- Batch Reddit post processor
- Single post audit flow
- Lead score model
- Forecast model for 1,000 visitors / 15 qualified leads
- Comment review feed
- CSV and report export
- Local RAG memory
- Gemini AI Strategy Coach
- Gemini post-specific demand analysis
- Gemini factor analysis across records
- Private GitHub push

## Safety

- No Reddit auto-posting
- No bulk comment submission
- No fake engagement
- Human review required
- API keys stay server-side
- `.env` is ignored

## Current Links

Local dashboard:

```text
http://127.0.0.1:5178
```

Private GitHub repo:

```text
https://github.com/subhrajyoti-sen78/reddit-ai-audit-tool
```

## Remaining Blocker

Vercel deployment is blocked by token permissions.

The token can authenticate with the Vercel API, but Vercel rejected project creation:

```text
You don't have permission to create the project.
```

The Vercel account currently reports `limited: true`, so this cannot be fixed from code.

Manual import link:

```text
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsubhrajyoti-sen78%2Freddit-ai-audit-tool&project-name=reddit-ai-audit-tool&repository-name=reddit-ai-audit-tool&env=GOOGLE_AI_API_KEY,GEMINI_MODEL
```

Needed token/env after account permission is fixed:

```text
VERCEL_TOKEN=token_with_project_create_permission
```

Deploy with server-side:

```text
GOOGLE_AI_API_KEY
GEMINI_MODEL
```

Required Vercel account fix:

1. Verify the Vercel email/account.
2. Ensure the account or team can create projects.
3. If using a team, use an Owner/Admin token.
4. Recreate the token after permissions are corrected.
