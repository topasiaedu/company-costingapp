import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are both set. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!isSupabaseConfigured) {
  console.error(
    '[Company Costing] Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).'
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

/* Expected tables: expenses, recurring, settings, categories, currency_settings, projects */

// ── Auth ────────────────────────────────────────────────────────────
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}
export async function signOut() {
  return await supabase.auth.signOut()
}
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Helpers: DB (snake_case) <-> App (camelCase) ────────────────────
function recurringFromDB(r) {
  return {
    id:           r.id,
    name:         r.name,
    category:     r.category,
    amount:       Number(r.amount),
    currency:     r.currency,
    project:      r.project || null,
    billingDay:   r.billing_day,
    billingMonth: r.billing_month || 1,
    frequency:    r.frequency || 'monthly',
    active:       r.active,
    notes:        r.notes || '',
    endDate:      r.end_date,
    parentId:     r.parent_id || null,
    skippedMonths: Array.isArray(r.skipped_months) ? r.skipped_months : [],
  }
}

function recurringToDB(r, userId) {
  return {
    id:            r.id,
    user_id:       userId,
    name:          r.name,
    category:      r.category,
    amount:        Number(r.amount),
    currency:      r.currency,
    project:       r.project || null,
    billing_day:   r.billingDay,
    billing_month: r.billingMonth || 1,
    frequency:     r.frequency || 'monthly',
    active:        r.active,
    notes:         r.notes || '',
    end_date:      r.endDate || null,
    parent_id:     r.parentId || null,
    skipped_months: r.skippedMonths || [],
  }
}

// ── Helpers: DB (snake_case) <-> App (camelCase) for Expenses ───────
function expenseFromDB(e) {
  return {
    id:          e.id,
    name:        e.name,
    category:    e.category,
    amount:      Number(e.amount),
    currency:    e.currency,
    date:        e.date,
    project:     e.project || null,
    expenseType: e.expense_type || null,
    recurringId: e.recurring_id || null,
    notes:       e.notes || '',
  }
}

// ── Expenses ────────────────────────────────────────────────────────
export async function loadExpenses(userId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) console.error('loadExpenses:', error)
  return { data: (data || []).map(expenseFromDB), error }
}

export async function saveExpense(expense, userId) {
  const row = {
    id:           expense.id,
    user_id:      userId,
    name:         expense.name,
    category:     expense.category,
    amount:       Number(expense.amount),
    currency:     expense.currency,
    date:         expense.date,
    project:      expense.project || null,
    expense_type: expense.expenseType || (expense.recurringId ? 'subscription' : 'one-time'),
    recurring_id: expense.recurringId || expense.recurring_id || null,
    notes:        expense.notes || '',
  }
  const { data, error } = await supabase.from('expenses').upsert([row], { onConflict: 'id' })
  if (error) console.error('saveExpense:', error)
  return { data, error }
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) { console.error('deleteExpense:', error); return { error } }
  return { error: null }
}

export async function deleteExpensesByRecurringId(recurringId) {
  const { error } = await supabase.from('expenses').delete().eq('recurring_id', recurringId)
  if (error) { console.error('deleteExpensesByRecurringId:', error); return { error } }
  return { error: null }
}

// ── Recurring ───────────────────────────────────────────────────────
export async function loadRecurring(userId) {
  const { data, error } = await supabase
    .from('recurring')
    .select('*')
    .eq('user_id', userId)
  if (error) console.error('loadRecurring:', error)
  // Transform each row from DB format to app format
  return { data: (data || []).map(recurringFromDB), error }
}

// Save a SINGLE recurring item
export async function saveOneRecurring(item, userId) {
  const row = recurringToDB(item, userId)
  const { data, error } = await supabase.from('recurring').upsert([row], { onConflict: 'id' })
  if (error) console.error('saveOneRecurring:', error)
  return { data, error }
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from('recurring').delete().eq('id', id)
  if (error) { console.error('deleteRecurring:', error); return { error } }
  return { error: null }
}

// ── Settings ────────────────────────────────────────────────────────
// DB uses company_name (snake_case), app uses companyName (camelCase)
function settingsFromDB(s) {
  if (!s) return null
  return {
    companyName: s.company_name || 'Company Costs',
    tagline:     s.tagline     || 'Cost tracking dashboard',
    theme:       s.theme       || 'light',
  }
}

