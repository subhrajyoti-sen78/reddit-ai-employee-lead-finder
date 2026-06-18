# Reddit Dashboard Project Context

## Current Objective

Build only the tool/prototype part of the marketing assignment, not the user's final submission.
The tool should help prove a distribution system that can drive 1,000 targeted visitors and
15 qualified inbound leads in 30 days for custom AI employees.

## Chosen Distribution System

Name: Reddit Pain-to-AI Employee Lead Finder.

Core loop:
1. Find real Reddit posts where business owners describe repetitive workflow pain.
2. Paste one or many posts into the dashboard.
3. Classify the pain and map it to an AI employee.
4. Generate a helpful audit and a manually reviewed Reddit reply draft.
5. Track qualified prospects in a local dataset.
6. Use exports, screenshots, and a Loom walkthrough as proof assets.

## User Responsibilities

The user collects real Reddit examples, records the presentation/Loom, explains the strategy,
and submits the final assignment.

## Tool Responsibilities

The dashboard handles collection workflow, classification, reply drafts, lead scoring,
projection modeling, evidence exports, and AI-assisted strategy support.

## Safety Rules

- Do not auto-post to Reddit.
- Do not bulk-submit comments.
- Do not impersonate users or create fake engagement.
- Human-review every generated reply.
- Keep replies useful first, with a CTA only when relevant.
- Keep Google AI Studio API keys server-side.
- Store project memory locally unless the user explicitly chooses deployment.

## Current Tech Choice

Keep the dashboard local-first. Use plain HTML, CSS, and JavaScript for the UI. Add a local Node
server only for Google AI Studio/Gemini calls and local RAG persistence.
