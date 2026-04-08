import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { LayoutDashboard, List, RefreshCw, Settings as SettingsIcon, Menu, X, Sun, Moon, LogOut } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ExpensesTable from './components/ExpensesTable'
import ExpenseModal from './components/ExpenseModal'
import RecurringManager from './components/RecurringManager'
import Settings from './components/Settings'
import Login from './components/Login'
import { genId } from './data/store'
import { DEFAULT_CATEGORIES, DEFAULT_CURRENCY_SETTINGS, DEFAULT_SETTINGS } from './data/store'
import {
  getCurrentUser, signOut,
  loadExpenses, saveExpense, deleteExpense,
  loadRecurring, saveRecurring, deleteRecurring,
  loadSettings, saveSettings,
  loadCategories, saveCategories,
  loadCurrencySettings, saveCurrencySettings
} from './data/supabase'

function applyRecurring(expenses, recurring) {
  const now = new Date()
  const ym = format(now, 'yyyy-MM')
  let changed = false
  const result = [...expenses]
  for (const r of recurring) {
    if (!r.active) continue
    if (r.end_date && r.end_date < `${ym}-01`) continue
    const dateStr = `${ym}-${String(r.billing_day).padStart(2,'0')}`
    if (!result.some(e => e.recurring_id === r.id && e.date?.startsWith(ym))) {
      result.push({ id: genId('e'), name: r.name, category: r.category, amount: r.amount, currency: r.currency, date: dateStr, recurring_id: r.id, notes: r.notes ?? '' })
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
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [expenses, setExpenses] = useState([])
  const [recurring, setRecurring] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [currencySettings, setCurrencySettings] = useState(DEFAULT_CURRENCY_SETTINGS)
  const [expenseModal, setExpenseModal] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    async function checkUser() {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setLoading(false)
    }
    checkUser()
  }, [])

  useEffect(() => {
    if (!user) return

    async function loadData() {
      try {
        const { data: settingsData } = await loadSettings(user.id)
        if (settingsData) setSettings(settingsData)

        const { data: categoriesData } = await loadCategories(user.id)
        if (categoriesData && categoriesData.length > 0) {
          setCategories(categoriesData.map(c => ({ name: c.name, color: c.color })))
        }

        const { data: currencyData } = await loadCurrencySettings(user.id)
        if (currencyData) setCurrencySettings({ display: currencyData.display_currency, rates: currencyData.rates })

        const { data: recurringData } = await loadRecurring(user.id)
        setRecurring(recurringData || [])

        const { data: expensesData } = await loadExpenses(user.id)
        const { result, changed } = applyRecurring(expensesData || [], recurringData || [])
        setExpenses(result)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [user])

  useEffect(() => {
    const html = document.documentElement
    if (settings.theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [settings.theme])

  const handleLogout = async () => {
    await signOut()
    setUser(null)
  }

  const handleSettingsSave = useCallback(async (s) => {
    if (!user) return
    setSettings(s)
    await saveSettings(s, user.id)
  }, [user])

  const handleCategoriesSave = useCallback(async (cats) => {
    if (!user) return
    setCategories(cats)
    await saveCategories(cats, user.id)
  }, [user])

  const handleCurrencySave = useCallback(async (cs) => {
    if (!user) return
    setCurrencySettings(cs)
    await saveCurrencySettings(cs, user.id)
  }, [user])

  const handleThemeChange = useCallback(async (theme) => {
    if (!user) return
    const newSettings = { ...settings, theme }
    setSettings(newSettings)
    await saveSettings(newSettings, user.id)
  }, [user, settings])

  function quickThemeToggle() {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    handleThemeChange(next)
  }

  const handleExpenseSave = useCallback(async (saved) => {
    if (!user) return
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === saved.id)
      const next = idx >= 0 ? prev.map(e => e.id === saved.id ? { ...e, ...saved } : e) : [...prev, saved]
      saveExpense(saved, user.id)
      return next
    })
    setExpenseModal(null)
  }, [user])

  const handleExpenseDelete = useCallback(async (id) => {
    if (!user) return
    setExpenses(prev => prev.filter(e => e.id !== id))
    await deleteExpense(id)
  }, [user])

  const handleRecurringAdd = useCallback(async (item) => {
    if (!user) return
    const newItem = { ...item, user_id: user.id }
    setRecurring(prev => [...prev, newItem])
    await saveRecurring([...recurring, newItem], user.id)
  }, [user, recurring])

  const handleRecurringUpdate = useCallback(async (item) => {
    if (!user) return
    const updated = recurring.map(r => r.id === item.id ? item : r)
    setRecurring(updated)
    await saveRecurring(updated, user.id)
  }, [user, recurring])

  const handleRecurringDelete = useCallback(async (id) => {
    if (!user) return
    setRecurring(prev => prev.filter(r => r.id !== id))
  }, [user])

  const handleRecurringToggle = useCallback(async (id) => {
    if (!user) return
    const updated = recurring.map(r => r.id === id ? { ...r, active: !r.active } : r)
    setRecurring(updated)
    await saveRecurring(updated, user.id)
  }, [user, recurring])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
            CC
          </div>
          <p style={{ color: 'var(--text-3)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 w-52 flex flex-col py-5 px-3 transition-transform duration-200
          ${mobileNav ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
        style={{ borderRight: '1px solid var(--sb-border)' }}
      >
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

        <div className="px-2 pt-4 space-y-1" style={{ borderTop: '1px solid var(--sb-border)' }}>
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-xs font-medium"
            style={{ color: 'var(--sb-text)' }}
            onClick={quickThemeToggle}
          >
            {settings.theme === 'dark'
              ? <><Sun size={14} /> Light mode</>
              : <><Moon size={14} /> Dark mode</>}
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-xs font-medium text-red-500 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-13 flex items-center justify-between px-5 lg:px-6 sticky top-0 z-20"
          style={{ background: 'var(--surface)' }}>
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
          <div className="flex items-center gap-3">
            {(tab === 'dashboard' || tab === 'expenses') && (
              <button className="btn-primary text-xs" onClick={() => setExpenseModal('add')}>
                + Add Expense
              </button>
            )}
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{user?.email}</span>
          </div>
        </header>

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
