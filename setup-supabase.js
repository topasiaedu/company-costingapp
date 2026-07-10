/**
 * Prints the SQL needed to set up the Company Costing App database.
 * Paste the output into the Supabase SQL Editor — do not put secrets in this file.
 *
 * Official schema: supabase-setup.sql
 * Incremental:     supabase-migration.sql
 *
 * Usage: node setup-supabase.js
 */

const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, 'supabase-setup.sql')

console.log('Company Costing App — Supabase setup instructions\n')
console.log('1. Open your project: https://supabase.com/dashboard → SQL Editor → New Query')
console.log('2. Paste the contents of supabase-setup.sql (shown below) and click Run')
console.log('3. Confirm tables exist: expenses, recurring, settings, categories, currency_settings, projects')
console.log("4. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example)\n");
console.log('─'.repeat(60))
console.log('')

if (fs.existsSync(schemaPath)) {
  console.log(fs.readFileSync(schemaPath, 'utf8'))
} else {
  console.error('Could not find supabase-setup.sql next to this script.')
  process.exit(1)
}
