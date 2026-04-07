import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { LayoutDashboard, List, RefreshCw, Settings as SettingsIcon, Menu, X, Sun, Moon } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ExpensesTable from './components/ExpensesTable'
import ExpenseModal from './components/ExpenseModal'
import RecurringManager from './components/RecurringManager'
import Settings from './components/Settings'
import {
  loadExpenses, saveExpenses, loadRecurring, saveRecurring,
  loadSettings, saveSettings, loadCategories, saveCategories,
  loadCurrencySettings, saveCurrencySettings, genId,
} from './data/store'

function applyRecurring(expenses, recurring) {
  const now = new Date()
  const ym = format(now, 'yyyy-MM')
  let changed = false
  const result = [...expenses]
  for (const r of recurring) {
    if (!r.active) continue
    if (r.endDate && r.endDate < `${ym}-01`) continue // past end date
    const dateStr = `${ym}-${String(r.billingDay).padStart(2,'0')}`
    if (!result.some(e => e.recurringId === r.id && e.date?.startsWith(ym))) {
      result.push({ id: genId('e'), name: r.name, category: r.category, amount: r.amount, currency: r.currency, date: dateStr, recurringId: r.id, notes: r.notes ?? '' })
      changed = true
    }
  }
  return { result, changed }
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'expenses',  label: 'Expenses',   icon: List },
  { id: 'recurring', label: 'Recurring',  icon: RefreshCw },
  { id: 'settings',  label: 'Settings',   icon: SettingsIcon },
]

