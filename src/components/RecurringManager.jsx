import { useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, X, Info, Infinity, Calendar, ChevronDown, ChevronRight, Globe } from 'lucide-react'
import { CURRENCIES, genId, getCategoryColor, guessCategory, fmtCurrency, convertToDisplay, groupRecurringItems } from '../data/store'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const DOMAINS_GROUP_ID = '__domains_all__'
const PROJECT_DOMAIN_PARENT = {
  CAE: 'r_domains_cae',
  'Dr Jasmine': 'r_domains_drjasmine',
  Jeff: 'r_domains_jeff',
}

function isDomainParent(item) {
  return !!item?.id?.startsWith('r_domains_')
}

function isDomainChild(item) {
  return !!item?.id?.startsWith('r_domain_') && !item?.id?.startsWith('r_domains_')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>
            {isEdit ? (isDomainChild(item) ? 'Edit Domain' : 'Edit Recurring') : (isDomainAdd ? 'Add Domain' : 'Add Recurring')}
          </h2>
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

          {/* Duration — clean segmented toggle */}
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

function RecurringRow({
  item,
  onEdit,
  onDelete,
  onToggle,
  categories,
  projects,
  indent = false,
  isAddon = false,
  isDomainChild: domainChild = false,
  displayOverride = null,
  hideActions = false,
}) {
  const isExpired = item.endDate && item.endDate < new Date().toISOString().slice(0,10)
  const shownAmount = displayOverride?.amount ?? item.amount
  const shownCurrency = displayOverride?.currency ?? item.currency
  const shownFrequency = displayOverride?.frequency ?? item.frequency
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
        <div className="flex items-center gap-2">
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
          {!item.endDate && !domainChild && <span className="badge" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>∞ Infinite</span>}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color:'var(--text-3)' }}>
          {!domainChild && item.project ? `${item.project} · ` : ''}{item.category} · {shownFrequency === 'yearly'
            ? `${MONTHS[(item.billingMonth || 1) - 1]} ${item.billingDay}`
            : `Day ${item.billingDay}`
          } · {item.endDate ? `Ends ${item.endDate}` : 'No end date'}
          {item.notes ? ` · ${item.notes}` : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{fmtCurrency(shownAmount, shownCurrency)}</p>
        <p className="text-xs" style={{ color:'var(--text-3)' }}>{shownFrequency === 'yearly' ? '/yr' : '/mo'}</p>
      </div>
      {!hideActions && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`pill ${item.active ? 'active' : ''}`}
            title={item.active ? 'Turn off — skip this month' : 'Turn on — charge this month'}
            aria-label={item.active ? 'Turn off subscription' : 'Turn on subscription'}
            onClick={onToggle}
          >
            {item.active ? 'On' : 'Off'}
          </button>
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
  onToggle,
  onAddDomain,
  categories,
  projects,
  currencySettings,
  isDomainGroup = false,
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = children.length > 0
  const display = computeGroupDisplay(parent, children, currencySettings)
  const displayParent = { ...parent, ...display }
  const activeChildCount = children.filter((c) => c.active).length

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
            onToggle={() => onToggle(parent.id)}
            categories={categories}
            projects={projects}
            indent={false}
            hideActions={isDomainGroup}
          />
        </div>
        {isDomainGroup && (
          <div className="flex items-center pr-4 gap-2 flex-shrink-0">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {activeChildCount} active
            </span>
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
      {hasChildren && open && children.map((child) => (
        <RecurringRow
          key={child.id}
          item={child}
          onEdit={() => onEdit(child)}
          onDelete={() => onDelete(child.id)}
          onToggle={() => onToggle(child.id)}
          categories={categories}
          projects={projects}
          indent
          isAddon={!isDomainGroup}
          isDomainChild={isDomainGroup || isDomainChild(child)}
        />
      ))}
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
    const display = computeGroupDisplay(
      { amount: 0, currency: 'USD', frequency: 'yearly', _isDomainGroup: true },
      domainChildren,
      currencySettings
    )
    domainsGroup = {
      id: DOMAINS_GROUP_ID,
      name: `Domains (${domainChildren.length})`,
      amount: display.amount,
      currency: display.currency,
      frequency: 'yearly',
      category: 'Infrastructure',
      active: domainChildren.some((c) => c.active),
      project: null,
      billingDay: 1,
      billingMonth: 1,
      _isDomainGroup: true,
    }
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

export default function RecurringManager({ recurring, onAdd, onUpdate, onDelete, onToggle, categories, projects = [], currencySettings }) {
  const { display } = currencySettings
  const [modal, setModal] = useState(null)
  const { active, inactive, childrenByParent, domainChildren } = partitionRecurringGroups(recurring, currencySettings)
  const activeFlat   = recurring.filter(r => r.active && !isDomainParent(r))
  const inactiveFlat = recurring.filter(r => !r.active && !isDomainParent(r))
  const monthlyActive = activeFlat.filter(r => (r.frequency || 'monthly') === 'monthly')
  const yearlyActive  = activeFlat.filter(r => r.frequency === 'yearly')
  const monthlyTotal  = monthlyActive.reduce((s, r) => s + convertToDisplay(r.amount, r.currency, currencySettings), 0)
  const yearlyTotal   = yearlyActive.reduce((s, r) => s + convertToDisplay(r.amount, r.currency, currencySettings), 0)

  function handleSave(item) { if (modal === 'add' || modal?.preset === 'domain') onAdd(item); else onUpdate(item); setModal(null) }

  function renderGroup(parent) {
    const isDomainGroup = parent._isDomainGroup === true
    const children = isDomainGroup ? domainChildren : (childrenByParent[parent.id] || [])
    return (
      <RecurringGroup
        key={parent.id}
        parent={parent}
        children={children}
        onEdit={(item) => setModal(item)}
        onDelete={onDelete}
        onToggle={onToggle}
        onAddDomain={() => setModal({ preset: 'domain' })}
        categories={categories}
        projects={projects}
        currencySettings={currencySettings}
        isDomainGroup={isDomainGroup}
      />
    )
  }

  return (
    <div className="space-y-4 fade-in">
      {/* How to use */}
      <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background:'var(--accent-dim)', border:'1px solid rgba(124,58,237,0.15)' }}>
        <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:2 }} />
        <p className="text-xs leading-relaxed" style={{ color:'var(--text-2)' }}>
          <span className="font-semibold" style={{ color:'var(--text-1)' }}>How to use: </span>
          Add subscriptions here. Flip <strong>On</strong> or <strong>Off</strong> each month to include or skip a charge. When you open the app, active subscriptions auto-create that month&apos;s expense.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Monthly Cost', value: fmtCurrency(monthlyTotal, display), sub:'/mo', color:'var(--accent)' },
          { label:'Yearly Cost',  value: fmtCurrency(yearlyTotal, display),  sub:'/yr', color:'#f59e0b' },
          { label:'Active',       value:activeFlat.length,           sub:'subscriptions', color:'#22c55e' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="section-label mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold flex items-center gap-2 text-sm" style={{ color:'var(--text-1)' }}>
          <RefreshCw size={14} style={{ color:'var(--accent)' }} /> Subscriptions
        </h2>
        <button className="btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Add Recurring</button>
      </div>

      {/* Active list */}
      {active.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="section-label">Active — auto-generates monthly</span>
          </div>
          {active.map(renderGroup)}
        </div>
      )}

      {/* Paused list */}
      {inactive.length > 0 && (
        <div className="card p-0 overflow-hidden" style={{ opacity:0.7 }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--text-3)' }} />
            <span className="section-label">Paused</span>
          </div>
          {inactive.map(renderGroup)}
        </div>
      )}

      {recurring.length === 0 && (
        <div className="card text-center py-14" style={{ color:'var(--text-3)' }}>
          No recurring items yet. Add your subscriptions like Zoom, Claude, AWS…
        </div>
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
