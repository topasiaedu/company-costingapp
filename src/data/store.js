import { format, addMonths, startOfMonth, parseISO } from 'date-fns'

const EXPENSES_KEY   = 'cc_expenses'
const RECURRING_KEY  = 'cc_recurring'
const SETTINGS_KEY   = 'cc_settings'
const CATEGORIES_KEY = 'cc_categories'
const CURRENCY_KEY   = 'cc_currency'

// ── Default categories ─────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES = [
  { name: 'AI Tools',      color: '#8b5cf6' },
  { name: 'Productivity',  color: '#22c55e' },
  { name: 'Development',   color: '#f59e0b' },
  { name: 'Infrastructure',color: '#3b82f6' },
  { name: 'Design',        color: '#ec4899' },
  { name: 'Marketing',     color: '#14b8a6' },
  { name: 'Finance',       color: '#a855f7' },
  { name: 'HR',            color: '#f97316' },
  { name: 'Other',         color: '#64748b' },
]

export function loadCategories() {
  try { const r = localStorage.getItem(CATEGORIES_KEY); if (r) return JSON.parse(r) } catch (_) {}
  return [...DEFAULT_CATEGORIES]
}
export function saveCategories(cats) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats)) }

export function getCategoryColor(name, categories) {
  return categories?.find(c => c.name === name)?.color ?? '#64748b'
}

// ── Currency settings ──────────────────────────────────────────────────────
// rates[X] = "how many display-currency units equals 1 X"
// e.g. display=MYR, rates={ USD:4.47, MYR:1, EUR:5.20 }
export const DEFAULT_CURRENCY_SETTINGS = {
  display: 'USD',
  rates: { USD: 1, MYR: 0.22, EUR: 1.08, GBP: 1.27, SGD: 0.74, AUD: 0.65, CAD: 0.73, JPY: 0.0066 },
}

export function loadCurrencySettings() {
  try { const r = localStorage.getItem(CURRENCY_KEY); if (r) return { ...DEFAULT_CURRENCY_SETTINGS, ...JSON.parse(r) } } catch (_) {}
  return { ...DEFAULT_CURRENCY_SETTINGS }
}
export function saveCurrencySettings(s) { localStorage.setItem(CURRENCY_KEY, JSON.stringify(s)) }

// Convert amount from any currency → display currency
export function convertToDisplay(amount, fromCurrency, currencySettings) {
  const { display, rates } = currencySettings
  if (fromCurrency === display) return amount
  // amount in fromCurrency → display
  // rate[from] = "1 from = rate[from] display"... wait, depends on base
  // We store rates as: rates[X] = value of 1 X in display currency
  const rate = rates[fromCurrency] ?? 1
  return amount * rate
}

// Format a number as currency string
const CURRENCY_SYMBOLS = {
  USD: '$', MYR: 'RM ', EUR: '€', GBP: '£',
  SGD: 'S$', AUD: 'A$', CAD: 'C$', JPY: '¥',
}
export function fmtCurrency(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] ?? (currency + ' ')
  return `${sym}${amount.toFixed(currency === 'JPY' ? 0 : 2)}`
}

// ── Default settings ───────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  companyName: 'Company Costs',
  tagline:     'Cost tracking dashboard',
  theme:       'light',
}

export function loadSettings() {
  try { const r = localStorage.getItem(SETTINGS_KEY); if (r) return { ...DEFAULT_SETTINGS, ...JSON.parse(r) } } catch (_) {}
  return { ...DEFAULT_SETTINGS }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_RECURRING = [
  { id: 'r1', name: 'Zoom',              category: 'Productivity',  amount: 15.99, currency: 'USD', billingDay: 1,  active: true, notes: '',         endDate: null },
  { id: 'r2', name: 'Claude (Anthropic)',category: 'AI Tools',      amount: 20.00, currency: 'USD', billingDay: 5,  active: true, notes: 'Pro plan',  endDate: null },
  { id: 'r3', name: 'ChatGPT Plus',      category: 'AI Tools',      amount: 20.00, currency: 'USD', billingDay: 5,  active: true, notes: '',          endDate: null },
  { id: 'r4', name: 'Google Workspace',  category: 'Productivity',  amount: 55.00, currency: 'MYR', billingDay: 10, active: true, notes: '',          endDate: null },
  { id: 'r5', name: 'GitHub',            category: 'Development',   amount: 4.00,  currency: 'USD', billingDay: 15, active: true, notes: 'Per seat',  endDate: null },
]

function buildSeedExpenses() {
  const now = new Date(); const expenses = []; let n = 1
  for (let m = 5; m >= 0; m--) {
    const ym = format(addMonths(now, -m), 'yyyy-MM')
    for (const r of SEED_RECURRING) {
      expenses.push({ id:`e${n++}`, name:r.name, category:r.category, amount:r.amount, currency:r.currency, date:`${ym}-${String(r.billingDay).padStart(2,'0')}`, recurringId:r.id, notes:r.notes })
    }
    expenses.push({ id:`e${n++}`, recurringId:null, currency:'USD', notes:'', name:'AWS',   category:'Infrastructure', amount:+(Math.random()*60+40).toFixed(2), date:`${ym}-08` })
    expenses.push({ id:`e${n++}`, recurringId:null, currency:'MYR', notes:'', name:'Figma', category:'Design',         amount:75.00, date:`${ym}-12` })
    if (m < 3) expenses.push({ id:`e${n++}`, recurringId:null, currency:'MYR', notes:'', name:'Notion', category:'Productivity', amount:35.00, date:`${ym}-20` })
  }
  return expenses
}

export function loadRecurring() {
  try { const r = localStorage.getItem(RECURRING_KEY); if (r) return JSON.parse(r) } catch (_) {}
  localStorage.setItem(RECURRING_KEY, JSON.stringify(SEED_RECURRING))
  return [...SEED_RECURRING]
}
export function saveRecurring(items) { localStorage.setItem(RECURRING_KEY, JSON.stringify(items)) }

export function loadExpenses() {
  try { const r = localStorage.getItem(EXPENSES_KEY); if (r) return JSON.parse(r) } catch (_) {}
  const seed = buildSeedExpenses()
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(seed))
  return seed
}
export function saveExpenses(items) { localStorage.setItem(EXPENSES_KEY, JSON.stringify(items)) }

