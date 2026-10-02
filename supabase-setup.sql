-- =============================================================================
-- Company Costing App — Full Supabase Setup
-- Run this entire script in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  currency      TEXT NOT NULL,
  date          TEXT NOT NULL,
  project       TEXT,
  expense_type  TEXT DEFAULT 'one-time',
  recurring_id  TEXT,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  amount         NUMERIC NOT NULL,
  currency       TEXT NOT NULL,
  project        TEXT,
  billing_day    INTEGER NOT NULL,
  billing_month  INTEGER DEFAULT 1,
  frequency      TEXT DEFAULT 'monthly',
  active         BOOLEAN DEFAULT TRUE,
  notes          TEXT DEFAULT '',
  end_date       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE,
  company_name  TEXT DEFAULT 'Company Costs',
  tagline       TEXT DEFAULT 'Cost tracking dashboard',
  theme         TEXT DEFAULT 'light',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currency_settings (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL UNIQUE,
  display_currency TEXT DEFAULT 'MYR',
  rates            JSONB DEFAULT '{"USD": 0.22, "MYR": 1, "EUR": 0.24, "GBP": 0.28, "SGD": 0.16, "AUD": 0.14, "CAD": 0.16, "JPY": 0.0015}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_expenses_user_id       ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_id  ON expenses (recurring_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project       ON expenses (project);

CREATE INDEX IF NOT EXISTS idx_recurring_user_id      ON recurring (user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id     ON categories (user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id       ON projects (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Shared company workspace: any signed-in user can access all costing rows.

ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;

-- expenses
CREATE POLICY "expenses_select_authenticated" ON expenses
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_insert_authenticated" ON expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_update_authenticated" ON expenses
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_delete_authenticated" ON expenses
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- recurring
CREATE POLICY "recurring_select_authenticated" ON recurring
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "recurring_insert_authenticated" ON recurring
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "recurring_update_authenticated" ON recurring
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "recurring_delete_authenticated" ON recurring
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- settings
CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_insert_authenticated" ON settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "settings_update_authenticated" ON settings
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "settings_delete_authenticated" ON settings
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- categories
CREATE POLICY "categories_select_authenticated" ON categories
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories_insert_authenticated" ON categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "categories_update_authenticated" ON categories
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "categories_delete_authenticated" ON categories
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- currency_settings
CREATE POLICY "currency_settings_select_authenticated" ON currency_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "currency_settings_insert_authenticated" ON currency_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "currency_settings_update_authenticated" ON currency_settings
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "currency_settings_delete_authenticated" ON currency_settings
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projects
CREATE POLICY "projects_select_authenticated" ON projects
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "projects_insert_authenticated" ON projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "projects_update_authenticated" ON projects
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "projects_delete_authenticated" ON projects
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
