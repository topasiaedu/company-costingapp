# OpenAI Usage Ingest API — Guide for Developers

Connect your app to the Company Costing app so OpenAI token usage shows up under the **AI Usage** tab (estimated tokens and cost by `appId`).

You do **not** need this repo. You only need to `POST` after each OpenAI response.

---

## Live URLs

| What | URL |
|------|-----|
| App | https://company-costingapp.vercel.app/ |
| Ingest endpoint | `POST` https://company-costingapp.vercel.app/api/openai-usage |
| Swagger UI | https://company-costingapp.vercel.app/api-docs |
| OpenAPI spec | https://company-costingapp.vercel.app/openapi.yaml |

**Local testing:** `http://localhost:3000` (or `3001` if 3000 is taken) — same path: `/api/openai-usage`.

---

## When to call

After each successful OpenAI API response, read `usage` from the response and POST once.

- Fire-and-forget is fine (do not block your user flow on this call).
- On retry, **reuse the same `requestId`** so duplicates are rejected (`409`) instead of double-counting.

---

## Auth

**v1: no API key required.**

If the server later sets `INGEST_SECRET`, you must send a matching header:

```http
X-Ingest-Secret: <shared-secret>
```

Otherwise the API returns `401`. Plan for this header so enabling the secret later does not break your client.

**Do not** put Supabase service role keys (or any server secrets) in client apps. This ingest URL is the only write path you need.

---

## Request body

`Content-Type: application/json`

### Required fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `appId` | string (min 1) | Stable app identifier | `"cae-gpt"` |
| `model` | string (min 1) | Model from the OpenAI response | `"gpt-4o-mini"` |
| `promptTokens` | integer ≥ 0 | `usage.prompt_tokens` | `1200` |
| `completionTokens` | integer ≥ 0 | `usage.completion_tokens` | `340` |
| `totalTokens` | integer ≥ 0 | `usage.total_tokens` | `1540` |
| `occurredAt` | string (ISO 8601 datetime) | When the OpenAI call happened | `"2026-07-10T09:15:00Z"` |

### Optional fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `appName` | string | Human-readable label in dashboards | `"CAE GPT Assistant"` |
| `requestId` | string (min 1) | Idempotency key; reuse on retries | `"550e8400-e29b-41d4-a716-446655440000"` |
| `feature` | string | Feature label for breakdowns | `"summarize-report"` |

### Do not send

- **`estimatedCostUsd`** — computed server-side from the model pricing table. Unknown models are stored with cost `0`.
- Any other fields — only the Zod schema fields above are accepted.

### `totalTokens` rule

`totalTokens` must equal `promptTokens + completionTokens` within **2** tokens. If within that margin but not exact, the server coerces `totalTokens` to the sum. Larger mismatches return `400`.

### `appId` convention

- Use **lowercase kebab-case**: `cae-gpt`, `beacon-social-media`.
- **You choose** the string — there is no registry in v1.
- Keep it **stable**. Renaming or typos create a **new** “app” in charts. Fix bad rows yourself if you typo.

---

## Example payloads

**Minimal (required only):**

```json
{
  "appId": "beacon-social-media",
  "model": "gpt-4o",
  "promptTokens": 500,
  "completionTokens": 120,
  "totalTokens": 620,
  "occurredAt": "2026-07-10T12:00:00Z"
}
```

**Full (recommended):**

```json
{
  "appId": "cae-gpt",
  "appName": "CAE GPT Assistant",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "model": "gpt-4o-mini",
  "promptTokens": 1200,
  "completionTokens": 340,
  "totalTokens": 1540,
  "feature": "summarize-report",
  "occurredAt": "2026-07-10T09:15:00Z"
}
```

---

## curl (production)

```bash
curl -X POST "https://company-costingapp.vercel.app/api/openai-usage" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "cae-gpt",
    "appName": "CAE GPT Assistant",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "model": "gpt-4o-mini",
    "promptTokens": 1200,
    "completionTokens": 340,
    "totalTokens": 1540,
    "feature": "summarize-report",
    "occurredAt": "2026-07-10T09:15:00Z"
  }'
```

If `INGEST_SECRET` is enabled on the server, add:

```bash
  -H "X-Ingest-Secret: your-shared-ingest-secret" \
```

---

## TypeScript / fetch

```typescript
const USAGE_INGEST_URL = "https://company-costingapp.vercel.app/api/openai-usage";

/**
 * Report one OpenAI call's token usage. Fire-and-forget is OK.
 * Reuse the same requestId when retrying.
 */
async function reportOpenAiUsage(params: {
  appId: string;
  appName?: string;
  requestId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  feature?: string;
  occurredAt?: string;
  ingestSecret?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (params.ingestSecret) {
    headers["X-Ingest-Secret"] = params.ingestSecret;
  }

  const response = await fetch(USAGE_INGEST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: params.appId,
      appName: params.appName,
      requestId: params.requestId,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      feature: params.feature,
      occurredAt: params.occurredAt ?? new Date().toISOString(),
    }),
  });

  // 409 = already recorded for this requestId — treat as success on retry
  if (response.status === 409) {
    return;
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    console.error("[openai-usage] ingest failed", response.status, body);
  }
}

// After an OpenAI chat completion:
const requestId = crypto.randomUUID();
const usage = response.usage;

void reportOpenAiUsage({
  appId: "cae-gpt",
  appName: "CAE GPT",
  requestId,
  model: response.model,
  promptTokens: usage?.prompt_tokens ?? 0,
  completionTokens: usage?.completion_tokens ?? 0,
  totalTokens: usage?.total_tokens ?? 0,
  feature: "chat",
});
```

Local: point `USAGE_INGEST_URL` at `http://localhost:3000/api/openai-usage` (or port `3001`).

---

## Responses

| Status | Meaning |
|--------|---------|
| `201` | Created. Body: `{ id, estimatedCostUsd, appId, model }` |
| `400` | Invalid JSON or Zod validation failure (`error`, optional `details`) |
| `401` | Missing/invalid `X-Ingest-Secret` when `INGEST_SECRET` is set |
| `409` | Duplicate `requestId` — safe to ignore on retry |
| `500` | Database or server error |

**201 example:**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "estimatedCostUsd": 0.000384,
  "appId": "cae-gpt",
  "model": "gpt-4o-mini"
}
```

---

## What shows up in the costing app

- Open the Company Costing app → **AI Usage** tab.
- Charts and tables group by **`appId`** (tokens and estimated USD cost).
- A typo in `appId` appears as a separate app — correct future posts and clean bad data yourself if needed.

---

## Checklist

1. Pick a stable `appId` (kebab-case) and stick to it.
2. After each OpenAI response, POST tokens + `model` + `occurredAt`.
3. Prefer a `requestId` (UUID) and reuse it on retries.
4. Do not send cost; do not invent extra body fields.
5. Optionally support `X-Ingest-Secret` for when the server enables it.
6. Confirm events under **AI Usage** at https://company-costingapp.vercel.app/
