import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, RefreshCw, X, Info, Infinity, Calendar, ChevronDown, ChevronRight, Globe, Pause, Play, Search, Copy, Download } from 'lucide-react'
import { CURRENCIES, genId, getCategoryColor, guessCategory, fmtCurrency, convertToDisplay, groupRecurringItems, isDomainParent, isDomainChild, getBillingStatus, getSubscriptionRunRates, getThisMonthStats, getUpcomingRenewals, monthlyEquivalent, exportSubscriptionsToCSV } from '../data/store'

const DEFAULT_FILTERS = {
  search: '',
  category: 'All',
  project: 'All',
  status: 'All',
  sort: 'name',
}

function itemMatchesFilters(item, filters) {
  const { search, category, project, status } = filters
  if (search && !item.name.toLowerCase().includes(search.toLowerCase().trim())) return false
  if (category !== 'All' && item.category !== category) return false
  if (project !== 'All') {
    if (project === 'Company-wide') {
      if (item.project != null) return false
    } else if (item.project !== project) {
      return false
    }
  }
  if (status === 'Active' && !item.active) return false
  if (status === 'Paused' && item.active) return false
  return true
}

function hasActiveFilters(filters) {
  return filters.search !== ''
    || filters.category !== 'All'
    || filters.project !== 'All'
    || filters.status !== 'All'
    || filters.sort !== 'name'
}

function applyGroupItemFilter(parent, children, filters) {
  const parentMatches = itemMatchesFilters(parent, filters)
  const matchingChildren = children.filter((c) => itemMatchesFilters(c, filters))
  if (!parentMatches && matchingChildren.length === 0) return null
  return {
    parent,
    children: parentMatches ? children : matchingChildren,
  }
}

function sortGroupParents(parents, sortBy, currencySettings, childrenByParent, domainChildren) {
  const getSortValue = (parent) => {
    const isDomainGroup = parent._isDomainGroup === true
    const children = isDomainGroup ? domainChildren : (childrenByParent[parent.id] || [])
    if (sortBy === 'cost') {
      const display = computeGroupDisplay(parent, children, currencySettings)
      return monthlyEquivalent({ ...parent, amount: display.amount, currency: display.currency, frequency: display.frequency }, currencySettings)
    }
    if (sortBy === 'billing-day') return parent.billingDay || 1
    return parent.name.toLowerCase()
  }
  return [...parents].sort((a, b) => {
    if (sortBy === 'cost') return getSortValue(b) - getSortValue(a)
    if (sortBy === 'billing-day') return getSortValue(a) - getSortValue(b)
    return String(getSortValue(a)).localeCompare(String(getSortValue(b)))
  })
}

function filterThisMonthGroups(groups, filters) {
  const searchOnly = { ...DEFAULT_FILTERS, search: filters.search }
  return groups.map((entry) => {
    if (entry.type === 'standalone') {
      return itemMatchesFilters(entry.item, searchOnly) ? entry : null
    }
    const filtered = applyGroupItemFilter(entry.parent, entry.children, searchOnly)
    if (!filtered) return null
    return { ...entry, parent: filtered.parent, children: filtered.children }
  }).filter(Boolean)
}

function filterAllViewGroups(parents, childrenByParent, domainChildren, filters, currencySettings) {
  const groups = parents.map((parent) => {
    const isDomainGroup = parent._isDomainGroup === true
    const children = isDomainGroup ? domainChildren : (childrenByParent[parent.id] || [])
    return applyGroupItemFilter(parent, children, filters)
  }).filter(Boolean)

  const sortedParents = sortGroupParents(
    groups.map((g) => g.parent),
    filters.sort,
    currencySettings,
    childrenByParent,
    domainChildren,
  )

  return sortedParents.map((parent) => groups.find((g) => g.parent.id === parent.id)).filter(Boolean)
}

function collectDueIdsFromGroups(groups, expenses, now) {
  const ids = []
  for (const entry of groups) {
    if (entry.type === 'standalone') {
      if (getBillingStatus(entry.item, expenses, now).status === 'due') ids.push(entry.item.id)
    } else {
      if (!entry.isDomainGroup && getBillingStatus(entry.parent, expenses, now).status === 'due') {
        ids.push(entry.parent.id)
      }
      for (const child of entry.children) {
        if (getBillingStatus(child, expenses, now).status === 'due') ids.push(child.id)
      }
    }
  }
  return ids
}

