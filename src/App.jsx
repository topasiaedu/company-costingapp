import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { LayoutDashboard, List, RefreshCw, Settings as SettingsIcon, Menu, X, Sun, Moon, LogOut, AlertCircle, Check, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import ConfirmDialog from './components/ConfirmDialog'
import EmptyState from './components/EmptyState'
import Dashboard from './components/Dashboard'
import ExpensesTable from './components/ExpensesTable'
import ExpenseModal from './components/ExpenseModal'
import RecurringManager from './components/RecurringManager'
import Settings from './components/Settings'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import ResetPasswordForm from './components/ResetPasswordForm'
import ImportModal from './components/ImportModal'
import ProjectPnl from './components/ProjectPnl'
import { genId, DEFAULT_CATEGORIES, DEFAULT_CURRENCY_SETTINGS, DEFAULT_SETTINGS, DEFAULT_PROJECTS, EXPENSE_TYPES, EXPENSE_NOTE_ANNUAL_INVOICE } from './data/store'
import {
  isSupabaseConfigured,
  getCurrentUser, signOut,
  loadExpenses, saveExpense, deleteExpense, deleteExpensesByRecurringId,
  loadRecurring, saveOneRecurring, deleteRecurring,
  loadSettings, saveSettings,
  loadCategories, saveCategories,
  loadCurrencySettings, saveCurrencySettings,
  loadProjects, saveProjects,
  saveExpensesBatch, saveRecurringBatch,
  deleteAllUserExpenses, deleteAllUserRecurring,
} from './data/supabase'

// Auto-generate this month's expenses for active recurring items
function applyRecurring(expenses, recurring) {
  const now          = new Date()
  const ym           = format(now, 'yyyy-MM')
  const currentMonth = now.getMonth() + 1  // 1-12
  let changed = false
  const result = [...expenses]
  for (const r of recurring) {
    if (!r.active) continue
    if (!r.amount || Number(r.amount) <= 0) continue
    if (r.endDate && r.endDate < `${ym}-01`) continue
    const freq = r.frequency || 'monthly'
    // Yearly items only generate in their billing month
    if (freq === 'yearly' && (r.billingMonth || 1) !== currentMonth) continue
    const day     = String(r.billingDay || 1).padStart(2, '0')
    const dateStr = `${ym}-${day}`
    const year    = ym.slice(0, 4)
    const alreadyBilled = freq === 'yearly'
      ? result.some(e => e.recurringId === r.id && e.date?.startsWith(year))
      : result.some(e => e.recurringId === r.id && e.date?.startsWith(ym))
    if (!alreadyBilled) {
      const notes = freq === 'yearly' ? EXPENSE_NOTE_ANNUAL_INVOICE : (r.notes ?? '')
      result.push({ id: genId('e'), name: r.name, category: r.category, amount: r.amount, currency: r.currency, date: dateStr, project: r.project || null, expenseType: EXPENSE_TYPES.SUBSCRIPTION, recurringId: r.id, notes })
      changed = true
    }
  }
  return { result, changed }
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'expenses',  label: 'Expenses',  icon: List },
  { id: 'pnl',       label: 'P&L Report', icon: FileSpreadsheet },
  { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { id: 'settings',  label: 'Settings',  icon: SettingsIcon },
]

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export default function App() {
  const [user,             setUser]             = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [authScreen,       setAuthScreen]       = useState('login')
  const [tab,              setTab]              = useState('dashboard')
  const [expenses,         setExpenses]         = useState([])
  const [recurring,        setRecurring]        = useState([])
  const [settings,         setSettings]         = useState(DEFAULT_SETTINGS)
  const [categories,       setCategories]       = useState(DEFAULT_CATEGORIES)
  const [projects,         setProjects]         = useState(DEFAULT_PROJECTS)
  const [currencySettings, setCurrencySettings] = useState(DEFAULT_CURRENCY_SETTINGS)
  const [expenseModal, setExpenseModal] = useState(null)
  const [importModal,  setImportModal]  = useState(false)
  const [mobileNav,    setMobileNav]    = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [saveStatus,       setSaveStatus]       = useState('idle')
  const [saveError,        setSaveError]        = useState('')
  const [confirmDialog,    setConfirmDialog]    = useState(null)
  const confirmResolveRef = useRef(null)

  const askConfirm = useCallback(({ title, message, confirmLabel }) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve
      setConfirmDialog({ title, message, confirmLabel })
    })
  }, [])

  const closeConfirm = useCallback((confirmed) => {
    confirmResolveRef.current?.(confirmed)
    confirmResolveRef.current = null
    setConfirmDialog(null)
  }, [])

  // Auto-hide save status after 2s (saved) or 5s (error)
  useEffect(() => {
    if (saveStatus === 'idle') return
    const t = setTimeout(() => setSaveStatus('idle'), saveStatus === 'error' ? 5000 : 2000)
    return () => clearTimeout(t)
  }, [saveStatus])

  // Check session on mount
  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }
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

        const [settingsRes, catsRes, currencyRes, recurringRes, expensesRes, projectsRes] = await Promise.all([
          loadSettings(user.id),
          loadCategories(user.id),
          loadCurrencySettings(user.id),
          loadRecurring(user.id),
          loadExpenses(user.id),
          loadProjects(user.id),
        ])

        // First-login bootstrap: seed defaults once when tables are empty (never overwrite)
        const nextSettings = settingsRes.data || DEFAULT_SETTINGS
        const nextCategories = catsRes.data?.length > 0
          ? catsRes.data.map(c => ({ id: c.id, name: c.name, color: c.color }))
          : DEFAULT_CATEGORIES.map(c => ({ id: genId('cat'), name: c.name, color: c.color }))
        const nextProjects = projectsRes.data?.length > 0
          ? projectsRes.data.map(p => ({ id: p.id, name: p.name, color: p.color }))
          : DEFAULT_PROJECTS.map(p => ({ id: genId('proj'), name: p.name, color: p.color }))
        const nextCurrency = currencyRes.data || { ...DEFAULT_CURRENCY_SETTINGS }

        setSettings(nextSettings)
        setCategories(nextCategories)
        setProjects(nextProjects)
        setCurrencySettings(nextCurrency)

        if (!settingsRes.data) await saveSettings(nextSettings, user.id)
        if (!(catsRes.data?.length > 0)) await saveCategories(nextCategories, user.id)
        if (!(projectsRes.data?.length > 0)) await saveProjects(nextProjects, user.id)
        if (!currencyRes.data) await saveCurrencySettings(nextCurrency, user.id)

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      // ignore storage errors
    }
  }, [sidebarCollapsed])

  const toggleSidebarCollapsed = () => setSidebarCollapsed(v => !v)

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
  const handleProjectsSave = useCallback((projs) => { setProjects(projs); doSave(() => saveProjects(projs, user.id)) }, [user, doSave])
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

    // Case 2: editing an existing recurring expense — auto-sync the template
    else if (saved.isRecurring && saved.recurringId) {
      const template = recurring.find(r => r.id === saved.recurringId)
      if (template) {
        const updated = { ...template, name: saved.name, category: saved.category, amount: saved.amount, currency: saved.currency, project: saved.project || null, notes: saved.notes || '', frequency: saved.frequency || 'monthly', billingDay: saved.billingDay || template.billingDay, billingMonth: saved.billingMonth || template.billingMonth }
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
    if (!expense) return

    if (expense.recurringId && recurring.some(r => r.id === expense.recurringId)) {
      const confirmed = await askConfirm({
        title: 'Delete this charge?',
        message: `Remove "${expense.name}" for ${expense.date}?\n\nThe subscription stays active — only this month's expense is deleted.`,
        confirmLabel: 'Delete expense',
      })
      if (!confirmed) return
    }

    setExpenses(prev => prev.filter(e => e.id !== id))
    doSave(() => deleteExpense(id))
  }, [user, doSave, expenses, recurring, askConfirm])

  // ── Recurring ────────────────────────────────────────────────────
  const handleRecurringAdd = useCallback(async (item) => {
    if (!user) return
    setRecurring(prev => [...prev, item])
    // Auto-generate this month's expense only if applicable
    const freq         = item.frequency || 'monthly'
    const currentMonth = new Date().getMonth() + 1
    const shouldGenerate = freq === 'monthly' || (freq === 'yearly' && (item.billingMonth || 1) === currentMonth)
    let newExp = null
    if (shouldGenerate) {
      const ym  = format(new Date(), 'yyyy-MM')
      const day = String(item.billingDay || 1).padStart(2, '0')
      const notes = freq === 'yearly' ? EXPENSE_NOTE_ANNUAL_INVOICE : (item.notes ?? '')
      newExp = { id: genId('e'), name: item.name, category: item.category, amount: item.amount, currency: item.currency, project: item.project || null, expenseType: EXPENSE_TYPES.SUBSCRIPTION, date: `${ym}-${day}`, recurringId: item.id, notes }
      setExpenses(prev => [...prev, newExp])
    }
    doSave(async () => {
      const r1 = await saveOneRecurring(item, user.id)
      if (r1.error) return r1
      if (newExp) return saveExpense(newExp, user.id)
      return { error: null }
    })
  }, [user, doSave])

  const handleRecurringUpdate = useCallback(async (item) => {
    if (!user) return
    setRecurring(prev => prev.map(r => r.id === item.id ? item : r))
    doSave(() => saveOneRecurring(item, user.id))
  }, [user, doSave])

  const handleRecurringDelete = useCallback(async (id) => {
    if (!user) return
    const item = recurring.find(r => r.id === id)
    const confirmed = await askConfirm({
      title: 'Delete subscription?',
      message: `Delete "${item?.name || 'this subscription'}" and all linked expense history?`,
      confirmLabel: 'Delete all',
    })
    if (!confirmed) return
    setRecurring(prev => prev.filter(r => r.id !== id))
    setExpenses(prev => prev.filter(e => e.recurringId !== id))
    doSave(async () => {
      const r1 = await deleteRecurring(id)
      if (r1.error) return r1
      return deleteExpensesByRecurringId(id)
    })
  }, [user, doSave, recurring, askConfirm])

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

  // ── Import ──────────────────────────────────────────────────────
  const handleImport = useCallback(async ({ expenses: newExpenses, recurring: newRecurring, mode }) => {
    if (!user) return
    setSaveStatus('saving')
    try {
      const importProjectNames = [...new Set([
        ...newExpenses.map(e => e.project),
        ...newRecurring.map(r => r.project),
      ].filter(Boolean))]

      let updatedProjects = [...projects]
      for (const name of importProjectNames) {
        if (!updatedProjects.find(p => p.name === name)) {
          updatedProjects.push({ id: genId('proj'), name, color: '#6366f1' })
        }
      }
      if (updatedProjects.length > projects.length) {
        await saveProjects(updatedProjects, user.id)
        setProjects(updatedProjects)
      }

      if (mode === 'replace') {
        await deleteAllUserExpenses(user.id)
        await deleteAllUserRecurring(user.id)
        setExpenses([])
        setRecurring([])
      }
      const r1 = await saveRecurringBatch(newRecurring, user.id)
      if (r1.error) throw r1.error
      const r2 = await saveExpensesBatch(newExpenses, user.id)
      if (r2.error) throw r2.error
      if (mode === 'replace') {
        setExpenses(newExpenses)
        setRecurring(newRecurring)
      } else {
        setExpenses(prev => [...prev, ...newExpenses])
        setRecurring(prev => [...prev, ...newRecurring])
      }
      setSaveStatus('saved')
    } catch (err) {
      const msg = err?.message || 'Import failed'
      setSaveError(msg)
      setSaveStatus('error')
      throw err
    }
  }, [user, projects])

  // ── Screens ──────────────────────────────────────────────────────
  if (!isSupabaseConfigured) return <MissingConfigScreen />
  if (loading)               return <LoadingScreen />
  if (authScreen==='reset-form') return <ResetPasswordForm onSuccess={() => setAuthScreen('login')} />
  if (authScreen==='reset')      return <ResetPassword     onBack={()    => setAuthScreen('login')} />
  if (!user)                 return <Login onLoginSuccess={setUser} onForgotPassword={() => setAuthScreen('reset')} />

  const isEmpty = expenses.length === 0 && recurring.length === 0
  const showEmptyState = isEmpty && (tab === 'dashboard' || tab === 'expenses' || tab === 'pnl')

  return (
    <div className="h-screen flex overflow-hidden" style={{ background:'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 h-screen flex flex-col py-5 overflow-y-auto transition-all duration-200 w-52 px-3 ${mobileNav ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-16 lg:px-2 collapsed' : 'lg:w-52 lg:px-3'}`}
        style={{ borderRight: '1px solid var(--sb-border)' }}
      >
        <div className={`mb-6 ${sidebarCollapsed ? 'px-0' : 'px-2'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-2.5'}`}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}
              title={sidebarCollapsed ? settings.companyName : undefined}
            >
              {(settings.companyName || 'C').charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight truncate">{settings.companyName}</p>
                <p className="text-xs truncate" style={{ color: 'var(--sb-text)' }}>{settings.tagline}</p>
              </div>
            )}
            <button
              type="button"
              className="hidden lg:flex p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-white/10"
              style={{ color: 'var(--sb-text)' }}
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-px">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`sidebar-item w-full ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setMobileNav(false) }}
              title={sidebarCollapsed ? t.label : undefined}
              aria-label={t.label}
            >
              <t.icon size={15} className="flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{t.label}</span>}
            </button>
          ))}
        </nav>
        <div className={`pt-3 space-y-0.5 ${sidebarCollapsed ? 'px-0' : 'px-2'}`} style={{ borderTop: '1px solid var(--sb-border)' }}>
          {user?.email && !sidebarCollapsed && (
            <p className="px-2 py-1.5 text-[10px] truncate" style={{ color: 'var(--sb-text-muted)' }} title={user.email}>
              {user.email}
            </p>
          )}
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium sidebar-footer-btn"
            onClick={quickThemeToggle}
            title={settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {settings.theme === 'dark' ? <Sun size={14} className="flex-shrink-0" /> : <Moon size={14} className="flex-shrink-0" />}
            {!sidebarCollapsed && (settings.theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>
          <button
            type="button"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 ${sidebarCollapsed ? 'justify-center' : ''}`}
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={14} className="flex-shrink-0" />
            {!sidebarCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {mobileNav && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />}

      <div className={`flex-1 flex flex-col min-w-0 min-h-0 transition-[margin] duration-200 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-52'}`}>
        {/* Header */}
        <header className="min-h-[3.25rem] h-14 flex items-center justify-between px-5 lg:px-6 flex-shrink-0 z-20"
          style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden p-2 rounded-lg flex-shrink-0" style={{ color:'var(--text-2)' }} onClick={() => setMobileNav(v=>!v)}>
              {mobileNav ? <X size={18}/> : <Menu size={18}/>}
            </button>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate" style={{ color:'var(--text-1)' }}>{TABS.find(t=>t.id===tab)?.label}</h2>
              {tab === 'pnl' && (
                <p className="text-[10px] truncate hidden sm:block" style={{ color:'var(--text-3)' }}>
                  Tech Department P&amp;L — costs by project and month
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(tab==='dashboard'||tab==='expenses') && !showEmptyState && (
              <button className="btn-primary text-xs" onClick={() => setExpenseModal('add')}>+ Add Expense</button>
            )}

            {saveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                style={{
                  background: saveStatus==='saving' ? 'rgba(59,130,246,0.1)' : saveStatus==='saved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color:      saveStatus==='saving' ? '#3b82f6'               : saveStatus==='saved' ? '#22c55e'              : '#ef4444',
                  border:     saveStatus==='saving' ? '1px solid #3b82f6'     : saveStatus==='saved' ? '1px solid #22c55e'    : '1px solid #ef4444',
                }}>
                {saveStatus === 'saving' && <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/><span className="hidden sm:inline">Saving…</span></>}
                {saveStatus === 'saved'  && <><Check size={13}/><span className="hidden sm:inline">Saved</span></>}
                {saveStatus === 'error'  && <><AlertCircle size={13}/><span className="max-w-[8rem] truncate sm:max-w-none">{saveError}</span></>}
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-5 lg:p-6 overflow-y-auto min-h-0">
          {showEmptyState ? (
            <EmptyState
              onImport={() => setImportModal(true)}
              onAddExpense={() => setExpenseModal('add')}
            />
          ) : (
            <>
          {tab==='dashboard' && <Dashboard expenses={expenses} recurring={recurring} categories={categories} projects={projects} currencySettings={currencySettings} onImport={()=>setImportModal(true)} onAdd={()=>setExpenseModal('add')}/>}
          {tab==='expenses'  && <ExpensesTable expenses={expenses} recurring={recurring} projects={projects} onAdd={()=>setExpenseModal('add')} onEdit={e=>setExpenseModal(e)} onDelete={handleExpenseDelete} onImport={()=>setImportModal(true)} categories={categories} currencySettings={currencySettings}/>}
          {tab==='pnl'       && <ProjectPnl expenses={expenses} recurring={recurring} projects={projects} currencySettings={currencySettings} onImport={()=>setImportModal(true)} onAdd={()=>setExpenseModal('add')}/>}
              {tab==='subscriptions' && <RecurringManager recurring={recurring} onAdd={handleRecurringAdd} onUpdate={handleRecurringUpdate} onDelete={handleRecurringDelete} onToggle={handleRecurringToggle} categories={categories} projects={projects} currencySettings={currencySettings}/>}
              {tab==='settings'  && <Settings settings={settings} onSave={handleSettingsSave} onThemeChange={handleThemeChange} categories={categories} onCategoriesSave={handleCategoriesSave} projects={projects} onProjectsSave={handleProjectsSave} currencySettings={currencySettings} onCurrencySave={handleCurrencySave} onImport={()=>setImportModal(true)}/>}
            </>
          )}
        </main>
      </div>

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal==='add' ? null : expenseModal}
          defaultCurrency={currencySettings.display}
          categories={categories}
          projects={projects}
          onSave={handleExpenseSave}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {importModal && (
        <ImportModal
          projects={projects}
          onClose={() => setImportModal(false)}
          onImport={handleImport}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
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

function MissingConfigScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:'var(--bg)' }}>
      <div className="max-w-md w-full rounded-xl p-6" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold mb-4"
          style={{ background:'linear-gradient(135deg,#7c3aed,#6366f1)' }}>CC</div>
        <h1 className="text-lg font-semibold mb-2" style={{ color:'var(--text)' }}>Missing Supabase config</h1>
        <p className="text-sm mb-4" style={{ color:'var(--text-2)' }}>
          Set <code className="text-xs">VITE_SUPABASE_URL</code> and <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> in a <code className="text-xs">.env</code> file (see <code className="text-xs">.env.example</code>), then restart the dev server.
        </p>
        <p className="text-xs" style={{ color:'var(--text-3)' }}>
          For Vercel, add the same variables in Project Settings → Environment Variables.
        </p>
      </div>
    </div>
  )
}
