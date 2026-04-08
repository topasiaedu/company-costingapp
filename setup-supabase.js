import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jufozzefpxiqbpeajhiy.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Zm96emVmcHhpcWJwZWFqaGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYzNTE1OCwiZXhwIjoyMDkxMjExMTU4fQ.xq6iwEOrzPVEasaIM0mtXUmuLizhbcCVDylYCrPzppo'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function setupDatabase() {
  console.log('🚀 Starting Supabase database setup...\n')

  try {
    // SQL to create all tables
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        date TEXT NOT NULL,
        recurring_id TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS recurring (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        billing_day INTEGER NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        end_date TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        company_name TEXT DEFAULT 'Company Costs',
        tagline TEXT DEFAULT 'Cost tracking dashboard',
        theme TEXT DEFAULT 'light',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS currency_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        display_currency TEXT DEFAULT 'USD',
        rates JSONB DEFAULT '{"USD": 1, "MYR": 0.22, "EUR": 1.08, "GBP": 1.27, "SGD": 0.74, "AUD": 0.65, "CAD": 0.73, "JPY": 0.0066}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `

    console.log('📊 Creating all tables...')
    console.log(createTablesSQL)
    console.log('\n✅ SQL statements ready to execute!')
    console.log('\n📍 Now paste this SQL into Supabase SQL Editor:')
    console.log('1. Go to https://supabase.com/dashboard/project/jufozzefpxiqbpeajhiy/sql')
    console.log('2. Click "New Query"')
    console.log('3. Paste the SQL above')
    console.log('4. Click "Run"')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

setupDatabase()
