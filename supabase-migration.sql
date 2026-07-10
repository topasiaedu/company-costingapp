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
