import { createClient } from '@supabase/supabase-js'
import { dbToAppRecurring, appToDbRecurring } from './recurringHelpers'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jufozzefpxiqbpeajhiy.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RpBO5Cc2VZn2khReUEQULQ_LyxFxJz6'

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
  
  if (error) {
    console.error('Load expenses error:', error)
    return { data: [], error }
  }
  
  return { data: data || [], error }
}

export async function saveExpense(expense, userId) {
  const expenseData = {
    id: expense.id,
    user_id: userId,
    name: expense.name,
    category: expense.category,
    amount: parseFloat(expense.amount || 0),
    currency: expense.currency,
    date: expense.date,
    recurring_id: expense.recurring_id || expense.recurringId || null,
    notes: expense.notes || '',
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('expenses')
    .upsert([expenseData], { onConflict: 'id' })
  
  if (error) {
    console.error('Save expense error:', error)
  }
  
  return { data, error }
}

export async function deleteExpense(id) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Delete expense error:', error)
  }
  
  return { error }
}

// ── Recurring ───────────────────────────────────────────────────────
export async function loadRecurring(userId) {
  const { data, error } = await supabase
    .from('recurring')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    console.error('Load recurring error:', error)
    return { data: [], error }
  }
  
  // Transform from DB format to app format
  const transformed = (data || []).map(dbToAppRecurring)
  return { data: transformed, error }
}

export async function saveRecurring(recurring, userId) {
  // Transform from app format to DB format
  const recurringData = recurring.map(r => appToDbRecurring(r, userId))

  const { data, error } = await supabase
    .from('recurring')
    .upsert(recurringData, { onConflict: 'id' })
  
  if (error) {
    console.error('Save recurring error:', error)
  }
  
  return { data, error }
}

export async function deleteRecurring(id) {
  const { error } = await supabase
    .from('recurring')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Delete recurring error:', error)
  }
  
  return { error }
}

// ── Settings ────────────────────────────────────────────────────────
export async function loadSettings(userId) {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Load settings error:', error)
  }
  
  return { data, error: error?.code === 'PGRST116' ? null : error }
}

export async function saveSettings(settings, userId) {
  const settingsData = {
    id: `settings_${userId}`,
    user_id: userId,
    company_name: settings.companyName || 'Company Costs',
    tagline: settings.tagline || 'Cost tracking dashboard',
    theme: settings.theme || 'light',
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('settings')
    .upsert([settingsData], { onConflict: 'user_id' })
  
  if (error) {
    console.error('Save settings error:', error)
  }
  
  return { data, error }
}

// ── Categories ──────────────────────────────────────────────────────
export async function loadCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    console.error('Load categories error:', error)
    return { data: [], error }
  }
  
  return { data: data || [], error }
}

export async function saveCategories(categories, userId) {
  const categoriesData = categories.map(c => ({
    id: c.id || `cat_${userId}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    name: c.name,
    color: c.color,
    created_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('categories')
    .upsert(categoriesData, { onConflict: 'id' })
  
  if (error) {
    console.error('Save categories error:', error)
  }
  
  return { data, error }
}

// ── Currency Settings ───────────────────────────────────────────────
export async function loadCurrencySettings(userId) {
  const { data, error } = await supabase
    .from('currency_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Load currency settings error:', error)
  }
  
  return { data, error: error?.code === 'PGRST116' ? null : error }
}

export async function saveCurrencySettings(settings, userId) {
  const currencyData = {
    id: `currency_${userId}`,
    user_id: userId,
    display_currency: settings.display || 'USD',
    rates: settings.rates || {},
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('currency_settings')
    .upsert([currencyData], { onConflict: 'user_id' })
  
  if (error) {
    console.error('Save currency settings error:', error)
  }
  
  return { data, error }
}