export async function loadSettings(userId) {
  const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') console.error('loadSettings:', error)
  return { data: settingsFromDB(data), error: error?.code === 'PGRST116' ? null : error }
}

export async function saveSettings(settings, userId) {
  const row = {
    id:           `settings_${userId}`,
    user_id:      userId,
    company_name: settings.companyName || 'Company Costs',
    tagline:      settings.tagline || 'Cost tracking dashboard',
    theme:        settings.theme || 'light',
  }
  const { data, error } = await supabase.from('settings').upsert([row], { onConflict: 'user_id' })
  if (error) console.error('saveSettings:', error)
  return { data, error }
}

// ── Categories ──────────────────────────────────────────────────────
export async function loadCategories(userId) {
  const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId)
  if (error) console.error('loadCategories:', error)
  return { data: data || [], error }
}

export async function saveCategories(categories, userId) {
  // Delete all existing categories for this user, then insert the current set.
  // This ensures deleted categories are actually removed from the DB.
  const { error: delErr } = await supabase.from('categories').delete().eq('user_id', userId)
  if (delErr) { console.error('saveCategories delete:', delErr); return { error: delErr } }
  if (categories.length === 0) return { error: null }
  const rows = categories.map(c => ({
    id:      c.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    name:    c.name,
    color:   c.color,
  }))
  const { data, error } = await supabase.from('categories').insert(rows)
  if (error) console.error('saveCategories insert:', error)
  return { data, error }
}

// ── Currency Settings ───────────────────────────────────────────────
export async function loadCurrencySettings(userId) {
  const { data, error } = await supabase.from('currency_settings').select('*').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') console.error('loadCurrencySettings:', error)
  const mapped = data
    ? { display: data.display_currency || 'MYR', rates: data.rates || {} }
    : null
  return { data: mapped, error: error?.code === 'PGRST116' ? null : error }
}

export async function saveCurrencySettings(settings, userId) {
  const row = {
    id:               `currency_${userId}`,
    user_id:          userId,
    display_currency: settings.display || 'MYR',
    rates:            settings.rates || {},
  }
  const { data, error } = await supabase.from('currency_settings').upsert([row], { onConflict: 'user_id' })
  if (error) console.error('saveCurrencySettings:', error)
  return { data, error }
}

// ── Projects ────────────────────────────────────────────────────────
export async function loadProjects(userId) {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId)
  // Missing table / RLS / network: log and return empty so the app still boots
  if (error) {
    console.error('loadProjects:', error)
    return { data: [], error }
  }
  return { data: data || [], error: null }
}

export async function saveProjects(projects, userId) {
  const { error: delErr } = await supabase.from('projects').delete().eq('user_id', userId)
  if (delErr) { console.error('saveProjects delete:', delErr); return { error: delErr } }
  if (projects.length === 0) return { error: null }
  const rows = projects.map(p => ({
    id:      p.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    name:    p.name,
    color:   p.color,
  }))
  const { data, error } = await supabase.from('projects').insert(rows)
  if (error) console.error('saveProjects insert:', error)
  return { data, error }
}

export async function saveExpensesBatch(expenses, userId) {
  if (!expenses.length) return { error: null }
  const rows = expenses.map(expense => ({
    id:           expense.id,
    user_id:      userId,
    name:         expense.name,
    category:     expense.category,
    amount:       Number(expense.amount),
    currency:     expense.currency,
    date:         expense.date,
    project:      expense.project || null,
    expense_type: expense.expenseType || (expense.recurringId ? 'subscription' : 'one-time'),
    recurring_id: expense.recurringId || null,
    notes:        expense.notes || '',
  }))
  const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveExpensesBatch:', error)
  return { error }
}

export async function saveRecurringBatch(items, userId) {
  if (!items.length) return { error: null }
  const rows = items.map(r => recurringToDB(r, userId))
  const { error } = await supabase.from('recurring').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveRecurringBatch:', error)
  return { error }
}

export async function deleteAllUserExpenses(userId) {
  const { error } = await supabase.from('expenses').delete().eq('user_id', userId)
  if (error) console.error('deleteAllUserExpenses:', error)
  return { error }
}

export async function deleteAllUserRecurring(userId) {
  const { error } = await supabase.from('recurring').delete().eq('user_id', userId)
  if (error) console.error('deleteAllUserRecurring:', error)
  return { error }
}