export default function App() {
  const [tab,              setTab]              = useState('dashboard')
  const [expenses,         setExpenses]         = useState([])
  const [recurring,        setRecurring]        = useState([])
  const [settings,         setSettings]         = useState(() => loadSettings())
  const [categories,       setCategories]       = useState(() => loadCategories())
  const [currencySettings, setCurrencySettings] = useState(() => loadCurrencySettings())
  const [expenseModal,     setExpenseModal]     = useState(null)
  const [mobileNav,        setMobileNav]        = useState(false)

  // Apply theme to <html>
  useEffect(() => {
    const html = document.documentElement
    if (settings.theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [settings.theme])

  // Load data on mount
  useEffect(() => {
    const rec = loadRecurring()
    const exp = loadExpenses()
    const { result, changed } = applyRecurring(exp, rec)
    setRecurring(rec)
    setExpenses(result)
    if (changed) saveExpenses(result)
  }, [])

  // ── Settings ──────────────────────────────────────────────────────────
  const handleSettingsSave = useCallback((s) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  const handleCategoriesSave = useCallback((cats) => {
    setCategories(cats)
    saveCategories(cats)
  }, [])

  const handleCurrencySave = useCallback((cs) => {
    setCurrencySettings(cs)
    saveCurrencySettings(cs)
  }, [])

  const handleThemeChange = useCallback((theme) => {
    setSettings(prev => {
      const next = { ...prev, theme }
      saveSettings(next)
      return next
    })
  }, [])

  function quickThemeToggle() {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    handleThemeChange(next)
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────
  const handleExpenseSave = useCallback((saved) => {
    setExpenses(prev => {
      let next
      const idx = prev.findIndex(e => e.id === saved.id)
      if (idx >= 0) next = prev.map(e => e.id === saved.id ? { ...e, ...saved } : e)
      else next = [...prev, saved]

      if (saved.isRecurring && !saved.recurringId) {
        const newRec = { id: genId('r'), name: saved.name, category: saved.category, amount: saved.amount, currency: saved.currency, billingDay: saved.billingDay ?? new Date().getDate(), notes: saved.notes ?? '', active: true, endDate: saved.endDate ?? null }
        setRecurring(recs => { const u = [...recs, newRec]; saveRecurring(u); return u })
        next = next.map(e => e.id === saved.id ? { ...e, recurringId: newRec.id } : e)
      }
      saveExpenses(next)
      return next
    })
    setExpenseModal(null)
  }, [])

  const handleExpenseDelete = useCallback((id) => {
    setExpenses(prev => { const n = prev.filter(e => e.id !== id); saveExpenses(n); return n })
  }, [])

  // ── Recurring CRUD ────────────────────────────────────────────────────
  const handleRecurringAdd = useCallback((item) => {
    setRecurring(prev => {
      const next = [...prev, item]
      saveRecurring(next)
      const ym = format(new Date(), 'yyyy-MM')
      const dateStr = `${ym}-${String(item.billingDay).padStart(2,'0')}`
      setExpenses(exps => {
        if (exps.some(e => e.recurringId === item.id && e.date?.startsWith(ym))) return exps
        const ne = { id: genId('e'), name: item.name, category: item.category, amount: item.amount, currency: item.currency, date: dateStr, recurringId: item.id, notes: item.notes ?? '' }
        const u = [...exps, ne]; saveExpenses(u); return u
      })
      return next
    })
  }, [])

  const handleRecurringUpdate = useCallback((item) => {
    setRecurring(prev => {
      const next = prev.map(r => r.id === item.id ? item : r)
      saveRecurring(next)
      setExpenses(exps => {
        const u = exps.map(e => e.recurringId !== item.id ? e : { ...e, name: item.name, category: item.category, amount: item.amount, currency: item.currency, notes: item.notes })
        saveExpenses(u); return u
      })
      return next
    })
  }, [])

  const handleRecurringDelete = useCallback((id) => {
    setRecurring(prev => { const n = prev.filter(r => r.id !== id); saveRecurring(n); return n })
  }, [])

  const handleRecurringToggle = useCallback((id) => {
    setRecurring(prev => { const n = prev.map(r => r.id === id ? { ...r, active: !r.active } : r); saveRecurring(n); return n })
  }, [])

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 w-52 flex flex-col py-5 px-3 transition-transform duration-200
          ${mobileNav ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
        style={{ borderRight: '1px solid var(--sb-border)' }}
      >
        {/* Logo */}
        <div className="px-2 mb-6">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', boxShadow: '0 2px 8px rgba(124,58,237,0.4)' }}>
              {(settings.companyName || 'C').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">{settings.companyName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--sb-text)' }}>{settings.tagline}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`sidebar-item w-full ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setMobileNav(false) }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Bottom: theme toggle */}
        <div className="px-2 pt-4" style={{ borderTop: '1px solid var(--sb-border)' }}>
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-xs font-medium"
            style={{ color: 'var(--sb-text)' }}
            onClick={quickThemeToggle}
          >
            {settings.theme === 'dark'
              ? <><Sun size={14} /> Light mode</>
              : <><Moon size={14} /> Dark mode</>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />
      )}

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-13 flex items-center justify-between px-5 lg:px-6 sticky top-0 z-20"
          style={{ background: 'rgba(var(--surface-rgb,255,255,255),0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg transition-colors" style={{ color: 'var(--text-2)' }} onClick={() => setMobileNav(v => !v)}>
              {mobileNav ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h2 className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-1)' }}>
                {TABS.find(t => t.id === tab)?.label}
              </h2>
              <p className="text-xs hidden sm:block" style={{ color: 'var(--text-3)' }}>{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(tab === 'dashboard' || tab === 'expenses') && (
              <button className="btn-primary text-xs" onClick={() => setExpenseModal('add')}>
                + Add Expense
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 lg:p-6 overflow-auto">
          {tab === 'dashboard' && <Dashboard expenses={expenses} recurring={recurring} categories={categories} currencySettings={currencySettings} />}
          {tab === 'expenses'  && <ExpensesTable expenses={expenses} onAdd={() => setExpenseModal('add')} onEdit={e => setExpenseModal(e)} onDelete={handleExpenseDelete} categories={categories} currencySettings={currencySettings} />}
          {tab === 'recurring' && <RecurringManager recurring={recurring} onAdd={handleRecurringAdd} onUpdate={handleRecurringUpdate} onDelete={handleRecurringDelete} onToggle={handleRecurringToggle} categories={categories} currencySettings={currencySettings} />}
          {tab === 'settings'  && <Settings settings={settings} onSave={handleSettingsSave} onThemeChange={handleThemeChange} categories={categories} onCategoriesSave={handleCategoriesSave} currencySettings={currencySettings} onCurrencySave={handleCurrencySave} />}
        </main>
      </div>

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal === 'add' ? null : expenseModal}
          defaultCurrency={currencySettings.display}
          categories={categories}
          onSave={handleExpenseSave}
          onClose={() => setExpenseModal(null)}
        />
      )}
    </div>
  )
}
