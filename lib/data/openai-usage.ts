import { createClient } from "@/lib/supabase/client";

/** Period totals from `get_openai_usage_summary` RPC. */
export interface OpenAiUsageTotals {
  total_tokens: number;
  total_cost_usd: number;
  request_count: number;
  avg_tokens_per_request: number;
}

/** Per-app breakdown row from summary RPC. */
export interface OpenAiUsageByApp {
  app_id: string;
  app_name: string;
  tokens: number;
  cost_usd: number;
  request_count: number;
  pct_of_total: number;
}

/** Per-model breakdown row from summary RPC. */
export interface OpenAiUsageByModel {
  model: string;
  tokens: number;
  cost_usd: number;
}

/** Daily trend point from summary RPC. */
export interface OpenAiUsageDailyTrend {
  date: string;
  tokens: number;
  cost_usd: number;
}

/** Full summary payload returned by `get_openai_usage_summary`. */
export interface OpenAiUsageSummary {
  totals: OpenAiUsageTotals;
  by_app: OpenAiUsageByApp[];
  by_model: OpenAiUsageByModel[];
  daily_trend: OpenAiUsageDailyTrend[];
  previous_period: OpenAiUsageTotals;
}

/** Recent event row from `get_openai_usage_events` RPC. */
export interface OpenAiUsageEventRow {
  id: string;
  app_id: string;
  app_name: string | null;
  request_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  feature: string | null;
  occurred_at: string;
  estimated_cost_usd: number;
  price_snapshot: string | null;
  ingested_at: string;
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseTotals(raw: Record<string, unknown> | null | undefined): OpenAiUsageTotals {
  const source = raw ?? {};
  return {
    total_tokens: parseNumber(source.total_tokens),
    total_cost_usd: parseNumber(source.total_cost_usd),
    request_count: parseNumber(source.request_count),
    avg_tokens_per_request: parseNumber(source.avg_tokens_per_request),
  };
}

function parseByApp(raw: unknown): OpenAiUsageByApp[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      app_id: typeof row.app_id === "string" ? row.app_id : "",
      app_name: typeof row.app_name === "string" ? row.app_name : "",
      tokens: parseNumber(row.tokens),
      cost_usd: parseNumber(row.cost_usd),
      request_count: parseNumber(row.request_count),
      pct_of_total: parseNumber(row.pct_of_total),
    }))
    .filter((row) => row.app_id.length > 0);
}

function parseByModel(raw: unknown): OpenAiUsageByModel[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      model: typeof row.model === "string" ? row.model : "unknown",
      tokens: parseNumber(row.tokens),
      cost_usd: parseNumber(row.cost_usd),
    }));
}

function parseDailyTrend(raw: unknown): OpenAiUsageDailyTrend[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      date: typeof row.date === "string" ? row.date : "",
      tokens: parseNumber(row.tokens),
      cost_usd: parseNumber(row.cost_usd),
    }))
    .filter((row) => row.date.length > 0);
}

function parseSummary(raw: unknown): OpenAiUsageSummary | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const totalsRaw = typeof data.totals === "object" && data.totals !== null
    ? data.totals as Record<string, unknown>
    : undefined;
  const prevRaw = typeof data.previous_period === "object" && data.previous_period !== null
    ? data.previous_period as Record<string, unknown>
    : undefined;

  return {
    totals: parseTotals(totalsRaw),
    by_app: parseByApp(data.by_app),
    by_model: parseByModel(data.by_model),
    daily_trend: parseDailyTrend(data.daily_trend),
    previous_period: parseTotals(prevRaw),
  };
}

function parseEventRow(raw: Record<string, unknown>): OpenAiUsageEventRow | null {
  if (typeof raw.id !== "string" || typeof raw.app_id !== "string" || typeof raw.model !== "string") {
    return null;
  }

  return {
    id: raw.id,
    app_id: raw.app_id,
    app_name: typeof raw.app_name === "string" ? raw.app_name : null,
    request_id: typeof raw.request_id === "string" ? raw.request_id : null,
    model: raw.model,
    prompt_tokens: parseNumber(raw.prompt_tokens),
    completion_tokens: parseNumber(raw.completion_tokens),
    total_tokens: parseNumber(raw.total_tokens),
    feature: typeof raw.feature === "string" ? raw.feature : null,
    occurred_at: typeof raw.occurred_at === "string" ? raw.occurred_at : "",
    estimated_cost_usd: parseNumber(raw.estimated_cost_usd),
    price_snapshot: typeof raw.price_snapshot === "string" ? raw.price_snapshot : null,
    ingested_at: typeof raw.ingested_at === "string" ? raw.ingested_at : "",
  };
}

/**
 * Fetch aggregated OpenAI usage for a date range via Supabase RPC.
 */
export async function fetchUsageSummary(
  dateFrom: string,
  dateTo: string
): Promise<OpenAiUsageSummary | null> {
  const supabase = createClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_openai_usage_summary", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  return parseSummary(data);
}

/**
 * Fetch recent OpenAI usage events for a date range (optional app filter).
 */
export async function fetchUsageEvents(
  dateFrom: string,
  dateTo: string,
  appId?: string | null,
  limit = 100
): Promise<OpenAiUsageEventRow[]> {
  const supabase = createClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_openai_usage_events", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_app_id: appId ?? null,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map(parseEventRow)
    .filter((row): row is OpenAiUsageEventRow => row !== null);
}
