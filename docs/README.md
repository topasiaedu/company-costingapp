# Documentation

| Doc | Purpose |
|-----|---------|
| [01-project-overview.md](./01-project-overview.md) | Start here — stack, architecture, schema, tabs |
| [03-supabase-mcp.md](./03-supabase-mcp.md) | Cursor Supabase MCP setup and troubleshooting |
| [04-decisions-and-accomplishments.md](./04-decisions-and-accomplishments.md) | **Source of truth** — business rules, data corrections, what was built |
| [05-pnl-month-view-plan.md](./05-pnl-month-view-plan.md) | Month view feature spec and manual testing checklist |
| [06-subscriptions-upgrade-plan.md](./06-subscriptions-upgrade-plan.md) | Subscriptions page upgrade — problem, UX spec, data model, test checklist |
| [07-subscriptions-upgrade-agent-prompts.md](./07-subscriptions-upgrade-agent-prompts.md) | Copy-paste agent prompts (5 tasks) for implementing the subscriptions upgrade |
| [08-nextjs-openai-usage-plan.md](./08-nextjs-openai-usage-plan.md) | Next.js migration + OpenAI token usage per app — architecture, stats, API contract, checklist |
| [09-nextjs-openai-usage-agent-prompts.md](./09-nextjs-openai-usage-agent-prompts.md) | Copy-paste agent prompts (5 tasks) for Next migration, ingest API, AI Usage page, Swagger |
| [10-openai-usage-api-guide-for-devs.md](./10-openai-usage-api-guide-for-devs.md) | **For other app developers** — how to POST OpenAI usage to the ingest API (fields, auth, curl/TS examples) |

## API documentation

Interactive Swagger UI for the OpenAI usage ingest contract: **[`/api-docs`](/api-docs)** (when the app is running).

- Developer guide: [10-openai-usage-api-guide-for-devs.md](./10-openai-usage-api-guide-for-devs.md) — production URLs, payload, auth, examples.
- OpenAPI spec: [`public/openapi.yaml`](../public/openapi.yaml) — documents `POST /api/openai-usage` for internal apps posting token usage after each OpenAI call.
