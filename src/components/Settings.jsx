import { useState } from 'react'
import { Save, Sun, Moon, Palette, Building2, RotateCcw, Plus, Trash2, GripVertical, DollarSign, Info } from 'lucide-react'
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, CURRENCIES, fmtCurrency } from '../data/store'

// ── Category Manager ───────────────────────────────────────────────────────
function CategoryManager({ categories, onSave }) {
  const [cats, setCats] = useState(categories)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [saved, setSaved] = useState(false)

  function addCat() {
    if (!newName.trim()) return
    if (cats.find(c => c.name.toLowerCase() === newName.trim().toLowerCase())) return
    setCats(prev => [...prev, { name: newName.trim(), color: newColor }])
    setNewName(''); setNewColor('#6366f1')
  }

  function updateColor(name, color) {
    setCats(prev => prev.map(c => c.name === name ? { ...c, color } : c))
  }

  function updateName(oldName, newNameVal) {
    if (!newNameVal.trim()) return
    setCats(prev => prev.map(c => c.name === oldName ? { ...c, name: newNameVal.trim() } : c))
  }

  function removeCat(name) {
    setCats(prev => prev.filter(c => c.name !== name))
  }

  function handleSave() {
    onSave(cats)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    setCats([...DEFAULT_CATEGORIES])
    onSave([...DEFAULT_CATEGORIES])
  }

  return (
    <div className="space-y-3">
      {/* Existing categories */}
      <div className="space-y-1.5">
        {cats.map(cat => (
          <div key={cat.name} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {/* Color swatch — clicking opens native color picker */}
            <div className="relative flex-shrink-0">
              <div className="w-6 h-6 rounded-lg cursor-pointer ring-2 ring-offset-1 ring-transparent hover:ring-offset-1"
                style={{ background: cat.color, ringColor: cat.color }}
                onClick={() => document.getElementById(`color-${cat.name}`).click()}
                title="Click to change color"
              />
              <input
                id={`color-${cat.name}`}
                type="color"
                value={cat.color}
                onChange={e => updateColor(cat.name, e.target.value)}
                className="absolute opacity-0 w-0 h-0"
              />
            </div>
            <input
              className="flex-1 text-sm font-medium bg-transparent border-none outline-none"
              style={{ color: 'var(--text-1)' }}
              defaultValue={cat.name}
              onBlur={e => updateName(cat.name, e.target.value)}
            />
            <button
              className="btn-danger p-1 rounded-lg flex-shrink-0"
              style={{ border: 'none' }}
              onClick={() => removeCat(cat.name)}
              title="Delete category"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-lg cursor-pointer border-2" style={{ background: newColor, borderColor: newColor }}
            onClick={() => document.getElementById('color-new').click()} />
          <input id="color-new" type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="absolute opacity-0 w-0 h-0" />
        </div>
        <input
          className="input flex-1"
          placeholder="New category name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
        />
        <button className="btn-primary px-3 py-2 flex-shrink-0" onClick={addCat} disabled={!newName.trim()}>
          <Plus size={14} />
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button className="btn-primary text-xs gap-1.5" onClick={handleSave}>
          <Save size={12} /> {saved ? 'Saved!' : 'Save Categories'}
        </button>
        <button className="btn-ghost text-xs gap-1.5" onClick={handleReset}>
          <RotateCcw size={12} /> Reset defaults
        </button>
      </div>
    </div>
  )
}

// ── Currency Manager ───────────────────────────────────────────────────────
function CurrencyManager({ currencySettings, onSave }) {
  const [cs, setCs] = useState(currencySettings)
  const [saved, setSaved] = useState(false)

  const otherCurrencies = CURRENCIES.filter(c => c !== cs.display)

  function setRate(currency, value) {
    setCs(prev => ({ ...prev, rates: { ...prev.rates, [currency]: parseFloat(value) || 0 } }))
  }

  function setDisplay(currency) {
    // Keep display currency rate as 1, adjust others accordingly
    setCs(prev => ({
      ...prev,
      display: currency,
      rates: { ...prev.rates, [currency]: 1 },
    }))
  }

  function handleSave() {
    onSave(cs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Display / Base Currency</label>
        <select className="input w-auto" value={cs.display} onChange={e => setDisplay(e.target.value)}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>All dashboard totals will be shown in this currency</p>
      </div>

      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>
          Exchange Rates <span style={{ color: 'var(--text-3)' }}>(1 X = how many {cs.display})</span>
        </label>
        <div className="space-y-2">
          {otherCurrencies.map(c => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-xs font-semibold w-10 flex-shrink-0" style={{ color: 'var(--text-2)' }}>{c}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>1 {c} =</span>
              <input
                className="input w-28 text-sm"
                type="number"
                min="0"
                step="0.0001"
                value={cs.rates[c] ?? ''}
                onChange={e => setRate(c, e.target.value)}
                placeholder="0.0000"
              />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{cs.display}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg px-3 py-2 mt-3 flex gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Info size={13} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Update these rates whenever exchange rates change. Expense records always store the original currency — only dashboard totals are converted.</p>
        </div>
      </div>

      <button className="btn-primary text-xs gap-1.5" onClick={handleSave}>
        <Save size={12} /> {saved ? 'Saved!' : 'Save Currency Settings'}
      </button>
    </div>
  )
}

// ── Main Settings ──────────────────────────────────────────────────────────
export default function Settings({ settings, onSave, onThemeChange, categories, onCategoriesSave, currencySettings, onCurrencySave }) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleSave(e) {
    e.preventDefault()
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    const reset = { ...DEFAULT_SETTINGS, theme: settings.theme }
    setForm(reset); onSave(reset)
  }

  function handleThemeToggle() {
    const next = form.theme === 'dark' ? 'light' : 'dark'
    set('theme', next); onThemeChange(next)
  }

  return (
    <div className="max-w-xl space-y-5 fade-in">

      {/* Appearance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={14} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Theme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Switch between light and dark mode</p>
          </div>
          <button type="button" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all btn-ghost" onClick={handleThemeToggle}>
            {form.theme === 'dark' ? <><Moon size={14} /> Dark</> : <><Sun size={14} /> Light</>}
          </button>
        </div>
      </div>

      {/* Branding */}
      <form onSubmit={handleSave}>
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} style={{ color: 'var(--accent)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Branding</h3>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>App Name</label>
            <input className="input" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Company Costs" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tagline</label>
            <input className="input" value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Cost tracking dashboard" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary text-xs gap-1.5"><Save size={12} />{saved ? 'Saved!' : 'Save'}</button>
            <button type="button" className="btn-ghost text-xs gap-1.5" onClick={handleReset}><RotateCcw size={12} /> Reset</button>
          </div>
        </div>
      </form>

      {/* Categories */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={14} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Categories</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
          Click a color swatch to change it. Click the name to rename. Changes affect all existing expenses using that category.
        </p>
        <CategoryManager categories={categories} onSave={onCategoriesSave} />
      </div>

      {/* Currency */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={14} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Currency & Exchange Rates</h3>
        </div>
        <CurrencyManager currencySettings={currencySettings} onSave={onCurrencySave} />
      </div>

      {/* Data note */}
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
        <p className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>About your data</p>
        <p>All data is stored locally in your browser. Nothing is sent to any server. Moving to a different browser or device will start fresh — cloud sync coming in the next version.</p>
      </div>
    </div>
  )
}
