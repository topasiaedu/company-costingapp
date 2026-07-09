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
-- Each user can only access their own rows (user_id = auth.uid())

ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;

-- expenses
CREATE POLICY "expenses_select_own" ON expenses
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "expenses_update_own" ON expenses
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "expenses_delete_own" ON expenses
  FOR DELETE USING (auth.uid()::text = user_id);

-- recurring
CREATE POLICY "recurring_select_own" ON recurring
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "recurring_insert_own" ON recurring
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "recurring_update_own" ON recurring
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "recurring_delete_own" ON recurring
  FOR DELETE USING (auth.uid()::text = user_id);

-- settings
CREATE POLICY "settings_select_own" ON settings
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "settings_insert_own" ON settings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "settings_delete_own" ON settings
  FOR DELETE USING (auth.uid()::text = user_id);

-- categories
CREATE POLICY "categories_select_own" ON categories
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "categories_insert_own" ON categories
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "categories_update_own" ON categories
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "categories_delete_own" ON categories
  FOR DELETE USING (auth.uid()::text = user_id);

-- currency_settings
CREATE POLICY "currency_settings_select_own" ON currency_settings
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "currency_settings_insert_own" ON currency_settings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "currency_settings_update_own" ON currency_settings
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "currency_settings_delete_own" ON currency_settings
  FOR DELETE USING (auth.uid()::text = user_id);

-- projects
CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (auth.uid()::text = user_id);
