# Reddit AI Employee Audit Tool

Prototype tool for the assignment. It is **not** the final submission.

Goal: find Reddit pain conversations, analyze demand with Gemini, create AI Employee audits, draft helpful manual-review replies, and track the path to **1,000 visitors + 15 qualified leads**.

## What It Does

- Processes one post or many posts at once
- Accepts multiple URLs, subreddits, headings, and descriptions
- Classifies pain and recommends an AI employee
- Scores lead quality
- Uses Gemini for post-specific demand analysis and reply drafts
- Analyzes factors across records: urgency, buyer intent, objections, subreddit fit, and reply angle
- Shows forecast, pain mix, lead queue, RAG search, and AI Strategy Coach
- Exports CSV/report proof assets

## My Job vs Your Job

My job:

- Build the prototype
- Give the strategy and workflow
- Keep it useful, demo-ready, and safe

Your job:

- Collect real Reddit examples
- Record Loom/video and screenshots
- Explain the strategy in your own words
- Submit the final assignment

## Open The Tool

Static mode:

```text
Open index.html
```

AI + RAG mode:

1. Add this to `.env` in this folder or the parent folder:

```text
GOOGLE_AI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
REDDIT_DASHBOARD_PORT=5178
```

2. Start the local server:

```bash
node server.js
```

3. Open:

```text
http://127.0.0.1:5178
```

## Strategy To Present

Name: **Reddit Pain-to-AI Employee Lead Finder**

One-liner:

> A system that detects live business pain conversations on Reddit, converts them into personalized AI Employee audits, and turns high-intent readers into qualified inbound leads.

Say: “I built a pain-intent detection and personalized audit system with human-reviewed outreach.”

Do not say: “I will spam Reddit.”

## How To Use

1. Choose a keyword and subreddit.
2. Click **Open Search**.
3. Find real business pain posts.
4. Paste multiple URLs, subreddits, headings, and descriptions into batch mode.
5. Click **Generate Tailored Drafts**.
6. Review each draft in **Comment Review Feed**.
7. Use **Gemini Refine** for a stronger selected audit.
8. Use **Analyze Factors** to rank demand, urgency, objections, subreddit fit, and reply angle.
9. Ask **AI Strategy Coach** what to prioritize.
10. Export CSV/report for proof.

## Traffic Model

| Metric | Target |
|---|---:|
| Helpful replies | 150 |
| Avg views/reply | 50 |
| Reply impressions | 7,500 |
| CTR | 8% |
| Visitors from replies | 600 |
| Search/old-thread visitors | 400 |
| Total visitors | 1,000 |
| Form conversion | 2% |
| Leads | 20 |
| Qualified rate | 75% |
| Qualified leads | 15 |

## Lead Score

| Signal | Points |
|---|---:|
| Website present | 2 |
| Team size 3+ | 2 |
| Manual work 5+ hrs/week | 3 |
| Manual work 12+ hrs/week | 1 |
| Wants automation this month | 4 |
| Wants automation soon | 2 |
| Mentions CRM/helpdesk/tools | 2 |
| Urgent pain language | 3 |

## AI Employee Mapping

| Pain | AI Employee |
|---|---|
| Support tickets / FAQs | AI Support Agent |
| Leads / follow-up / CRM | AI SDR |
| Hiring / screening | AI Recruiter |
| Research / reports | AI Research Assistant |
| Admin / repetitive workflow | AI Workflow Automator |

## RAG Memory

Local memory lives in:

```text
../rag-knowledge-system/data/sources/
```

It stores project context, roadmap, vetted library notes, saved records, AI coach exchanges, and handoff notes.

## Safety Rules

- Do not auto-post to Reddit.
- Do not bulk-submit comments.
- Do not use fake accounts.
- Human-review every reply.
- Keep replies useful first.
- Use a CTA only when relevant.
- Keep API keys server-side.

## Upgrade Stack

Use only if needed:

- Apache ECharts, D3, Three.js, deck.gl, Motion, TensorFlow.js, ONNX Runtime Web

Avoid random GitHub templates and direct GitHub dependency installs.

## Sources

- Reddit audience insights: https://www.business.reddit.com/audience-insights
- Reddit Pro Trends: https://support.reddithelp.com/hc/en-us/articles/47619216411284-Reddit-Pro-Feature-Trends
- Reddit rules: https://redditinc.com/policies/reddit-rules
