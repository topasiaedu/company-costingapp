import { FileSpreadsheet, Plus, Sparkles } from 'lucide-react'

export default function EmptyState({ onImport, onAddExpense }) {
  return (
    <div className="fade-in flex flex-col items-center justify-center text-center py-12 px-6 min-h-[min(420px,60vh)]">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
      >
        <Sparkles size={26} />
      </div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
        Start tracking tech spend
      </h2>
      <p className="text-sm max-w-md mb-8 leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Import your Mastersheet CSV to load subscriptions and expenses in one step, or add your first expense manually.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button type="button" className="btn-primary" onClick={onImport}>
          <FileSpreadsheet size={16} />
          Import Mastersheet CSV
        </button>
        <button type="button" className="btn-ghost" onClick={onAddExpense}>
          <Plus size={16} />
          Add Expense
        </button>
      </div>
    </div>
  )
}
