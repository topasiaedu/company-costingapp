import { useState, useEffect } from 'react'
import { X, RefreshCw, Sparkles, Infinity, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { CURRENCIES, genId, guessCategory, EXPENSE_TYPES } from '../data/store'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const makeEmpty = (defaultCurrency = 'USD') => ({
  name: '', category: '', amount: '', currency: defaultCurrency,
  date: format(new Date(), 'yyyy-MM-dd'), notes: '',
  project: null,
  expenseType: EXPENSE_TYPES.ONE_TIME,
  isRecurring: false, frequency: 'monthly', billingDay: new Date().getDate(),
  billingMonth: new Date().getMonth() + 1,
  hasEndDate: false, endDate: '',
})

export default function ExpenseModal({ expense, defaultCurrency = 'USD', categories = [], projects = [], onSave, onClose }) {
  const isEdit = !!expense
  const [form, setForm] = useState(() => makeEmpty(defaultCurrency))
  const [autoCategory, setAutoCategory] = useState(null)
  const [showBillingOptions, setShowBillingOptions] = useState(false)

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        category: expense.category,
        amount: expense.amount,
        currency: expense.currency ?? defaultCurrency,
        date: expense.date,
        notes: expense.notes ?? '',
        project: expense.project ?? null,
        expenseType: expense.expenseType || (expense.recurringId ? EXPENSE_TYPES.SUBSCRIPTION : EXPENSE_TYPES.ONE_TIME),
        isRecurring: !!(expense.recurringId || expense.recurring_id),
        frequency: expense.frequency || 'monthly',
        billingDay: expense.billingDay ?? (expense.date ? +expense.date.split('-')[2] : 1),
        billingMonth: expense.billingMonth || new Date().getMonth() + 1,
        hasEndDate: !!expense.endDate,
        endDate: expense.endDate ?? '',
      })
      setAutoCategory(null)
      setShowBillingOptions(!!(expense.recurringId || expense.recurring_id))
    } else {
      setForm(makeEmpty(defaultCurrency))
      setAutoCategory(null)
      setShowBillingOptions(false)
    }
  }, [expense, defaultCurrency])

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleNameChange(v) {
    set('name', v)
    const g = guessCategory(v)
    setAutoCategory(g !== 'Other' ? g : null)
    if (!isEdit && !form.category.trim()) {
      set('category', g !== 'Other' ? g : '')
    }
  }

  const isLinkedSubscription = !!(expense?.recurringId || expense?.recurring_id)
  const isImportedCredit = expense?.expenseType === EXPENSE_TYPES.CREDIT_RELOAD

  function handleTypeChange(t) {
    if (!isEdit || isLinkedSubscription) return
    set('expenseType', t)
    set('isRecurring', false)
    setShowBillingOptions(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.amount || !form.date) return
    const isRecurring = isLinkedSubscription && form.expenseType === EXPENSE_TYPES.SUBSCRIPTION
    onSave({
      name: form.name.trim(),
      category: form.category || 'Other',
      amount: parseFloat(form.amount),
      currency: form.currency,
      date: form.date,
      notes: form.notes.trim(),
      project: form.project || null,
      expenseType: isRecurring ? EXPENSE_TYPES.SUBSCRIPTION : form.expenseType,
      id: expense?.id ?? genId('e'),
      recurringId: expense?.recurringId || expense?.recurring_id || null,
      isRecurring,
      frequency: isRecurring ? (form.frequency || 'monthly') : null,
      billingDay: isRecurring ? +form.billingDay : null,
      billingMonth: (isRecurring && form.frequency === 'yearly') ? +form.billingMonth : null,
      endDate: (isRecurring && form.hasEndDate && form.endDate) ? form.endDate : null,
    })
  }

  const isSubscription = isLinkedSubscription && form.expenseType === EXPENSE_TYPES.SUBSCRIPTION

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="modal-enter relative rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
            {isEdit ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button className="btn-ghost p-1.5 rounded-lg" style={{ border: 'none' }} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-6 space-y-4">
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

            {/* Category + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  Category *{autoCategory && !isEdit && <span className="ml-1" style={{ color: 'var(--accent)' }}>(auto)</span>}
                </label>
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

            {/* Project */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Project</label>
              <select className="input" value={form.project || ''} onChange={e => set('project', e.target.value || null)}>
                <option value="">Company-wide</option>
                {projects.map(p => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {/* Expense type — add flow is one-time only; subscriptions live on Subscriptions tab */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Expense type</label>
              {isEdit && (isLinkedSubscription || isImportedCredit) ? (
                <input className="input" value={isImportedCredit ? 'Credit reload' : 'Subscription'} readOnly />
              ) : (
                <>
                  <select
                    className="input"
                    value={form.expenseType}
                    onChange={e => handleTypeChange(e.target.value)}
                  >
                    <option value={EXPENSE_TYPES.ONE_TIME}>One-time</option>
                    {!isEdit && (
                      <option value={EXPENSE_TYPES.SUBSCRIPTION} disabled>Subscription — add in Subscriptions tab</option>
                    )}
                  </select>
                  {!isEdit && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
                      For recurring charges like Zoom or AWS, use the <strong>Subscriptions</strong> tab.
                    </p>
                  )}
                </>
              )}
            </div>

            {isLinkedSubscription && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--text-2)' }}>
                Linked to a subscription. Edit details here or manage the template in the <strong>Subscriptions</strong> tab.
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notes</label>
              <input className="input" placeholder="Optional notes…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            {/* Subscription billing options — collapsed by default */}
            {isSubscription && (
              <div className="rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setShowBillingOptions(v => !v)}
                >
                  <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
                    <RefreshCw size={13} style={{ color: 'var(--accent)' }} />
                    Billing schedule
                  </span>
                  {showBillingOptions ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
                </button>

                {showBillingOptions && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Frequency toggle */}
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Frequency</label>
                      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <button type="button"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                          style={form.frequency !== 'yearly'
                            ? { background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: 'white' }
                            : { background: 'transparent', color: 'var(--text-2)' }}
                          onClick={() => set('frequency', 'monthly')}>
                          <RefreshCw size={11} /> Monthly
                        </button>
                        <button type="button"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
                          style={form.frequency === 'yearly'
                            ? { background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: 'white' }
                            : { background: 'transparent', color: 'var(--text-2)' }}
                          onClick={() => set('frequency', 'yearly')}>
                          <Calendar size={11} /> Yearly
                        </button>
                      </div>
                    </div>

                    {/* Billing day/month */}
                    <div className={`grid gap-3 ${form.frequency === 'yearly' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {form.frequency === 'yearly' && (
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Billing month</label>
                          <select className="input" value={form.billingMonth} onChange={e => set('billingMonth', +e.target.value)}>
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                          {form.frequency === 'yearly'
                            ? 'Billing day'
                            : <>Charge on day <span style={{ color: 'var(--accent)' }}>{form.billingDay}</span> of each month</>}
                        </label>
                        <input
                          className="input w-24" type="number" min="1" max="31"
                          value={form.billingDay} onChange={e => set('billingDay', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Duration */}
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
                          : form.frequency === 'yearly'
                            ? 'Runs every year with no end — change anytime'
                            : 'Runs every month with no end — change anytime'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div
            className="flex gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
          >
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
