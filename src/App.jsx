import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { LayoutDashboard, List, RefreshCw, Settings as SettingsIcon, Menu, X, Sun, Moon, LogOut, AlertCircle, Check } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ExpensesTable from './components/ExpensesTable'
import ExpenseModal from './components/ExpenseModal'
import RecurringManager from './components/RecurringManager'
import Settings from './components/Settings'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import ResetPasswordForm from './components/ResetPasswordForm'
import { genId, DEFAULT_CATEGORIES, DEFAULT_CURRENCY_SETTINGS, DEFAULT_SETTINGS } from './data/store'
import {
  getCurrentUser, signOut,
  loadExpenses, saveExpense, deleteExpense, deleteExpensesByRecurringId,
  loadRecurring, saveOneRecurring, deleteRecurring,
  loadSettings, saveSettings,
  loadCategories, saveCategories,
  loadCurrencySettings, saveCurrencySettings,
} from './data/supabase'

// Auto-generate this month's expenses for active recurring items
function applyRecurring(expenses, recurring) {
  const now  = new Date()
  const ym   = format(now, 'yyyy-MM')
  let changed = false
  const result = [...expenses]
  for (const r of recurring) {
    if (!r.active) continue
    if (r.endDate && r.endDate < `${ym}-01`) continue
    const day     = String(r.billingDay || 1).padStart(2, '0')
    const dateStr = `${ym}-${day}`
    if (!result.some(e => e.recurringId === r.id && e.date?.startsWith(ym))) {
      result.push({ id: genId('e'), name: r.name, category: r.category, amount: r.amount, currency: r.currency, date: dateStr, recurringId: r.id, notes: r.notes ?? '' })
      changed = true
    }
  }
  return { result, changed }
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'expenses',  label: 'Expenses',  icon: List },
  { id: 'settings',  label: 'Settings',  icon: SettingsIcon },
]

