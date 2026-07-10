// @ts-nocheck
"use client";

import type { Category, CurrencySettings, Expense, Project, Recurring } from "@/types";

interface ExpensesTableProps {
  expenses: Expense[];
  recurring?: Recurring[];
  projects?: Project[];
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  categories: Category[];
  currencySettings: CurrencySettings;
}


import { useState, useMemo } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Search, Pencil, Trash2, RefreshCw, ChevronDown, CalendarDays, X, Download, Upload, SlidersHorizontal } from 'lucide-react'
import { filterExpenses, getCategoryColor, getProjectColor, exportToCSV, fmtCurrency, expenseTypeLabel, EXPENSE_TYPES, convertToDisplay } from "@/lib/data/store"

const QUICK_RANGES = [
  { label: 'This month',  getRange: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',  getRange: () => { const d=subMonths(new Date(),1); return { from:format(startOfMonth(d),'yyyy-MM-dd'), to:format(endOfMonth(d),'yyyy-MM-dd') } } },
  { label: 'Last 3 mo',   getRange: () => ({ from:format(startOfMonth(subMonths(new Date(),2)),'yyyy-MM-dd'), to:format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last 6 mo',   getRange: () => ({ from:format(startOfMonth(subMonths(new Date(),5)),'yyyy-MM-dd'), to:format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'All time',    getRange: () => ({ from:'', to:'' }) },
]

const TYPE_OPTIONS = ['All', 'Monthly', 'Yearly', 'Credit', 'One-off']

const STICKY_COL_STYLE = {
  position: 'sticky',
  left: 0,
  zIndex: 10,
  background: 'var(--surface)',
  boxShadow: '2px 0 6px rgba(0,0,0,0.04)',
}

const STICKY_HEAD_STYLE = {
  ...STICKY_COL_STYLE,
  background: 'var(--surface-2)',
  zIndex: 11,
}

export default function ExpensesTable({ expenses, recurring = [], projects = [], onAdd, onEdit, onDelete, onImport, categories, currencySettings }: ExpensesTableProps) {
  const init = QUICK_RANGES[0].getRange()
  const [dateFrom,        setDateFrom]        = useState(init.from)
  const [dateTo,          setDateTo]          = useState(init.to)
  const [search,          setSearch]          = useState('')
  const [sortField,       setSortField]       = useState('date')
  const [sortDir,         setSortDir]         = useState('desc')
  const [filterCategory,  setFilterCategory]  = useState('All')
  const [filterProject,   setFilterProject]   = useState('All')
  const [filterType,      setFilterType]      = useState('All')
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [showTypeFilters, setShowTypeFilters] = useState(false)

  function applyRange(r) { const rng=r.getRange(); setDateFrom(rng.from); setDateTo(rng.to) }
  function isActive(r) { const rng=r.getRange(); return rng.from===dateFrom && rng.to===dateTo }
  const onQuickRange = QUICK_RANGES.some(r => isActive(r))

  const filtered = useMemo(() => {
    let list = filterExpenses(expenses, { dateFrom, dateTo })
    if (search)                    { const q=search.toLowerCase(); list=list.filter(e => e.name.toLowerCase().includes(q)||e.category.toLowerCase().includes(q)) }
    if (filterCategory !== 'All')  { list = list.filter(e => e.category === filterCategory) }
    if (filterProject === 'Company-wide') { list = list.filter(e => !e.project) }
    else if (filterProject !== 'All') { list = list.filter(e => e.project === filterProject) }
    if (filterType === 'Monthly')  { list = list.filter(e => { const rid=e.recurringId||e.recurring_id; if(!rid) return false; const freq=recurring.find(r=>r.id===rid)?.frequency||'monthly'; return freq==='monthly' }) }
    if (filterType === 'Yearly')   { list = list.filter(e => { const rid=e.recurringId||e.recurring_id; if(!rid) return false; return recurring.find(r=>r.id===rid)?.frequency==='yearly' }) }
    if (filterType === 'Credit')   { list = list.filter(e => e.expenseType === EXPENSE_TYPES.CREDIT_RELOAD) }
    if (filterType === 'One-off')  { list = list.filter(e => !e.recurringId && !e.recurring_id && e.expenseType !== EXPENSE_TYPES.CREDIT_RELOAD) }
    return [...list].sort((a,b) => {
      let av=a[sortField]??'', bv=b[sortField]??''
      if (sortField==='amount') { av=+av; bv=+bv }
      if (av<bv) return sortDir==='asc'?-1:1
      if (av>bv) return sortDir==='asc'?1:-1
      return 0
    })
  }, [expenses, recurring, dateFrom, dateTo, search, sortField, sortDir, filterCategory, filterProject, filterType])

  const total = useMemo(
    () => filtered.reduce((s, e) => s + convertToDisplay(e.amount, e.currency, currencySettings), 0),
    [filtered, currencySettings]
  )

  const hasActiveFilters = filterCategory !== 'All' || filterProject !== 'All' || filterType !== 'All'

  function toggleSort(field) {
    if (sortField===field) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortArrow = ({ field }) => (
    <ChevronDown size={11} style={{ color: sortField===field ? 'var(--accent)' : 'var(--text-3)', transition:'transform 0.15s', transform: sortField===field && sortDir==='asc' ? 'rotate(180deg)' : 'none' }} />
  )

  return (
    <div className="space-y-4 fade-in">
      <style>{`
        .expenses-table-row:hover .expenses-sticky-col {
          background: var(--surface-2);
        }
      `}</style>

      {/* Filter bar */}
      <div className="card p-4 space-y-3">
        {/* Row 1: Quick date ranges + optional custom dates */}
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_RANGES.map(r => (
            <button key={r.label} className={`pill ${isActive(r)?'active':''}`} onClick={()=>applyRange(r)}>{r.label}</button>
          ))}
          <button
            className={`pill ${showCustomDates || !onQuickRange ? 'active' : ''}`}
            onClick={() => setShowCustomDates(v => !v)}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} /> Custom
            </span>
          </button>
        </div>

        {(showCustomDates || !onQuickRange) && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-auto text-xs" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)} />
            <span className="text-xs" style={{ color:'var(--text-3)' }}>→</span>
            <input type="date" className="input w-auto text-xs" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)} />
            {(dateFrom||dateTo) && (
              <button className="text-xs flex items-center gap-1" style={{ color:'var(--text-3)' }} onClick={()=>{setDateFrom('');setDateTo('')}}>
                <X size={11} /> Clear dates
              </button>
            )}
          </div>
        )}

        {/* Row 2: Prominent search */}
        <div className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'var(--text-3)' }} />
          <input
            className="input pl-9 w-full"
            placeholder="Search name or category…"
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
        </div>

        {/* Row 3: Category, project, and type filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto text-xs pr-6" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {[...new Set(expenses.map(e=>e.category).filter(Boolean))].sort().map(c=>(
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select className="input w-auto text-xs pr-6" value={filterProject} onChange={e=>setFilterProject(e.target.value)}>
            <option value="All">All Projects</option>
            <option value="Company-wide">Company-wide</option>
            {[...new Set(expenses.map(e=>e.project).filter(Boolean))].sort().map(p=>(
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <button
            className={`pill ${showTypeFilters || filterType !== 'All' ? 'active' : ''}`}
            onClick={() => setShowTypeFilters(v => !v)}
          >
            <span className="inline-flex items-center gap-1">
              <SlidersHorizontal size={12} />
              Type{filterType !== 'All' ? `: ${filterType}` : ''}
              <ChevronDown size={11} style={{ transform: showTypeFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </span>
          </button>

          {hasActiveFilters && (
            <button className="text-xs flex items-center gap-1" style={{color:'var(--text-3)'}}
              onClick={()=>{setFilterCategory('All');setFilterProject('All');setFilterType('All')}}>
              <X size={11}/> Reset filters
            </button>
          )}
        </div>

        {showTypeFilters && (
          <div className="flex flex-wrap gap-1">
            {TYPE_OPTIONS.map(t=>(
              <button key={t} className={`pill ${filterType===t?'active':''}`} onClick={()=>setFilterType(t)}>{t}</button>
            ))}
          </div>
        )}

        {/* Secondary toolbar: Import / Export */}
        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border-2)' }}>
          <button className="btn-ghost gap-1.5 text-xs" onClick={onImport}>
            <Upload size={13} /> Import
          </button>
          <button className="btn-ghost gap-1.5 text-xs" title="Export visible rows as CSV"
            onClick={() => exportToCSV(filtered, `expenses-${format(new Date(),'yyyy-MM-dd')}.csv`)}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                {[{label:'Date',f:'date',sticky:true},{label:'Name',f:'name'},{label:'Project',f:'project'},{label:'Category',f:'category'},{label:'Amount',f:'amount'},{label:'Type',f:null},{label:'',f:null}].map(col=>(
                  <th
                    key={col.label}
                    className={`${col.f?'cursor-pointer select-none':''} ${col.sticky?'expenses-sticky-col':''}`}
                    style={col.sticky ? STICKY_HEAD_STYLE : undefined}
                    onClick={()=>col.f&&toggleSort(col.f)}
                  >
                    <span className="inline-flex items-center gap-1">{col.label}{col.f&&<SortArrow field={col.f}/>}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 px-6 text-sm" style={{ color:'var(--text-3)' }}>
                    <p>No expenses match your filters.</p>
                    <p className="mt-2 text-xs">
                      {onImport && (
                        <>
                          <button type="button" className="underline hover:no-underline" style={{ color:'var(--accent)' }} onClick={onImport}>Import</button>
                          {' '}a spreadsheet or{' '}
                        </>
                      )}
                      {onAdd ? (
                        <button type="button" className="underline hover:no-underline" style={{ color:'var(--accent)' }} onClick={onAdd}>add an expense</button>
                      ) : (
                        'add an expense via the header'
                      )}
                      {' '}to get started.
                    </p>
                  </td>
                </tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="expenses-table-row">
                  <td style={{ ...STICKY_COL_STYLE, color:'var(--text-3)' }} className="expenses-sticky-col whitespace-nowrap">{e.date}</td>
                  <td className="max-w-[220px]">
                    <p className="font-medium truncate" style={{ color:'var(--text-1)' }} title={e.name}>{e.name}</p>
                    {e.notes && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color:'var(--text-3)' }} title={e.notes}>{e.notes}</p>
                    )}
                  </td>
                  <td>
                    {e.project ? (
                      <span className="badge" style={{ background: getProjectColor(e.project, projects) + '20', color: getProjectColor(e.project, projects) }}>
                        {e.project}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Company-wide</span>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{ background:(getCategoryColor(e.category,categories))+'20', color:getCategoryColor(e.category,categories) }}>
                      {e.category}
                    </span>
                  </td>
                  <td className="font-semibold whitespace-nowrap" style={{ color:'var(--text-1)' }}>
                    {fmtCurrency(e.amount, e.currency)}
                  </td>
                  <td>
                    {(() => {
                      const rid = e.recurringId || e.recurring_id
                      if (e.expenseType === EXPENSE_TYPES.CREDIT_RELOAD) {
                        return <span className="badge" style={{ background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>Credit reload</span>
                      }
                      if (e.expenseType === EXPENSE_TYPES.ONE_TIME || (!rid && e.expenseType !== EXPENSE_TYPES.SUBSCRIPTION)) {
                        return <span className="badge" style={{ background:'var(--surface-2)', color:'var(--text-3)' }}>One-time</span>
                      }
                      if (!rid) return <span className="badge" style={{ background:'var(--surface-2)', color:'var(--text-3)' }}>{expenseTypeLabel(e.expenseType)}</span>
                      const freq = recurring.find(r=>r.id===rid)?.frequency || 'monthly'
                      return freq === 'yearly'
                        ? <span className="badge" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}><RefreshCw size={9}/> Yearly</span>
                        : <span className="badge" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}><RefreshCw size={9}/> Monthly</span>
                    })()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        className="btn-ghost p-2 rounded-lg min-h-9 min-w-9 flex items-center justify-center"
                        style={{ border:'none' }}
                        aria-label={`Edit ${e.name}`}
                        onClick={()=>onEdit(e)}
                      >
                        <Pencil size={14}/>
                      </button>
                      <button
                        className="btn-danger p-2 rounded-lg min-h-9 min-w-9 flex items-center justify-center"
                        style={{ border:'none' }}
                        aria-label={`Delete ${e.name}`}
                        onClick={()=>onDelete(e.id)}
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length>0 && (
              <tfoot>
                <tr style={{ background:'var(--surface-2)', borderTop:'1px solid var(--border)' }}>
                  <td colSpan={4} className="px-4 py-3">
                    <span className="section-label">{filtered.length} item{filtered.length!==1?'s':''}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color:'var(--text-1)' }}>{fmtCurrency(total, currencySettings?.display || 'MYR')}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