function UpcomingRenewalsCard({ renewals }) {
  const cap = 10
  const shown = renewals.slice(0, cap)
  const remaining = renewals.length - shown.length

  if (renewals.length === 0) {
    return (
      <div className="card">
        <p className="section-label mb-2">Upcoming (30 days)</p>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>No renewals in the next 30 days</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-label">Upcoming (30 days)</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border-2)' }}>
        {shown.map(({ item, date }) => (
          <div key={`${item.id}-${date.toISOString()}`} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{item.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {format(date, 'MMM d, yyyy')}
              </p>
            </div>
            <p className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--text-1)' }}>
              {fmtCurrency(item.amount, item.currency)}
            </p>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <p className="px-5 py-2 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border-2)' }}>
          + {remaining} more
        </p>
      )}
    </div>
  )
}

function FilterBar({ filters, onChange, onClear, categories, projects, showFullFilters = true }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              className="input pl-8"
              placeholder="Search by name…"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              aria-label="Search subscriptions"
            />
          </div>
        </div>
        {showFullFilters && (
          <>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Category</label>
              <select className="input" value={filters.category} onChange={(e) => set('category', e.target.value)}>
                <option value="All">All</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Project</label>
              <select className="input" value={filters.project} onChange={(e) => set('project', e.target.value)}>
                <option value="All">All</option>
                <option value="Company-wide">Company-wide</option>
                {projects.map((p) => (
                  <option key={p.id || p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Status</label>
              <select className="input" value={filters.status} onChange={(e) => set('status', e.target.value)}>
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Sort</label>
              <select className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
                <option value="name">Name A–Z</option>
                <option value="cost">Cost high→low</option>
                <option value="billing-day">Billing day</option>
              </select>
            </div>
          </>
        )}
      </div>
      {showFullFilters && hasActiveFilters(filters) && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Filters applied to the list below.</p>
          <button type="button" className="btn-ghost text-xs py-1 px-2" onClick={onClear}>Clear filters</button>
        </div>
      )}
    </div>
  )
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const DOMAINS_GROUP_ID = '__domains_all__'
const PROJECT_DOMAIN_PARENT = {
  CAE: 'r_domains_cae',
  'Dr Jasmine': 'r_domains_drjasmine',
  Jeff: 'r_domains_jeff',
}

const STATUS_BADGE = {
  billed: { label: 'Billed', bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  due: { label: 'Due', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  skipped: { label: 'Skipped', bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  'not-due': { label: 'Not due', bg: 'rgba(100,116,139,0.08)', color: 'var(--text-3)' },
  paused: { label: 'Paused', bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
}

function domainParentIdForProject(project) {
  return PROJECT_DOMAIN_PARENT[project] || 'r_domains_company'
}

function annualDisplayAmount(item, currencySettings) {
  const converted = convertToDisplay(Number(item.amount) || 0, item.currency, currencySettings)
  return (item.frequency || 'monthly') === 'yearly' ? converted : converted * 12
}

function computeGroupDisplay(parent, children, currencySettings) {
  const activeChildren = children.filter((c) => c.active)
  const useChildTotal = parent._isDomainGroup || isDomainParent(parent)
    || (Number(parent.amount) === 0 && children.length > 0)

  if (!useChildTotal) {
    return {
      amount: Number(parent.amount) || 0,
      currency: parent.currency,
      frequency: parent.frequency || 'monthly',
    }
  }

  const yearlyTotal = activeChildren.reduce(
    (sum, child) => sum + annualDisplayAmount(child, currencySettings),
    0
  )
  return {
    amount: yearlyTotal,
    currency: currencySettings.display,
    frequency: 'yearly',
  }
}

function formatBillingDate(item, now = new Date()) {
  const freq = item.frequency || 'monthly'
  const day = item.billingDay || 1
  if (freq === 'yearly') {
    const monthIdx = (item.billingMonth || 1) - 1
    return `${MONTHS[monthIdx].slice(0, 3)} ${day} · yearly`
  }
  const monthIdx = now.getMonth()
  return `${MONTHS[monthIdx].slice(0, 3)} ${day}`
}

function isThisMonthRelevant(item, expenses, now) {
  if (isDomainParent(item)) return false
  const { status } = getBillingStatus(item, expenses, now)
  return ['due', 'billed', 'skipped'].includes(status)
}

function buildDomainsGroup(domainChildren, currencySettings) {
  const display = computeGroupDisplay(
    { amount: 0, currency: 'USD', frequency: 'yearly', _isDomainGroup: true },
    domainChildren,
    currencySettings
  )
  return {
    id: DOMAINS_GROUP_ID,
    name: `Domains (${domainChildren.length})`,
    amount: display.amount,
    currency: display.currency,
    frequency: 'yearly',
    category: 'Infrastructure',
    active: domainChildren.some((c) => c.active),
    project: null,
    billingDay: Math.min(...domainChildren.map((c) => c.billingDay || 1)),
    billingMonth: 1,
    _isDomainGroup: true,
  }
}

function buildThisMonthGroups(recurring, expenses, currencySettings, now = new Date()) {
  const isRelevant = (item) => isThisMonthRelevant(item, expenses, now)

  const domainChildren = recurring
    .filter((r) => isDomainChild(r) && isRelevant(r))
    .sort((a, b) => (a.billingDay || 1) - (b.billingDay || 1) || a.name.localeCompare(b.name))

  const nonDomain = recurring.filter((r) => !isDomainParent(r) && !isDomainChild(r))
  const { parents, childrenByParent, orphans } = groupRecurringItems(nonDomain)

  const entries = []

  if (domainChildren.length > 0) {
    entries.push({
      type: 'group',
      parent: buildDomainsGroup(domainChildren, currencySettings),
      children: domainChildren,
      isDomainGroup: true,
    })
  }

  for (const parent of parents) {
    const allChildren = childrenByParent[parent.id] || []
    const relevantChildren = allChildren.filter(isRelevant)
    const parentRelevant = isRelevant(parent)
    if (parentRelevant || relevantChildren.length > 0) {
      entries.push({
        type: 'group',
        parent,
        children: relevantChildren,
        isDomainGroup: false,
      })
    }
  }

  for (const orphan of orphans) {
    if (isRelevant(orphan)) {
      entries.push({ type: 'standalone', item: orphan })
    }
  }

  entries.sort((a, b) => {
    const sortDay = (entry) => {
      if (entry.type === 'standalone') return entry.item.billingDay || 1
      const days = [entry.parent.billingDay || 1, ...entry.children.map((c) => c.billingDay || 1)]
      return Math.min(...days)
    }
    return sortDay(a) - sortDay(b)
  })

  return entries
}

function RecurringModal({ item, onSave, onClose, categories = [], projects = [], recurring = [], preset = null }) {
  const isEdit = !!item
  const isDomainAdd = preset === 'domain'
  const parentOptions = recurring.filter((r) => !r.parentId && r.id !== item?.id && !isDomainParent(r))
  const defaultForm = isDomainAdd
    ? {
        name: '',
        category: 'Infrastructure',
        amount: '12',
        currency: 'USD',
        project: projects[0]?.name ?? null,
        parentId: domainParentIdForProject(projects[0]?.name),
        billingDay: 1,
        billingMonth: 1,
        frequency: 'yearly',
        notes: '',
        active: true,
        hasEndDate: false,
        endDate: '',
      }
    : {
        name: '',
        category: '',
        amount: '',
        currency: 'MYR',
        project: null,
        parentId: null,
        billingDay: new Date().getDate(),
        billingMonth: new Date().getMonth() + 1,
        frequency: 'monthly',
        notes: '',
        active: true,
        hasEndDate: false,
        endDate: '',
      }
  const [form, setForm] = useState(item
    ? { ...item, project: item.project ?? null, parentId: item.parentId ?? null, hasEndDate: !!item.endDate, endDate: item.endDate ?? '', frequency: item.frequency || 'monthly', billingMonth: item.billingMonth || new Date().getMonth() + 1 }
    : defaultForm
  )
  const [autoCategory, setAutoCategory] = useState(null)

  function set(k,v) { setForm(p => ({ ...p, [k]: v })) }

  function handleNameChange(v) {
    set('name', v)
    if (!isEdit) { const g = guessCategory(v); setAutoCategory(g !== 'Other' ? g : null); set('category', g !== 'Other' ? g : '') }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.amount) return
    const parentId = isDomainAdd
      ? domainParentIdForProject(form.project)
      : (form.parentId || null)
    onSave({
      ...form,
      project: form.project || null,
      parentId,
      id: item?.id ?? (isDomainAdd ? genId('r_domain_') : genId('r')),
      amount: parseFloat(form.amount),
      category: form.category || 'Other',
      endDate: (form.hasEndDate && form.endDate) ? form.endDate : null,
      frequency: form.frequency,
      billingMonth: form.frequency === 'yearly' ? parseInt(form.billingMonth) : 1,
    })
  }

  const modalTitle = isEdit
    ? (isDomainChild(item) ? 'Edit domain' : 'Edit subscription')
    : (isDomainAdd ? 'Add domain' : 'Add subscription')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{modalTitle}</h2>
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border:'none' }} onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Name *</label>
            <input className="input" placeholder={isDomainAdd ? 'e.g. example.com' : 'e.g. Zoom'} value={form.name} onChange={e => handleNameChange(e.target.value)} required autoFocus />
            {autoCategory && !isEdit && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color:'var(--accent)' }}>✦ Auto-detected: <strong>{autoCategory}</strong></p>}
          </div>
          {!isDomainAdd && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Part of</label>
              <select className="input" value={form.parentId || ''} onChange={e => set('parentId', e.target.value || null)}>
                <option value="">Standalone subscription</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>Add-on under: {p.name}</option>
                ))}
              </select>
              {form.parentId && (
                <p className="text-xs mt-1.5" style={{ color:'var(--text-3)' }}>
                  Add-ons group under the parent in Subscriptions and P&amp;L.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Project</label>
            <select
              className="input"
              value={form.project || ''}
              onChange={e => {
                const project = e.target.value || null
                set('project', project)
                if (isDomainAdd) set('parentId', domainParentIdForProject(project))
              }}
            >
              <option value="">Company-wide</option>
              {projects.map(p => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Category *</label>
              <input
                className="input"
                list="rec-category-options"
                placeholder="Pick or type…"
                value={form.category}
                onChange={e => { set('category', e.target.value); setAutoCategory(null) }}
              />
              <datalist id="rec-category-options">
                {categories.map(c => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Currency</label>
              <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Amount *</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Frequency</label>
              <select className="input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className={`grid gap-3 ${form.frequency === 'yearly' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {form.frequency === 'yearly' && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Billing month</label>
                <select className="input" value={form.billingMonth} onChange={e => set('billingMonth', +e.target.value)}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>
                {form.frequency === 'yearly' ? 'Billing day' : 'Charge on day'}
              </label>
              <input className="input" type="number" min="1" max="31" value={form.billingDay} onChange={e => set('billingDay', +e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Notes</label>
            <input className="input" placeholder="Optional..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background:'var(--surface-2)', border:'1px solid var(--border)' }}>
            <label className="block text-xs font-medium" style={{ color:'var(--text-2)' }}>Duration</label>
            <div className="flex rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
              <button type="button"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                style={!form.hasEndDate ? { background:'linear-gradient(135deg,#7c3aed,#6366f1)', color:'white' } : { background:'transparent', color:'var(--text-2)' }}
                onClick={() => set('hasEndDate', false)}>
                <Infinity size={12} /> Ongoing
              </button>
              <button type="button"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                style={form.hasEndDate ? { background:'linear-gradient(135deg,#7c3aed,#6366f1)', color:'white' } : { background:'transparent', color:'var(--text-2)' }}
                onClick={() => set('hasEndDate', true)}>
                <Calendar size={12} /> Set end date
              </button>
            </div>
            {form.hasEndDate && (
              <input className="input text-xs" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            )}
            <p className="text-xs" style={{ color:'var(--text-3)' }}>
              {form.hasEndDate
                ? (form.endDate ? `Stops generating after ${form.endDate}` : 'Pick an end date above')
                : 'Runs every month, no end — change anytime'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">{isEdit ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE['not-due']
  return (
    <span className="badge" style={{ background: badge.bg, color: badge.color }}>
      {badge.label}
    </span>
  )
}

function RecurringRow({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  onBillMonth,
  onPause,
  onResume,
  expenses = [],
  categories,
  projects,
  indent = false,
  isAddon = false,
  isDomainChild: domainChild = false,
  displayOverride = null,
  subtitleOverride = null,
  hideBillToggle = false,
  hideRowActions = false,
  viewMode = 'all',
  now = new Date(),
}) {
  const isExpired = item.endDate && item.endDate < new Date().toISOString().slice(0,10)
  const shownAmount = displayOverride?.amount ?? item.amount
  const shownCurrency = displayOverride?.currency ?? item.currency
  const shownFrequency = displayOverride?.frequency ?? item.frequency
  const billingStatus = getBillingStatus(item, expenses, now)
  const status = billingStatus.status
  const canBillThisMonth = item.active && ['billed', 'due', 'skipped'].includes(status)
  const showBillToggle = !hideBillToggle && canBillThisMonth && (viewMode === 'this-month' || ['due', 'billed', 'skipped'].includes(status))
  const billingThisMonth = status === 'billed' || status === 'due'
  const billingDate = formatBillingDate(item, now)
  const subtitleParts = subtitleOverride
    ? [subtitleOverride]
    : [`${item.category} · ${billingDate}`, ...(item.endDate ? [`Ends ${item.endDate}`] : [])]

  return (
    <div className="flex items-center gap-4 py-4 group transition-colors" style={{
      borderBottom:'1px solid var(--border-2)',
      paddingLeft: indent ? '2.5rem' : '1.25rem',
      paddingRight: '1.25rem',
      background: isAddon ? 'var(--surface-2)' : 'transparent',
    }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
      onMouseLeave={e=>e.currentTarget.style.background=isAddon ? 'var(--surface-2)' : 'transparent'}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: isExpired ? '#64748b' : getCategoryColor(item.category, categories) }}>
        {domainChild ? <Globe size={14} /> : isAddon ? '↳' : item.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color:'var(--text-1)' }}>
            {isAddon && !domainChild ? `↳ ${item.name}` : item.name}
          </p>
          {domainChild && (
            <span className="badge" style={{ background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>
              {item.project || 'Company-wide'}
            </span>
          )}
          {isAddon && !domainChild && <span className="badge" style={{ background:'rgba(20,184,166,0.12)', color:'#14b8a6' }}>Add-on</span>}
          {isExpired && <span className="badge" style={{ background:'rgba(100,116,139,0.1)', color:'#64748b' }}>Expired</span>}
          {!hideBillToggle && <StatusBadge status={status} />}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color:'var(--text-3)' }}>
          {subtitleParts.join(' · ')}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{fmtCurrency(shownAmount, shownCurrency)}</p>
        <p className="text-xs" style={{ color:'var(--text-3)' }}>{shownFrequency === 'yearly' ? '/yr' : '/mo'}</p>
      </div>
      {!hideRowActions && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showBillToggle && (
            <button
              type="button"
              className={`toggle ${billingThisMonth ? 'on' : ''}`}
              title={billingThisMonth ? 'Skip this month' : 'Bill this month'}
              aria-label={billingThisMonth ? 'Skip this month' : 'Bill this month'}
              onClick={() => onBillMonth(item.id, !billingThisMonth)}
            >
              <span className="toggle-thumb" />
            </button>
          )}
          {viewMode === 'all' && item.active && onPause && (
            <button
              type="button"
              className="btn-ghost p-1.5 rounded-lg"
              style={{ border:'none' }}
              title="Pause subscription"
              aria-label="Pause subscription"
              onClick={() => onPause(item.id)}
            >
              <Pause size={13} />
            </button>
          )}
          {viewMode === 'all' && !item.active && onResume && (
            <button
              type="button"
              className="btn-ghost p-1.5 rounded-lg"
              style={{ border:'none' }}
              title="Resume subscription"
              aria-label="Resume subscription"
              onClick={() => onResume(item.id)}
            >
              <Play size={13} />
            </button>
          )}
          {viewMode === 'all' && onDuplicate && (
            <button
              type="button"
              className="btn-ghost p-1.5 rounded-lg"
              style={{ border:'none' }}
              title="Duplicate subscription"
              aria-label="Duplicate subscription"
              onClick={() => onDuplicate(item)}
            >
              <Copy size={13} />
            </button>
          )}
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border:'none' }} title="Edit subscription" aria-label="Edit subscription" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn-danger p-1.5 rounded-lg" style={{ border:'none' }} title="Delete subscription" aria-label="Delete subscription" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  )
}

function RecurringGroup({
  parent,
  children = [],
  onEdit,
  onDelete,
  onDuplicate,
  onBillMonth,
  onPause,
  onResume,
  expenses = [],
  onAddDomain,
  categories,
  projects,
  currencySettings,
  isDomainGroup = false,
  viewMode = 'all',
  now = new Date(),
}) {
  const [open, setOpen] = useState(true)
  const [domainSearch, setDomainSearch] = useState('')
  const hasChildren = children.length > 0
  const display = computeGroupDisplay(parent, children, currencySettings)
  const displayParent = { ...parent, ...display }
  const activeChildCount = children.filter((c) => c.active).length
  const { display: displayCurrency } = currencySettings

  const domainSubtitle = isDomainGroup
    ? `${fmtCurrency(
        children.filter((c) => c.active).reduce((sum, c) => sum + monthlyEquivalent(c, currencySettings), 0),
        displayCurrency,
      )}/mo · ${children.length} domains · ${activeChildCount} active`
    : null

  const visibleChildren = isDomainGroup && domainSearch.trim()
    ? children.filter((c) => {
        const q = domainSearch.toLowerCase().trim()
        const projectLabel = (c.project || 'Company-wide').toLowerCase()
        return c.name.toLowerCase().includes(q) || projectLabel.includes(q)
      })
    : children

  return (
    <div>
      <div className="flex items-stretch" style={{ borderBottom: hasChildren ? 'none' : '1px solid var(--border-2)' }}>
        {hasChildren && (
          <button
            type="button"
            className="px-3 flex items-center"
            style={{ border: 'none', background: 'transparent', color: 'var(--accent)' }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse group' : 'Expand group'}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <RecurringRow
            item={displayParent}
            onEdit={() => onEdit(parent)}
            onDelete={() => onDelete(parent.id)}
            onDuplicate={onDuplicate}
            onBillMonth={onBillMonth}
            onPause={onPause}
            onResume={onResume}
            expenses={expenses}
            categories={categories}
            projects={projects}
            indent={false}
            subtitleOverride={domainSubtitle}
            hideBillToggle={isDomainGroup}
            hideRowActions={isDomainGroup}
            viewMode={viewMode}
            now={now}
          />
        </div>
        {isDomainGroup && (
          <div className="flex items-center pr-4 gap-2 flex-shrink-0">
            <button
              type="button"
              className="btn-primary text-xs py-1.5 px-3"
              onClick={onAddDomain}
            >
              <Plus size={12} /> Add domain
            </button>
          </div>
        )}
      </div>
      {hasChildren && open && isDomainGroup && (
        <div className="px-5 py-2" style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              className="input text-xs pl-8"
              placeholder="Search domains…"
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
              aria-label="Search domains"
            />
          </div>
        </div>
      )}
      {hasChildren && open && visibleChildren.length > 0 && visibleChildren.map((child) => (
        <RecurringRow
          key={child.id}
          item={child}
          onEdit={() => onEdit(child)}
          onDelete={() => onDelete(child.id)}
          onDuplicate={onDuplicate}
          onBillMonth={onBillMonth}
          onPause={onPause}
          onResume={onResume}
          expenses={expenses}
          categories={categories}
          projects={projects}
          indent
          isAddon={!isDomainGroup}
          isDomainChild={isDomainGroup || isDomainChild(child)}
          viewMode={viewMode}
          now={now}
        />
      ))}
      {hasChildren && open && isDomainGroup && domainSearch.trim() && visibleChildren.length === 0 && (
        <div className="py-6 text-center text-xs" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border-2)' }}>
          No domains match
        </div>
      )}
    </div>
  )
}

function partitionRecurringGroups(recurring, currencySettings) {
  const { parents, childrenByParent, orphans } = groupRecurringItems(recurring)
  const domainChildren = recurring
    .filter(isDomainChild)
    .sort((a, b) => {
      const projectA = a.project || 'Company-wide'
      const projectB = b.project || 'Company-wide'
      return projectA.localeCompare(projectB) || a.name.localeCompare(b.name)
    })

  const cleanedChildrenByParent = {}
  for (const [parentId, kids] of Object.entries(childrenByParent)) {
    if (isDomainParent({ id: parentId })) continue
    const filtered = kids.filter((k) => !isDomainChild(k))
    if (filtered.length > 0) cleanedChildrenByParent[parentId] = filtered
  }

  const nonDomainParents = parents.filter((p) => !isDomainParent(p))
  const nonDomainOrphans = orphans.filter((o) => !isDomainChild(o))
  const topLevel = [...nonDomainParents, ...nonDomainOrphans]

  let domainsGroup = null
  if (domainChildren.length > 0) {
    domainsGroup = buildDomainsGroup(domainChildren, currencySettings)
  }

  function groupIsActive(parent) {
    if (parent._isDomainGroup) return domainChildren.some((c) => c.active)
    const kids = cleanedChildrenByParent[parent.id] || []
    return parent.active || kids.some((c) => c.active)
  }

  const active = topLevel.filter(groupIsActive)
  const inactive = topLevel.filter((p) => !groupIsActive(p))

  if (domainsGroup) {
    if (domainsGroup.active) active.unshift(domainsGroup)
    else inactive.unshift(domainsGroup)
  }

  return { active, inactive, childrenByParent: cleanedChildrenByParent, domainChildren, domainsGroup }
}

export default function RecurringManager({ recurring, expenses = [], onAdd, onUpdate, onDelete, onBillMonth, onBulkSkipDue, onPause, onResume, askConfirm, categories, projects = [], currencySettings }) {
  const { display } = currencySettings
  const [modal, setModal] = useState(null)
  const [viewTab, setViewTab] = useState('this-month')
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const now = new Date()
  const { active, inactive, childrenByParent, domainChildren } = partitionRecurringGroups(recurring, currencySettings)
  const thisMonthGroups = buildThisMonthGroups(recurring, expenses, currencySettings, now)
  const filteredThisMonthGroups = filterThisMonthGroups(thisMonthGroups, filters)
  const filteredActiveGroups = filterAllViewGroups(active, childrenByParent, domainChildren, filters, currencySettings)
  const filteredInactiveGroups = filterAllViewGroups(inactive, childrenByParent, domainChildren, filters, currencySettings)
  const runRates = getSubscriptionRunRates(recurring, currencySettings)
  const monthStats = getThisMonthStats(recurring, expenses, currencySettings, now)
  const upcomingRenewals = getUpcomingRenewals(recurring, now)
  const filtersActive = hasActiveFilters(filters)
  const allViewEmpty = filteredActiveGroups.length === 0 && filteredInactiveGroups.length === 0 && recurring.length > 0
  const monthSubheader = [
    monthStats.monthLabel,
    `${monthStats.dueCount} due`,
    `${monthStats.billedCount} billed`,
    ...(monthStats.skippedCount > 0 ? [`${monthStats.skippedCount} skipped`] : []),
  ].join(' · ')
  const thisMonthCounts = [
    `${monthStats.dueCount} due`,
    `${monthStats.billedCount} billed`,
    ...(monthStats.skippedCount > 0 ? [`${monthStats.skippedCount} skipped`] : []),
  ].join(' · ')

  function handleSave(item) { if (modal === 'add' || modal?.preset === 'domain') onAdd(item); else onUpdate(item); setModal(null) }

  function handleDuplicate(item) {
    const copy = {
      ...item,
      id: isDomainChild(item) ? genId('r_domain_') : genId('r'),
      name: `${item.name} (copy)`,
      skippedMonths: [],
    }
    onAdd(copy)
  }

  async function handleBulkSkip() {
    const dueIds = collectDueIdsFromGroups(filteredThisMonthGroups, expenses, now)
    if (dueIds.length === 0 || !askConfirm || !onBulkSkipDue) return
    const confirmed = await askConfirm({
      title: 'Skip all unbilled?',
      message: `Skip ${dueIds.length} due subscription${dueIds.length === 1 ? '' : 's'} for ${monthStats.monthLabel}? No expenses will be created for this month.`,
      confirmLabel: 'Skip all',
    })
    if (confirmed) onBulkSkipDue(dueIds)
  }

  function handleExportCsv() {
    exportSubscriptionsToCSV(recurring, `subscriptions-${format(now, 'yyyy-MM-dd')}.csv`)
  }

  function renderAllGroup(group) {
    const { parent, children } = group
    const isDomainGroup = parent._isDomainGroup === true
    return (
      <RecurringGroup
        key={parent.id}
        parent={parent}
        children={children}
        onEdit={(item) => setModal(item)}
        onDelete={onDelete}
        onDuplicate={handleDuplicate}
        onBillMonth={onBillMonth}
        onPause={onPause}
        onResume={onResume}
        expenses={expenses}
        onAddDomain={() => setModal({ preset: 'domain' })}
        categories={categories}
        projects={projects}
        currencySettings={currencySettings}
        isDomainGroup={isDomainGroup}
        viewMode="all"
        now={now}
      />
    )
  }

  function renderThisMonthEntry(entry) {
    if (entry.type === 'standalone') {
      return (
        <RecurringRow
          key={entry.item.id}
          item={entry.item}
          onEdit={() => setModal(entry.item)}
          onDelete={() => onDelete(entry.item.id)}
          onDuplicate={handleDuplicate}
          onBillMonth={onBillMonth}
          expenses={expenses}
          categories={categories}
          projects={projects}
          viewMode="this-month"
          now={now}
        />
      )
    }
    return (
      <RecurringGroup
        key={entry.parent.id}
        parent={entry.parent}
        children={entry.children}
        onEdit={(item) => setModal(item)}
        onDelete={onDelete}
        onDuplicate={handleDuplicate}
        onBillMonth={onBillMonth}
        expenses={expenses}
        onAddDomain={() => setModal({ preset: 'domain' })}
        categories={categories}
        projects={projects}
        currencySettings={currencySettings}
        isDomainGroup={entry.isDomainGroup}
        viewMode="this-month"
        now={now}
      />
    )
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background:'var(--accent-dim)', border:'1px solid rgba(124,58,237,0.15)' }}>
        <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:2 }} />
        <p className="text-xs leading-relaxed" style={{ color:'var(--text-2)' }}>
          <span className="font-semibold" style={{ color:'var(--text-1)' }}>How to use: </span>
          Add subscriptions here. Use the <strong>bill toggle</strong> to include or skip the current charge; use <strong>pause</strong> (All subscriptions view) for long-term cancellations. Active subscriptions auto-create due expenses when you open the app.
        </p>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-semibold flex items-center gap-2 text-sm" style={{ color:'var(--text-1)' }}>
            <RefreshCw size={14} style={{ color:'var(--accent)' }} /> Subscriptions
          </h2>
          <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>{monthSubheader}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={handleExportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Add subscription</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Monthly run rate', value: fmtCurrency(runRates.monthly, display), sub:'/mo equivalent', color:'var(--accent)' },
          { label:'Annual run rate',  value: fmtCurrency(runRates.annual, display),  sub:'/yr equivalent', color:'#f59e0b' },
          { label:'This month',       value: thisMonthCounts, sub:`${fmtCurrency(monthStats.dueAmount, display)} due`, color:'#22c55e' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="section-label mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <UpcomingRenewalsCard renewals={upcomingRenewals} />

      <div className="flex gap-2">
        <button
          type="button"
          className={`pill ${viewTab === 'this-month' ? 'active' : ''}`}
          onClick={() => setViewTab('this-month')}
        >
          This month
        </button>
        <button
          type="button"
          className={`pill ${viewTab === 'all' ? 'active' : ''}`}
          onClick={() => setViewTab('all')}
        >
          All subscriptions
        </button>
      </div>

      {(viewTab === 'all' || viewTab === 'this-month') && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters({ ...DEFAULT_FILTERS })}
          categories={categories}
          projects={projects}
          showFullFilters={viewTab === 'all'}
        />
      )}

      {viewTab === 'this-month' && (
        filteredThisMonthGroups.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="section-label">Billing this month</span>
              </div>
              {monthStats.dueCount > 0 && onBulkSkipDue && askConfirm && (
                <button type="button" className="btn-ghost text-xs py-1 px-2" onClick={handleBulkSkip}>
                  Skip all unbilled
                </button>
              )}
            </div>
            {filteredThisMonthGroups.map(renderThisMonthEntry)}
          </div>
        ) : (
          <div className="card text-center py-14" style={{ color:'var(--text-3)' }}>
            <p className="text-sm">No subscriptions bill this month</p>
            <p className="text-xs mt-2">
              {filters.search ? (
                <>No matches for your search. <button type="button" className="underline" style={{ color: 'var(--accent)' }} onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear search</button></>
              ) : (
                <>Check <button type="button" className="underline" style={{ color: 'var(--accent)' }} onClick={() => setViewTab('all')}>All subscriptions</button> for the full catalog.</>
              )}
            </p>
          </div>
        )
      )}

      {viewTab === 'all' && (
        <>
          {filteredActiveGroups.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="section-label">Active</span>
              </div>
              {filteredActiveGroups.map(renderAllGroup)}
            </div>
          )}

          {filteredInactiveGroups.length > 0 && (
            <div className="card p-0 overflow-hidden" style={{ opacity:0.7 }}>
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--text-3)' }} />
                <span className="section-label">Paused / cancelled</span>
              </div>
              {filteredInactiveGroups.map(renderAllGroup)}
            </div>
          )}

          {recurring.length === 0 && (
            <div className="card text-center py-14" style={{ color:'var(--text-3)' }}>
              No subscriptions yet. Add your subscriptions like Zoom, Claude, AWS…
            </div>
          )}

          {allViewEmpty && filtersActive && (
            <div className="card text-center py-14" style={{ color:'var(--text-3)' }}>
              <p className="text-sm">No subscriptions match your filters</p>
              <p className="text-xs mt-2">
                Try adjusting search, category, project, or status.{' '}
                <button type="button" className="underline" style={{ color: 'var(--accent)' }} onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Clear filters</button>
              </p>
            </div>
          )}
        </>
      )}

      {modal && (
        <RecurringModal
          item={modal === 'add' || modal?.preset === 'domain' ? null : modal}
          preset={modal?.preset ?? null}
          onSave={handleSave}
          onClose={() => setModal(null)}
          categories={categories}
          projects={projects}
          recurring={recurring}
        />
      )}
    </div>
  )
}
