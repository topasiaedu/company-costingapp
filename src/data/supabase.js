import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jufozzefpxiqbpeajhiy.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RpBO5Cc2VZn2khReUEQULQ_LyxFxJz6'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
    billingDay:   r.billing_day,
    billingMonth: r.billing_month || 1,
    frequency:    r.frequency || 'monthly',
    active:       r.active,
    notes:        r.notes || '',
    endDate:      r.end_date,
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
    billing_day:   r.billingDay,
    billing_month: r.billingMonth || 1,
    frequency:     r.frequency || 'monthly',
    active:        r.active,
    notes:         r.notes || '',
    end_date:      r.endDate || null,
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
    recurringId: e.recurring_id || null,   // ← normalize to camelCase
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
    recurring_id: expense.recurringId || expense.recurring_id || null,  // ← accept either
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
  return { data, error: error?.code === 'PGRST116' ? null : error }
}

export async function saveCurrencySettings(settings, userId) {
  const row = {
    id:               `currency_${userId}`,
    user_id:          userId,
    display_currency: settings.display || 'USD',
    rates:            settings.rates || {},
  }
  const { data, error } = await supabase.from('currency_settings').upsert([row], { onConflict: 'user_id' })
  if (error) console.error('saveCurrencySettings:', error)
  return { data, error }
}