export function genId(p = 'x') { return `${p}${Date.now()}${Math.random().toString(36).slice(2,6)}` }

export function filterExpenses(expenses, { dateFrom, dateTo }) {
  return expenses.filter(e => {
    if (!e.date) return false
    if (dateFrom && e.date < dateFrom) return false
    if (dateTo   && e.date > dateTo)   return false
    return true
  })
}

export function getMonthlyTotals(expenses, dateFrom, dateTo, currencySettings) {
  const allDates = expenses.map(e => e.date).filter(Boolean).sort()
  const from = (dateFrom && dateFrom.length >= 7 ? dateFrom : null) || allDates[0] || format(addMonths(new Date(),-5),'yyyy-MM-dd')
  const to   = (dateTo   && dateTo.length >= 7   ? dateTo   : null) || format(new Date(),'yyyy-MM-dd')
  // Ensure we have valid date strings for parseISO (needs at least yyyy-MM-dd)
  const fromFull = from.length === 7 ? from + '-01' : from
  const toFull   = to.length   === 7 ? to   + '-01' : to
  const months = []
  let cur = startOfMonth(parseISO(fromFull))
  const end = startOfMonth(parseISO(toFull))
  while (cur <= end) {
    const ms = format(cur,'yyyy-MM')
    const total = expenses
      .filter(e => e.date?.startsWith(ms))
      .reduce((s,e) => s + convertToDisplay(e.amount, e.currency, currencySettings), 0)
    months.push({ month: ms, label: format(cur,'MMM yy'), total: +total.toFixed(2) })
    cur = addMonths(cur, 1)
  }
  return months
}

export function getCategoryTotals(expenses, currencySettings) {
  const map = {}
  for (const e of expenses) {
    const converted = convertToDisplay(e.amount, e.currency, currencySettings)
    map[e.category] = (map[e.category] || 0) + converted
  }
  return Object.entries(map).map(([name,value]) => ({ name, value:+value.toFixed(2) })).sort((a,b)=>b.value-a.value)
}

// ── Auto-categorize ────────────────────────────────────────────────────────
const KEYWORD_MAP = [
  ['AI Tools',       ['claude','chatgpt','openai','gemini','copilot','midjourney','anthropic','gpt','perplexity','bard','mistral','stability','runway','elevenlabs','jasper','writesonic','grammarly']],
  ['Productivity',   ['zoom','notion','slack','teams','asana','monday','trello','todoist','google workspace','gsuite','office 365','microsoft 365','loom','calendly','clickup','airtable','basecamp','coda']],
  ['Development',    ['github','gitlab','bitbucket','jira','linear','vercel','netlify','heroku','sentry','datadog','postman','retool','supabase','planetscale','railway','render','circleci']],
  ['Infrastructure', ['aws','azure','gcp','google cloud','digitalocean','cloudflare','linode','vultr','hetzner','upstash','neon']],
  ['Design',         ['figma','canva','adobe','sketch','zeplin','invision','framer','remove.bg','lottie']],
  ['Marketing',      ['mailchimp','hubspot','ahrefs','semrush','buffer','hootsuite','convertkit','beehiiv','klaviyo','intercom','mixpanel','amplitude','hotjar']],
  ['Finance',        ['quickbooks','xero','stripe','paypal','wise','brex','mercury','freshbooks','expensify']],
  ['HR',             ['bamboohr','gusto','rippling','workday','deel','remote.com','lattice']],
]
export function guessCategory(name) {
  if (!name) return ''
  const lower = name.toLowerCase()
  for (const [cat, kws] of KEYWORD_MAP) { if (kws.some(k => lower.includes(k))) return cat }
  return ''
}

// ── CSV export ─────────────────────────────────────────────────────────────
export function exportToCSV(expenses, filename = 'expenses.csv') {
  const headers = ['Date','Name','Category','Amount','Currency','Type','Notes']
  const rows = expenses.slice().sort((a,b)=>(b.date??'').localeCompare(a.date??'')).map(e => [
    e.date, e.name, e.category, e.amount.toFixed(2), e.currency, e.recurringId?'Recurring':'One-off', e.notes??'',
  ])
  const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv],{type:'text/csv'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export const CURRENCIES = ['USD','MYR','EUR','GBP','SGD','AUD','CAD','JPY']
// Convenience flat list of category names (derived from DEFAULT_CATEGORIES)
export const CATEGORIES = DEFAULT_CATEGORIES.map(c => c.name)
