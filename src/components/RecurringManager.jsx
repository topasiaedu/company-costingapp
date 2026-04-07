import { useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, X, Power, Info, Infinity, Calendar } from 'lucide-react'
import { CURRENCIES, genId, getCategoryColor, guessCategory, fmtCurrency } from '../data/store'

function RecurringModal({ item, onSave, onClose, categories = [] }) {
  const isEdit = !!item
  const [form, setForm] = useState(item
    ? { ...item, hasEndDate: !!item.endDate, endDate: item.endDate ?? '' }
    : { name:'', category:'', amount:'', currency:'USD', billingDay:1, notes:'', active:true, hasEndDate:false, endDate:'' }
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
    onSave({ ...form, id: item?.id ?? genId('r'), amount: parseFloat(form.amount), category: form.category || 'Other', endDate: (form.hasEndDate && form.endDate) ? form.endDate : null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{isEdit ? 'Edit Recurring' : 'Add Recurring'}</h2>
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border:'none' }} onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Name *</label>
            <input className="input" placeholder="e.g. Zoom" value={form.name} onChange={e => handleNameChange(e.target.value)} required autoFocus />
            {autoCategory && !isEdit && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color:'var(--accent)' }}>✦ Auto-detected: <strong>{autoCategory}</strong></p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>Category *</label>
              {/* datalist = dropdown suggestions + free-type custom */}
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
              <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-2)' }}>
                Charge on day
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

function RecurringRow({ item, onEdit, onDelete, onToggle, categories }) {
  const isExpired = item.endDate && item.endDate < new Date().toISOString().slice(0,10)
  return (
    <div className="flex items-center gap-4 px-5 py-4 group transition-colors" style={{ borderBottom:'1px solid var(--border-2)' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: isExpired ? '#64748b' : getCategoryColor(item.category, categories) }}>
        {item.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color:'var(--text-1)' }}>{item.name}</p>
          {isExpired && <span className="badge" style={{ background:'rgba(100,116,139,0.1)', color:'#64748b' }}>Expired</span>}
          {!item.endDate && <span className="badge" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>∞ Infinite</span>}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color:'var(--text-3)' }}>
          {item.category} · Day {item.billingDay} · {item.endDate ? `Ends ${item.endDate}` : 'No end date'}
          {item.notes ? ` · ${item.notes}` : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{fmtCurrency(item.amount, item.currency)}</p>
        <p className="text-xs" style={{ color:'var(--text-3)' }}>/mo</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1.5 rounded-lg transition-colors" title={item.active ? 'Pause' : 'Activate'}
          style={{ color: item.active ? '#22c55e' : 'var(--text-3)' }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          onClick={onToggle}>
          <Power size={13} />
        </button>
        <button className="btn-ghost p-1.5 rounded-lg" style={{ border:'none' }} onClick={onEdit}><Pencil size={13} /></button>
        <button className="btn-danger p-1.5 rounded-lg" style={{ border:'none' }} onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export default function RecurringManager({ recurring, onAdd, onUpdate, onDelete, onToggle, categories, currencySettings }) {
  const [modal, setModal] = useState(null)
  const active   = recurring.filter(r => r.active)
  const inactive = recurring.filter(r => !r.active)
  const monthlyTotal = active.reduce((s,r) => s+r.amount, 0)

  function handleSave(item) { if (modal === 'add') onAdd(item); else onUpdate(item); setModal(null) }

  return (
    <div className="space-y-4 fade-in">
      {/* Info banner */}
      <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background:'var(--accent-dim)', border:'1px solid rgba(124,58,237,0.15)' }}>
        <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:2 }} />
        <p className="text-xs leading-relaxed" style={{ color:'var(--text-2)' }}>
          <span className="font-semibold" style={{ color:'var(--text-1)' }}>How it works: </span>
          Every time you open the app, it auto-creates this month's entry for each active subscription. Edit a recurring item → all linked expenses update. Pause → stops new entries but keeps history. Set an end date to stop a subscription at a specific month.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Monthly Total', value:`$${monthlyTotal.toFixed(2)}`, color:'var(--accent)' },
          { label:'Active',        value:active.length,                  color:'#22c55e' },
          { label:'Paused',        value:inactive.length,                color:'var(--text-3)' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="section-label mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color }}>{s.value}</p>
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
          {active.map(r => (
            <RecurringRow key={r.id} item={r} onEdit={()=>setModal(r)} onDelete={()=>onDelete(r.id)} onToggle={()=>onToggle(r.id)} categories={categories} />
          ))}
        </div>
      )}

      {/* Paused list */}
      {inactive.length > 0 && (
        <div className="card p-0 overflow-hidden" style={{ opacity:0.7 }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--text-3)' }} />
            <span className="section-label">Paused</span>
          </div>
          {inactive.map(r => (
            <RecurringRow key={r.id} item={r} onEdit={()=>setModal(r)} onDelete={()=>onDelete(r.id)} onToggle={()=>onToggle(r.id)} categories={categories} />
          ))}
        </div>
      )}

      {recurring.length === 0 && (
        <div className="card text-center py-14" style={{ color:'var(--text-3)' }}>
          No recurring items yet. Add your subscriptions like Zoom, Claude, AWS…
        </div>
      )}

      {modal && <RecurringModal item={modal==='add'?null:modal} onSave={handleSave} onClose={()=>setModal(null)} categories={categories} />}
    </div>
  )
}
