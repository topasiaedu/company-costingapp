# Company Costing App

A tech department spend tracker that replaces a manual Google Sheets / CSV mastersheet workflow. Record expenses, subscriptions, and credit reloads; view dashboards and a mastersheet-style P&L Report; export CSV or screenshot for stakeholders. Auth and data live in Supabase (no custom Node backend).

## Local development

```bash
npm install
cp .env.example .env   # then fill in values
npm run dev
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |

Never put the `service_role` key in the frontend or Vercel env.

Database schema: run `supabase-setup.sql` in the Supabase SQL Editor (or `node setup-supabase.js` to print it).

## Deploy on Vercel

1. Import this repo in Vercel
2. Framework: Vite (or Other)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings → Environment Variables
6. Deploy — SPA routing is handled by `vercel.json`
