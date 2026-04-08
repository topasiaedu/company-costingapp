import { useState, useEffect } from 'react'
import { X, RefreshCw, Sparkles, Infinity, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { CURRENCIES, genId, guessCategory } from '../data/store'

const makeEmpty = (defaultCurrency = 'USD') => ({
  name: '', category: '', amount: '', currency: defaultCurrency,
  date: format(new Date(), 'yyyy-MM-dd'), notes: '',
  isRecurring: false, billingDay: new Date().getDate(),
  hasEndDate: false, endDate: '',
})

export default function ExpenseModal({ expense, defaultCurrency = 'USD', categories = [], onSave, onClose }) {
  const isEdit = !!expense
  const [form, setForm] = useState(() => makeEmpty(defaultCurrency))
  const [autoCategory, setAutoCategory] = useState(null)

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        category: expense.category,
        amount: expense.amount,
        currency: expense.currency ?? defaultCurrency,
        date: expense.date,
        notes: expense.notes ?? '',
        isRecurring: !!(expense.recurringId || expense.recurring_id),
        billingDay: expense.billingDay ?? (expense.date ? +expense.date.split('-')[2] : 1),
        hasEndDate: !!expense.endDate,
        endDate: expense.endDate ?? '',
      })
      setAutoCategory(null)
    } else {
      setForm(makeEmpty(defaultCurrency))
      setAutoCategory(null)
    }
  }, [expense, defaultCurrency])

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleNameChange(v) {
    set('name', v)
    const g = guessCategory(v)
    setAutoCategory(g !== 'Other' ? g : null)
    if (!isEdit) set('category', g !== 'Other' ? g : '')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.amount || !form.date) return
    onSave({
      name: form.name.trim(),
      category: form.category || 'Other',
      amount: parseFloat(form.amount),
      currency: form.currency,
      date: form.date,
      notes: form.notes.trim(),
      id: expense?.id ?? genId('e'),
      recurringId: expense?.recurringId || expense?.recurring_id || null,
      isRecurring: form.isRecurring,
      billingDay: form.isRecurring ? +form.billingDay : null,
      endDate: (form.isRecurring && form.hasEndDate && form.endDate) ? form.endDate : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            {isEdit ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border: 'none' }} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Name *</label>
            <input
              className="input" placeholder="e.g. ChatGPT Plus"
              value={form.name} onChange={e => handleNameChange(e.target.value)}
              required autoFocus
            />
            {autoCategory && !isEdit && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <Sparkles size={10} /> Auto-detected: <strong>{autoCategory}</strong>
              </p>
            )}
          </div>

          {/* Category (combobox) + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                Category *{autoCategory && !isEdit && <span className="ml-1" style={{ color: 'var(--accent)' }}>(auto)</span>}
              </label>
              {/* datalist = shows suggestions but allows free-type */}
              <input
                className="input"
                list="category-options"
                placeholder="Pick or type a category…"
                value={form.category}
                onChange={e => { set('category', e.target.value); setAutoCategory(null) }}
              />
              <datalist id="category-options">
                {categories.map(c => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Currency</label>
              <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Amount *</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => set('amount', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Date *</label>
              <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notes</label>
            <input className="input" placeholder="Optional notes…"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {/* Recurring section */}
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {/* Toggle row */}
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => set('isRecurring', !form.isRecurring)}>
              <div className={`toggle ${form.isRecurring ? 'on' : ''}`}><div className="toggle-thumb" /></div>
              <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
                <RefreshCw size={13} style={{ color: form.isRecurring ? 'var(--accent)' : 'var(--text-3)' }} />
                Recurring monthly
              </span>
            </div>

            {form.isRecurring && (
              <div className="space-y-4 pt-1">
                {/* Billing day — always shown, always needed */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                    Charge on day <span style={{ color: 'var(--accent)' }}>{form.billingDay}</span> of each month
                  </label>
                  <input
                    className="input w-24" type="number" min="1" max="31"
                    value={form.billingDay} onChange={e => set('billingDay', e.target.value)}
                  />
                </div>

                {/* Duration — clean two-option toggle */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Duration</label>
                  <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                      style={!form.hasEndDate
                        ? { background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: 'white' }
                        : { background: 'transparent', color: 'var(--text-2)' }}
                      onClick={() => set('hasEndDate', false)}
                    >
                      <Infinity size={12} /> Ongoing
                    </button>
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                      style={form.hasEndDate
                        ? { background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: 'white' }
                        : { background: 'transparent', color: 'var(--text-2)' }}
                      onClick={() => set('hasEndDate', true)}
                    >
                      <Calendar size={12} /> Set end date
                    </button>
                  </div>
                  {form.hasEndDate && (
                    <input
                      className="input mt-2 text-xs"
                      type="date"
                      value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                    />
                  )}
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
                    {form.hasEndDate
                      ? (form.endDate ? `Stops after ${form.endDate}` : 'Pick an end date above')
                      : 'Runs every month with no end — change anytime'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">
              {isEdit ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