export default function App() {
  const [user,             setUser]             = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [authScreen,       setAuthScreen]       = useState('login')
  const [tab,              setTab]              = useState('dashboard')
  const [expenses,         setExpenses]         = useState([])
  const [recurring,        setRecurring]        = useState([])
  const [settings,         setSettings]         = useState(DEFAULT_SETTINGS)
  const [categories,       setCategories]       = useState(DEFAULT_CATEGORIES)
  const [currencySettings, setCurrencySettings] = useState(DEFAULT_CURRENCY_SETTINGS)
  const [expenseModal, setExpenseModal] = useState(null)
  const [mobileNav,    setMobileNav]    = useState(false)
  const [saveStatus,       setSaveStatus]       = useState('idle')
  const [saveError,        setSaveError]        = useState('')

  // Auto-hide save status after 2s (saved) or 5s (error)
  useEffect(() => {
    if (saveStatus === 'idle') return
    const t = setTimeout(() => setSaveStatus('idle'), saveStatus === 'error' ? 5000 : 2000)
    return () => clearTimeout(t)
  }, [saveStatus])

  // Check session on mount
  useEffect(() => {
    async function init() {
      if (window.location.hash.includes('type=recovery')) setAuthScreen('reset-form')
      const u = await getCurrentUser()
      setUser(u)
      setLoading(false)
    }
    init()
  }, [])

  // Load all data when user is ready
  useEffect(() => {
    if (!user) return
    async function loadAll() {
      try {
        setSaveStatus('saving')

        const [settingsRes, catsRes, currencyRes, recurringRes, expensesRes] = await Promise.all([
          loadSettings(user.id),
          loadCategories(user.id),
          loadCurrencySettings(user.id),
          loadRecurring(user.id),
          loadExpenses(user.id),
        ])

        if (settingsRes.data)  setSettings(settingsRes.data)
        if (catsRes.data?.length > 0) setCategories(catsRes.data.map(c => ({ name: c.name, color: c.color })))
        if (currencyRes.data)  setCurrencySettings({ display: currencyRes.data.display_currency, rates: currencyRes.data.rates })

        const loadedRecurring = recurringRes.data || []
        setRecurring(loadedRecurring)

        const { result, changed } = applyRecurring(expensesRes.data || [], loadedRecurring)
        setExpenses(result)

        // Save any newly auto-generated expenses
        if (changed) {
          const newExpenses = result.filter(e => !(expensesRes.data || []).find(x => x.id === e.id))
          await Promise.all(newExpenses.map(e => saveExpense(e, user.id)))
        }

        setSaveStatus('saved')
      } catch (err) {
        console.error('loadAll error:', err)
        setSaveError('Failed to load data')
        setSaveStatus('error')
      }
    }
    loadAll()
  }, [user])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  const doSave = useCallback(async (fn) => {
    try {
      setSaveStatus('saving')
      const { error } = await fn()
      if (error) throw error
      setSaveStatus('saved')
    } catch (err) {
      setSaveError(err.message || 'Save failed')
      setSaveStatus('error')
    }
  }, [])

  const handleLogout       = async () => { await signOut(); setUser(null) }
  const handleSettingsSave = useCallback((s)    => { setSettings(s);         doSave(() => saveSettings(s, user.id)) },         [user, doSave])
  const handleCategoriesSave=useCallback((cats) => { setCategories(cats);    doSave(() => saveCategories(cats, user.id)) },    [user, doSave])
  const handleCurrencySave  =useCallback((cs)   => { setCurrencySettings(cs);doSave(() => saveCurrencySettings(cs, user.id)) },[user, doSave])
  const handleThemeChange   =useCallback((theme)=> {
    const s = { ...settings, theme }
    setSettings(s)
    doSave(() => saveSettings(s, user.id))
  }, [user, settings, doSave])

  const quickThemeToggle = () => handleThemeChange(settings.theme === 'dark' ? 'light' : 'dark')

  // ── Expenses ────────────────────────────────────────────────────
  const handleExpenseSave = useCallback(async (saved) => {
    if (!user) return

    // Case 1: switched from recurring → one-off — remove the subscription template
    if (!saved.isRecurring && saved.recurringId) {
      const recId = saved.recurringId
      saved = { ...saved, recurringId: null }
      setRecurring(prev => prev.filter(r => r.id !== recId))
      deleteRecurring(recId)
    }

    // Case 2: new recurring subscription — create the template
    else if (saved.isRecurring && !saved.recurringId) {
      const newRecurring = {
        id:         genId('r'),
        name:       saved.name,
        category:   saved.category,
        amount:     saved.amount,
        currency:   saved.currency,
        billingDay: saved.billingDay || new Date().getDate(),
        active:     true,
        notes:      saved.notes || '',
        endDate:    saved.endDate || null,
      }
      saved = { ...saved, recurringId: newRecurring.id }
      setRecurring(prev => [...prev, newRecurring])
      saveOneRecurring(newRecurring, user.id)
    }

    // Case 3: editing an existing recurring expense — auto-sync the template
    else if (saved.isRecurring && saved.recurringId) {
      const template = recurring.find(r => r.id === saved.recurringId)
      if (template) {
        const updated = { ...template, name: saved.name, category: saved.category, amount: saved.amount, currency: saved.currency, notes: saved.notes || '' }
        setRecurring(prev => prev.map(r => r.id === saved.recurringId ? updated : r))
        saveOneRecurring(updated, user.id)
      }
    }

    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === saved.id)
      return idx >= 0 ? prev.map(e => e.id === saved.id ? { ...e, ...saved } : e) : [...prev, saved]
    })
    setExpenseModal(null)
    doSave(() => saveExpense(saved, user.id))
  }, [user, doSave, recurring])

  const handleExpenseDelete = useCallback(async (id) => {
    if (!user) return
    const expense = expenses.find(e => e.id === id)

    if (expense?.recurringId) {
      const recId = expense.recurringId
      const recStillExists = recurring.some(r => r.id === recId)
      const confirmMsg = recStillExists
        ? `"${expense.name}" is a recurring subscription.\n\nThis will delete the subscription AND all its expense history.\n\nDelete everything?`
        : `"${expense.name}" is linked to a subscription that no longer exists.\n\nDelete this expense?`
      if (!window.confirm(confirmMsg)) return
      // Remove from state
      setRecurring(prev => prev.filter(r => r.id !== recId))
      setExpenses(prev => prev.filter(e => e.recurringId !== recId && e.id !== id))
      // Delete from DB — all three are safe even if 0 rows match
      doSave(async () => {
        await deleteRecurring(recId)
        await deleteExpensesByRecurringId(recId)
        return deleteExpense(id)  // safety net for the orphaned expense itself
      })
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id))
      doSave(() => deleteExpense(id))
    }
  }, [user, doSave, expenses, recurring])

  // ── Recurring ────────────────────────────────────────────────────
  const handleRecurringAdd = useCallback(async (item) => {
    if (!user) return
    setRecurring(prev => [...prev, item])
    // Also auto-generate this month's expense
    const ym      = format(new Date(), 'yyyy-MM')
    const day     = String(item.billingDay || 1).padStart(2, '0')
    const newExp  = { id: genId('e'), name: item.name, category: item.category, amount: item.amount, currency: item.currency, date: `${ym}-${day}`, recurringId: item.id, notes: item.notes ?? '' }
    setExpenses(prev => [...prev, newExp])
    doSave(async () => {
      const r1 = await saveOneRecurring(item, user.id)
      if (r1.error) return r1
      return saveExpense(newExp, user.id)
    })
  }, [user, doSave])

  const handleRecurringUpdate = useCallback(async (item) => {
    if (!user) return
    setRecurring(prev => prev.map(r => r.id === item.id ? item : r))
    doSave(() => saveOneRecurring(item, user.id))
  }, [user, doSave])

  const handleRecurringDelete = useCallback(async (id) => {
    if (!user) return
    setRecurring(prev => prev.filter(r => r.id !== id))
    setExpenses(prev => prev.filter(e => e.recurringId !== id))
    doSave(async () => {
      const r1 = await deleteRecurring(id)
      if (r1.error) return r1
      return deleteExpensesByRecurringId(id)
    })
  }, [user, doSave])

  const handleRecurringToggle = useCallback(async (id) => {
    if (!user) return
    let toggled
    setRecurring(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, active: !r.active } : r)
      toggled = updated.find(r => r.id === id)
      return updated
    })
    // Wait for state update, then save
    setTimeout(() => {
      if (toggled) doSave(() => saveOneRecurring(toggled, user.id))
    }, 0)
  }, [user, doSave])

  // ── Screens ──────────────────────────────────────────────────────
  if (loading)               return <LoadingScreen />
  if (authScreen==='reset-form') return <ResetPasswordForm onSuccess={() => setAuthScreen('login')} />
  if (authScreen==='reset')      return <ResetPassword     onBack={()    => setAuthScreen('login')} />
  if (!user)                 return <Login onLoginSuccess={setUser} onForgotPassword={() => setAuthScreen('reset')} />

  return (
    <div className="min-h-screen flex" style={{ background:'var(--bg)' }}>
      {/* Sidebar */}
      <aside className={`sidebar fixed inset-y-0 left-0 z-40 w-52 flex flex-col py-5 px-3 transition-transform duration-200 ${mobileNav?'translate-x-0':'-translate-x-full'} lg:relative lg:translate-x-0`}
        style={{ borderRight:'1px solid var(--sb-border)' }}>
        <div className="px-2 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background:'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
              {(settings.companyName||'C').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">{settings.companyName}</p>
              <p className="text-xs truncate" style={{ color:'var(--sb-text)' }}>{settings.tagline}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} className={`sidebar-item w-full ${tab===t.id?'active':''}`}
              onClick={() => { setTab(t.id); setMobileNav(false) }}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </nav>
        <div className="px-2 pt-4 space-y-1" style={{ borderTop:'1px solid var(--sb-border)' }}>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium" style={{ color:'var(--sb-text)' }} onClick={quickThemeToggle}>
            {settings.theme==='dark' ? <><Sun size={14}/> Light mode</> : <><Moon size={14}/> Dark mode</>}
          </button>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10" onClick={handleLogout}>
            <LogOut size={14}/> Logout
          </button>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-13 flex items-center justify-between px-5 lg:px-6 sticky top-0 z-20"
          style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg" style={{ color:'var(--text-2)' }} onClick={() => setMobileNav(v=>!v)}>
              {mobileNav ? <X size={18}/> : <Menu size={18}/>}
            </button>
            <div>
              <h2 className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{TABS.find(t=>t.id===tab)?.label}</h2>
              <p className="text-xs hidden sm:block" style={{ color:'var(--text-3)' }}>{format(new Date(),'EEEE, d MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(tab==='dashboard'||tab==='expenses') && (
              <button className="btn-primary text-xs" onClick={() => setExpenseModal('add')}>+ Add Expense</button>
            )}

            {/* Save status indicator */}
            {saveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background: saveStatus==='saving' ? 'rgba(59,130,246,0.1)' : saveStatus==='saved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color:      saveStatus==='saving' ? '#3b82f6'               : saveStatus==='saved' ? '#22c55e'              : '#ef4444',
                  border:     saveStatus==='saving' ? '1px solid #3b82f6'     : saveStatus==='saved' ? '1px solid #22c55e'    : '1px solid #ef4444',
                }}>
                {saveStatus === 'saving' && <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/><span>Saving…</span></>}
                {saveStatus === 'saved'  && <><Check size={13}/><span>All changes saved</span></>}
                {saveStatus === 'error'  && <><AlertCircle size={13}/><span>{saveError}</span></>}
              </div>
            )}

            <span className="text-xs" style={{ color:'var(--text-3)' }}>{user?.email}</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-5 lg:p-6 overflow-auto">
          {tab==='dashboard' && <Dashboard     expenses={expenses} recurring={recurring} categories={categories} currencySettings={currencySettings}/>}
          {tab==='expenses'  && <ExpensesTable expenses={expenses} onAdd={()=>setExpenseModal('add')} onEdit={e=>setExpenseModal(e)} onDelete={handleExpenseDelete} categories={categories} currencySettings={currencySettings}/>}
          {tab==='settings'  && <Settings      settings={settings} onSave={handleSettingsSave} onThemeChange={handleThemeChange} categories={categories} onCategoriesSave={handleCategoriesSave} currencySettings={currencySettings} onCurrencySave={handleCurrencySave}/>}
        </main>
      </div>

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal==='add' ? null : expenseModal}
          defaultCurrency={currencySettings.display}
          categories={categories}
          onSave={handleExpenseSave}
          onClose={() => setExpenseModal(null)}
        />
      )}

    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'var(--bg)' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
          style={{ background:'linear-gradient(135deg,#7c3aed,#6366f1)' }}>CC</div>
        <p style={{ color:'var(--text-3)' }}>Loading…</p>
      </div>
    </div>
  )
}
