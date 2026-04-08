import { useState, useMemo } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Search, Plus, Pencil, Trash2, RefreshCw, ChevronDown, CalendarDays, X, Download } from 'lucide-react'
import { filterExpenses, getCategoryColor, exportToCSV, fmtCurrency } from '../data/store'

const QUICK_RANGES = [
  { label: 'This month',  getRange: () => ({ from: format(startOfMonth(new Date()),'yyyy-MM-dd'), to: format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last month',  getRange: () => { const d=subMonths(new Date(),1); return { from:format(startOfMonth(d),'yyyy-MM-dd'), to:format(endOfMonth(d),'yyyy-MM-dd') } } },
  { label: 'Last 3 mo',   getRange: () => ({ from:format(startOfMonth(subMonths(new Date(),2)),'yyyy-MM-dd'), to:format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'Last 6 mo',   getRange: () => ({ from:format(startOfMonth(subMonths(new Date(),5)),'yyyy-MM-dd'), to:format(endOfMonth(new Date()),'yyyy-MM-dd') }) },
  { label: 'All time',    getRange: () => ({ from:'', to:'' }) },
]

export default function ExpensesTable({ expenses, recurring = [], onAdd, onEdit, onDelete, categories, currencySettings }) {
  const init = QUICK_RANGES[0].getRange()
  const [dateFrom,        setDateFrom]        = useState(init.from)
  const [dateTo,          setDateTo]          = useState(init.to)
  const [search,          setSearch]          = useState('')
  const [sortField,       setSortField]       = useState('date')
  const [sortDir,         setSortDir]         = useState('desc')
  const [filterCategory,  setFilterCategory]  = useState('All')
  const [filterType,      setFilterType]      = useState('All')

  function applyRange(r) { const rng=r.getRange(); setDateFrom(rng.from); setDateTo(rng.to) }
  function isActive(r) { const rng=r.getRange(); return rng.from===dateFrom && rng.to===dateTo }

  const filtered = useMemo(() => {
    let list = filterExpenses(expenses, { dateFrom, dateTo })
    if (search)                    { const q=search.toLowerCase(); list=list.filter(e => e.name.toLowerCase().includes(q)||e.category.toLowerCase().includes(q)) }
    if (filterCategory !== 'All')  { list = list.filter(e => e.category === filterCategory) }
    if (filterType === 'Monthly')  { list = list.filter(e => { const rid=e.recurringId||e.recurring_id; if(!rid) return false; const freq=recurring.find(r=>r.id===rid)?.frequency||'monthly'; return freq==='monthly' }) }
    if (filterType === 'Yearly')   { list = list.filter(e => { const rid=e.recurringId||e.recurring_id; if(!rid) return false; return recurring.find(r=>r.id===rid)?.frequency==='yearly' }) }
    if (filterType === 'One-off')  { list = list.filter(e => !e.recurringId && !e.recurring_id) }
    return [...list].sort((a,b) => {
      let av=a[sortField]??'', bv=b[sortField]??''
      if (sortField==='amount') { av=+av; bv=+bv }
      if (av<bv) return sortDir==='asc'?-1:1
      if (av>bv) return sortDir==='asc'?1:-1
      return 0
    })
  }, [expenses, dateFrom, dateTo, search, sortField, sortDir, filterCategory, filterType])

  const total = useMemo(() => filtered.reduce((s,e) => s+e.amount, 0), [filtered])

  function toggleSort(field) {
    if (sortField===field) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortArrow = ({ field }) => (
    <ChevronDown size={11} style={{ color: sortField===field ? 'var(--accent)' : 'var(--text-3)', transition:'transform 0.15s', transform: sortField===field && sortDir==='asc' ? 'rotate(180deg)' : 'none' }} />
  )

  return (
    <div className="space-y-4 fade-in">
      {/* Filter bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map(r => (
            <button key={r.label} className={`pill ${isActive(r)?'active':''}`} onClick={()=>applyRange(r)}>{r.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={14} style={{ color:'var(--text-3)' }} />
          <input type="date" className="input w-auto text-xs" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)} />
          <span className="text-xs" style={{ color:'var(--text-3)' }}>→</span>
          <input type="date" className="input w-auto text-xs" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)} />
          {(dateFrom||dateTo) && (
            <button className="text-xs flex items-center gap-1" style={{ color:'var(--text-3)' }} onClick={()=>{setDateFrom('');setDateTo('')}}>
              <X size={11} /> Clear
            </button>
          )}
          <div className="relative flex-1 min-w-40 ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-3)' }} />
            <input className="input pl-8 text-xs" placeholder="Search name or category…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button className="btn-ghost gap-1.5 text-xs" title="Export visible rows as CSV"
            onClick={() => exportToCSV(filtered, `expenses-${format(new Date(),'yyyy-MM-dd')}.csv`)}>
            <Download size={13} /> Export
          </button>
          <button className="btn-primary text-xs" onClick={onAdd}><Plus size={13} /> Add</button>
        </div>

        {/* Category + Type filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category dropdown */}
          <select className="input w-auto text-xs pr-6" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {[...new Set(expenses.map(e=>e.category).filter(Boolean))].sort().map(c=>(
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Type pills */}
          <div className="flex gap-1">
            {['All','Monthly','Yearly','One-off'].map(t=>(
              <button key={t} className={`pill ${filterType===t?'active':''}`} onClick={()=>setFilterType(t)}>{t}</button>
            ))}
          </div>

          {/* Reset filters */}
          {(filterCategory!=='All'||filterType!=='All') && (
            <button className="text-xs flex items-center gap-1" style={{color:'var(--text-3)'}}
              onClick={()=>{setFilterCategory('All');setFilterType('All')}}>
              <X size={11}/> Reset filters
            </button>
          )}

        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                {[{label:'Date',f:'date'},{label:'Name',f:'name'},{label:'Category',f:'category'},{label:'Amount',f:'amount'},{label:'Type',f:null},{label:'',f:null}].map(col=>(
                  <th key={col.label} className={col.f?'cursor-pointer select-none':''} onClick={()=>col.f&&toggleSort(col.f)}>
                    <span className="inline-flex items-center gap-1">{col.label}{col.f&&<SortArrow field={col.f}/>}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-sm" style={{ color:'var(--text-3)' }}>No expenses for this period</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="group">
                  <td style={{ color:'var(--text-3)' }} className="whitespace-nowrap">{e.date}</td>
                  <td>
                    <p className="font-medium" style={{ color:'var(--text-1)' }}>{e.name}</p>
                    {e.notes && <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{e.notes}</p>}
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
                      if (!rid) return <span className="badge" style={{ background:'var(--surface-2)', color:'var(--text-3)' }}>One-off</span>
                      const freq = recurring.find(r=>r.id===rid)?.frequency || 'monthly'
                      return freq === 'yearly'
                        ? <span className="badge" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}><RefreshCw size={9}/> Yearly</span>
                        : <span className="badge" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}><RefreshCw size={9}/> Monthly</span>
                    })()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="btn-ghost p-1.5 rounded-lg" style={{ border:'none' }} onClick={()=>onEdit(e)}><Pencil size={13}/></button>
                      <button className="btn-danger p-1.5 rounded-lg" style={{ border:'none' }} onClick={()=>onDelete(e.id)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length>0 && (
              <tfoot>
                <tr style={{ background:'var(--surface-2)', borderTop:'1px solid var(--border)' }}>
                  <td colSpan={3} className="px-4 py-3">
                    <span className="section-label">{filtered.length} item{filtered.length!==1?'s':''}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color:'var(--text-1)' }}>${total.toFixed(2)}</td>
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
