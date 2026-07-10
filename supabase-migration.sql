-- Run this in Supabase SQL Editor to add project support

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'one-time';

ALTER TABLE recurring ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE recurring ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- Link add-on subscriptions to a parent (e.g. WABA under Automatic Sales)

ALTER TABLE recurring ADD COLUMN IF NOT EXISTS skipped_months JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: update default display currency
-- UPDATE currency_settings SET display_currency = 'MYR' WHERE display_currency = 'USD';

-- ---------------------------------------------------------------------------
-- OpenAI usage events (Agent 3) — run in Supabase SQL Editor
-- Ingest writes via service role (POST /api/openai-usage); authenticated users
-- can SELECT all rows (single-tenant operator model).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS openai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  app_name TEXT,
  request_id TEXT,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  feature TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  estimated_cost_usd NUMERIC NOT NULL,
  price_snapshot TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS openai_usage_events_request_id_unique
  ON openai_usage_events (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS openai_usage_events_occurred_at_idx
  ON openai_usage_events (occurred_at);

CREATE INDEX IF NOT EXISTS openai_usage_events_app_id_idx
  ON openai_usage_events (app_id);

ALTER TABLE openai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS openai_usage_events_select_authenticated ON openai_usage_events;
CREATE POLICY openai_usage_events_select_authenticated
  ON openai_usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- OpenAI usage RPC aggregations (Agent 4) — run in Supabase SQL Editor
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_openai_usage_summary(p_date_from date, p_date_to date)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH period AS (
    SELECT
      p_date_from AS date_from,
      p_date_to AS date_to,
      p_date_from - (p_date_to - p_date_from + 1) AS prev_from,
      p_date_from - 1 AS prev_to
  ),
  current_events AS (
    SELECT e.*
    FROM openai_usage_events e
    CROSS JOIN period p
    WHERE e.occurred_at::date BETWEEN p.date_from AND p.date_to
  ),
  prev_events AS (
    SELECT e.*
    FROM openai_usage_events e
    CROSS JOIN period p
    WHERE e.occurred_at::date BETWEEN p.prev_from AND p.prev_to
  ),
  totals AS (
    SELECT
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric AS total_cost_usd,
      COUNT(*)::bigint AS request_count
    FROM current_events
  ),
  prev_totals AS (
    SELECT
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric AS total_cost_usd,
      COUNT(*)::bigint AS request_count
    FROM prev_events
  ),
  by_app AS (
    SELECT
      app_id,
      COALESCE(MAX(app_name), app_id) AS app_name,
      SUM(total_tokens)::bigint AS tokens,
      SUM(estimated_cost_usd)::numeric AS cost_usd,
      COUNT(*)::bigint AS request_count
    FROM current_events
    GROUP BY app_id
  ),
  by_model AS (
    SELECT
      model,
      SUM(total_tokens)::bigint AS tokens,
      SUM(estimated_cost_usd)::numeric AS cost_usd
    FROM current_events
    GROUP BY model
  ),
  daily AS (
    SELECT
      occurred_at::date AS day,
      SUM(total_tokens)::bigint AS tokens,
      SUM(estimated_cost_usd)::numeric AS cost_usd
    FROM current_events
    GROUP BY occurred_at::date
  )
  SELECT json_build_object(
    'totals', (
      SELECT json_build_object(
        'total_tokens', t.total_tokens,
        'total_cost_usd', t.total_cost_usd,
        'request_count', t.request_count,
        'avg_tokens_per_request',
          CASE
            WHEN t.request_count > 0 THEN ROUND(t.total_tokens::numeric / t.request_count, 2)
            ELSE 0
          END
      )
      FROM totals t
    ),
    'by_app', COALESCE((
      SELECT json_agg(
        json_build_object(
          'app_id', a.app_id,
          'app_name', a.app_name,
          'tokens', a.tokens,
          'cost_usd', a.cost_usd,
          'request_count', a.request_count,
          'pct_of_total',
            CASE
              WHEN (SELECT total_cost_usd FROM totals) > 0
                THEN ROUND((a.cost_usd / (SELECT total_cost_usd FROM totals)) * 100, 1)
              ELSE 0
            END
        )
        ORDER BY a.cost_usd DESC
      )
      FROM by_app a
    ), '[]'::json),
    'by_model', COALESCE((
      SELECT json_agg(
        json_build_object(
          'model', m.model,
          'tokens', m.tokens,
          'cost_usd', m.cost_usd
        )
        ORDER BY m.cost_usd DESC
      )
      FROM by_model m
    ), '[]'::json),
    'daily_trend', COALESCE((
      SELECT json_agg(
        json_build_object(
          'date', d.day,
          'tokens', d.tokens,
          'cost_usd', d.cost_usd
        )
        ORDER BY d.day
      )
      FROM daily d
    ), '[]'::json),
    'previous_period', (
      SELECT json_build_object(
        'total_tokens', pt.total_tokens,
        'total_cost_usd', pt.total_cost_usd,
        'request_count', pt.request_count,
        'avg_tokens_per_request',
          CASE
            WHEN pt.request_count > 0 THEN ROUND(pt.total_tokens::numeric / pt.request_count, 2)
            ELSE 0
          END
      )
      FROM prev_totals pt
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_openai_usage_events(
  p_date_from date,
  p_date_to date,
  p_app_id text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  app_id text,
  app_name text,
  request_id text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  feature text,
  occurred_at timestamptz,
  estimated_cost_usd numeric,
  price_snapshot text,
  ingested_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.app_id,
    e.app_name,
    e.request_id,
    e.model,
    e.prompt_tokens,
    e.completion_tokens,
    e.total_tokens,
    e.feature,
    e.occurred_at,
    e.estimated_cost_usd,
    e.price_snapshot,
    e.ingested_at
  FROM openai_usage_events e
  WHERE e.occurred_at::date BETWEEN p_date_from AND p_date_to
    AND (p_app_id IS NULL OR e.app_id = p_app_id)
  ORDER BY e.occurred_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION get_openai_usage_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_openai_usage_events(date, date, text, integer) TO authenticated;
