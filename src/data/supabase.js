import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jufozzefpxiqbpeajhiy.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_RpBO5Cc2VZn2khReUEQULQ_LyxFxJz6'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Authentication ─────────────────────────────────────────────────
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Expenses ────────────────────────────────────────────────────────
export async function loadExpenses(userId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  return { data: data || [], error }
}

export async function saveExpense(expense, userId) {
  const expenseData = { ...expense, user_id: userId, amount: parseFloat(expense.amount) }
  const { data, error } = await supabase
    .from('expenses')
    .upsert([expenseData], { onConflict: 'id' })
  return { data, error }
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  return { error }
}

// ── Recurring ───────────────────────────────────────────────────────
export async function loadRecurring(userId) {
  const { data, error } = await supabase
    .from('recurring')
    .select('*')
    .eq('user_id', userId)
  return { data: data || [], error }
}

export async function saveRecurring(recurring, userId) {
  const recurringData = recurring.map(r => ({ ...r, user_id: userId, amount: parseFloat(r.amount) }))
  const { data, error } = await supabase
    .from('recurring')
    .upsert(recurringData, { onConflict: 'id' })
  return { data, error }
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from('recurring').delete().eq('id', id)
  return { error }
}

// ── Settings ────────────────────────────────────────────────────────
export async function loadSettings(userId) {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export async function saveSettings(settings, userId) {
  const settingsData = { ...settings, id: `settings_${userId}`, user_id: userId }
  const { data, error } = await supabase
    .from('settings')
    .upsert([settingsData], { onConflict: 'user_id' })
  return { data, error }
}

// ── Categories ──────────────────────────────────────────────────────
export async function loadCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
  return { data: data || [], error }
}

export async function saveCategories(categories, userId) {
  const categoriesData = categories.map(c => ({
    ...c,
    id: c.id || `cat_${userId}_${Math.random()}`,
    user_id: userId,
  }))
  const { data, error } = await supabase
    .from('categories')
    .upsert(categoriesData, { onConflict: 'id' })
  return { data, error }
}

// ── Currency Settings ───────────────────────────────────────────────
export async function loadCurrencySettings(userId) {
  const { data, error } = await supabase
    .from('currency_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export async function saveCurrencySettings(settings, userId) {
  const currencyData = { ...settings, id: `currency_${userId}`, user_id: userId }
  const { data, error } = await supabase
    .from('currency_settings')
    .upsert([currencyData], { onConflict: 'user_id' })
  return { data, error }
}
